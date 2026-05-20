const {
  GAME_TICK_MS, HIT_RADIUS,
  SWAP_THRESHOLDS, ROAR_DURATION_MS, STUN_DURATION_MS,
  WEAPON_PICKUP_RADIUS,
} = require("./constants");
const { getPhase } = require("./words");
const { takeDamage } = require("./helpers");
const { getProjectileDamage } = require("./difficulty");
const { tickStatusAndHazards } = require("./statusEffects");
const { maybeInitBossShield } = require("./bossDamage");
const { moveBoss, tickBossAttacks, steerHomingProjectiles, maybeFireSpecial } = require("./bossAI");
const { emitGameState, toPublicRoomState } = require("./gameState");
const { DEFAULT_WEAPON_ID } = require("./weapons");
const { refreshWeaponWord, tickWordExpiry } = require("./weaponCombat");
const { tickTypingChallenges } = require("./typingChallenges");
const { resolveBossConfig, tryBossTransform } = require("./bossTransform");
const { getBoss } = require("./bosses");

const loops = new Map();

const stopLoop = (code) => {
  const h = loops.get(code);
  if (h) { clearInterval(h); loops.delete(code); }
};

const swapRoles = (players) => {
  players.forEach((p) => { p.role = p.role === "runner" ? "typer" : "runner"; });
};

const advanceBossLifecycle = (io, room, bossConfig, now) => {
  const g = room.game;
  const soloMode = room.gameMode === "solo" || g.gameMode === "solo";

  if (g.bossState === "countdown" && now >= g.stateEndsAt) {
    g.bossState   = "attack";
    g.stateEndsAt = 0;
    g.boss.lastFireAt = now;
    io.to(room.code).emit("battle_started", { roomCode: room.code });
    return;
  }

  if (g.bossState === "roar" && now >= g.stateEndsAt) {
    if (soloMode) {
      // Solo: roar → stun only, no role swap
      g.bossState   = "stunned";
      g.stateEndsAt = now + STUN_DURATION_MS;
    } else {
      swapRoles(room.players);
      g.bossState   = "stunned";
      g.stateEndsAt = now + STUN_DURATION_MS;
      room.players.forEach((p) => { p.facing = { x: 0, y: 0 }; });
      // Co-op: keep the team's active weapon when roles swap (don't revert to runner's default).
      if (g.weapon?.typeId) {
        room.players.forEach((p) => { p.weaponTypeId = g.weapon.typeId; });
      }
      io.to(room.code).emit("roles_swapped", {
        players: room.players.map(({ socketId, username, role, weaponTypeId }) => ({
          socketId, username, role, weaponTypeId,
        })),
        weaponTypeId: g.weapon?.typeId,
        weaponHeld: Boolean(g.weapon?.held),
      });
      io.to(room.code).emit("room_update", toPublicRoomState(room));
    }
    return;
  }

  if (g.bossState === "stunned" && now >= g.stateEndsAt) {
    g.bossState   = "attack";
    g.stateEndsAt = 0;
    g.boss.lastFireAt = now;
    if (g.boss.windingUp) {
      g.boss.windingUp    = false;
      g.boss.windUpAttack = null;
      g.boss.windUpUntil  = 0;
      io.to(room.code).emit("boss_windup_cancel");
    }
  }
};

const tick = (io, room) => {
  if (!room || room.status !== "in_game" || !room.game) { stopLoop(room.code); return; }
  try {
  const bossConfig = resolveBossConfig(room);
  const g   = room.game;
  const now = Date.now();
  const deltaMs      = now - g.lastTickAt;
  const deltaSeconds = deltaMs / 1000;
  g.lastTickAt = now;

  advanceBossLifecycle(io, room, bossConfig, now);
  tickTypingChallenges(io, room, now);

  const phase = getPhase(g.bossHP, g.bossMaxHP);
  maybeInitBossShield(g, bossConfig, phase);

  if (g.bossState !== "countdown" && g.bossState !== "stunned") {
    moveBoss(g, bossConfig, now, deltaSeconds, phase);
  }

  if (g.bossState === "attack") {
    maybeFireSpecial(io, room, bossConfig, phase, now);
    tickBossAttacks(io, room, bossConfig, phase, now, deltaMs);
  }

  steerHomingProjectiles(g, bossConfig, deltaSeconds);
  tickStatusAndHazards(io, room, now, deltaSeconds);

  if (tickWordExpiry(io, room, now)) {
    emitGameState(io, room, bossConfig);
  }

  const char = g.character;

  if (g.weapon && !g.weapon.held && now >= (g.weapon.pickupLockedUntil || 0)) {
    const wdx = char.x - g.weapon.x;
    const wdy = char.y - g.weapon.y;
    if (wdx * wdx + wdy * wdy < WEAPON_PICKUP_RADIUS * WEAPON_PICKUP_RADIUS) {
      const carrier = room.players.find((p) => p.role === "typer" || p.role === "solo");
      // Preserve weapon on the ground (e.g. after drop); typer default only for first spawn.
      const teamType = g.weapon.typeId || carrier?.weaponTypeId || DEFAULT_WEAPON_ID;
      g.weapon.typeId = teamType;
      if (room.gameMode === "coop" || room.players.length > 1) {
        room.players.forEach((p) => { p.weaponTypeId = teamType; });
      }
      g.weapon.held = true;
      g.weapon.pickedUpAt = now;
      g.weapon.pickupLockedUntil = 0;
      g.weaponStreak = 0;
      refreshWeaponWord(g);
      io.to(room.code).emit("weapon_picked", {
        x: g.weapon.x,
        y: g.weapon.y,
        weaponTypeId: g.weapon.typeId,
      });
    }
  }

  const projDmg = getProjectileDamage(g);
  g.projectiles = g.projectiles.filter((p) => {
    if (p.gravity) p.vy += p.gravity * deltaSeconds;
    p.x += p.vx * deltaSeconds;
    p.y += p.vy * deltaSeconds;
    const dx = char.x - p.x;
    const dy = char.y - p.y;
    if (dx * dx + dy * dy < HIT_RADIUS * HIT_RADIUS) {
      takeDamage(io, room, projDmg, p.x, p.y);
      return false;
    }
    return p.y <= 800 && p.x >= -100 && p.x <= 1380 && p.y >= -100;
  });

  emitGameState(io, room, bossConfig);

  if (g.bossHP <= 0 && tryBossTransform(io, room, getBoss(room.selectedBoss))) {
    emitGameState(io, room, resolveBossConfig(room));
    return;
  }

  if (g.sharedHP <= 0 || g.bossHP <= 0) {
    room.status = "finished";
    room.players.forEach((p) => { p.wantsPlayAgain = false; });
    stopLoop(room.code);
    io.to(room.code).emit("game_over", {
      winner:         g.bossHP <= 0 ? "players" : "boss",
      sharedHP:       g.sharedHP,
      bossHP:         g.bossHP,
      bossShield:     g.bossShield || 0,
      elapsedMs:      now - g.startedAt,
      totalWordsTyped: g.totalWordsTyped,
      gameMode:       room.gameMode || "coop",
      players: room.players.map(({ socketId, username, wordsTyped, damageDealt }) => ({
        socketId, username, wordsTyped: wordsTyped || 0, damageDealt: damageDealt || 0,
      })),
    });
  }
  } catch (err) {
    console.error(`[gameLoop] tick error room=${room?.code}:`, err.message);
  }
};

const startGameLoop = (io, room) => {
  stopLoop(room.code);
  loops.set(room.code, setInterval(() => tick(io, room), GAME_TICK_MS));
};

module.exports = { startGameLoop, stopLoop };
