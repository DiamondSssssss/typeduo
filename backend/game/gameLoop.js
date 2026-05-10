const { GAME_TICK_MS, HIT_RADIUS, PROJECTILE_DAMAGE, SWAP_THRESHOLDS, ROAR_DURATION_MS, STUN_DURATION_MS, COUNTDOWN_DURATION_MS } = require("./constants");
const { getDifficultyWord, getDifficultyPhase, getPhase, computeWordDamage, HEAL_STREAK_THRESHOLD, HEAL_AMOUNT } = require("./words");
const { takeDamage } = require("./helpers");
const { moveBoss, tickBossAttacks, steerHomingProjectiles, maybeFireSpecial } = require("./bossAI");
const { emitGameState, toPublicRoomState } = require("./gameState");

const { HEAL_STREAK_THRESHOLD: HST, HEAL_AMOUNT: HA, STUN_DAMAGE_MULTIPLIER } = (() => {
  const C = require("./constants");
  return { ...C };
})();

// ── Room loop registry ────────────────────────────────────────────────────────
const loops = new Map();

const stopLoop = (code) => {
  const h = loops.get(code);
  if (h) { clearInterval(h); loops.delete(code); }
};

// ── Lifecycle helpers ─────────────────────────────────────────────────────────
const swapRoles = (players) => {
  players.forEach((p) => { p.role = p.role === "runner" ? "typer" : "runner"; });
};

const advanceBossLifecycle = (io, room, bossConfig, now) => {
  const g = room.game;

  if (g.bossState === "countdown" && now >= g.stateEndsAt) {
    g.bossState   = "attack";
    g.stateEndsAt = 0;
    g.boss.lastFireAt = now;
    io.to(room.code).emit("battle_started", { roomCode: room.code });
    return;
  }

  if (g.bossState === "roar" && now >= g.stateEndsAt) {
    swapRoles(room.players);
    g.bossState   = "stunned";
    g.stateEndsAt = now + STUN_DURATION_MS;
    room.players.forEach((p) => { p.facing = { x: 0, y: 0 }; });
    io.to(room.code).emit("roles_swapped", {
      players: room.players.map(({ socketId, username, role }) => ({ socketId, username, role })),
    });
    io.to(room.code).emit("room_update", toPublicRoomState(room));
    return;
  }

  if (g.bossState === "stunned" && now >= g.stateEndsAt) {
    g.bossState   = "attack";
    g.stateEndsAt = 0;
    g.boss.lastFireAt = now;
  }
};

const maybeTriggerRoar = (io, room, prevHP) => {
  const g = room.game;
  if (!g || g.bossState === "roar" || g.bossState === "stunned") return;
  const threshold = SWAP_THRESHOLDS.find(
    (t) =>
      !g.triggeredSwapThresholds.includes(t) &&
      prevHP > (g.bossMaxHP * t / 100) &&
      g.bossHP <= (g.bossMaxHP * t / 100)
  );
  if (!threshold) return;
  g.triggeredSwapThresholds.push(threshold);
  g.bossState   = "roar";
  g.stateEndsAt = Date.now() + ROAR_DURATION_MS;
  g.projectiles = [];
  io.to(room.code).emit("boss_roar_start", { threshold, countdownMs: ROAR_DURATION_MS });
};

// ── Main tick ─────────────────────────────────────────────────────────────────
const tick = (io, room, bossConfig) => {
  if (!room || room.status !== "in_game" || !room.game) { stopLoop(room.code); return; }
  const g   = room.game;
  const now = Date.now();
  const deltaMs      = now - g.lastTickAt;
  const deltaSeconds = deltaMs / 1000;
  g.lastTickAt = now;

  advanceBossLifecycle(io, room, bossConfig, now);

  const phase = getPhase(g.bossHP, g.bossMaxHP);

  // Boss movement (not during stun/countdown)
  if (g.bossState !== "countdown" && g.bossState !== "stunned") {
    moveBoss(g, bossConfig, now, deltaSeconds, phase);
  }

  // Boss attacks
  if (g.bossState === "attack") {
    maybeFireSpecial(io, room, bossConfig, phase, now);
    tickBossAttacks(io, room, bossConfig, phase, now, deltaMs);
  }

  // Homing projectile steering
  steerHomingProjectiles(g, bossConfig, deltaSeconds);

  // Move projectiles + collision
  const char = g.character;
  g.projectiles = g.projectiles.filter((p) => {
    p.x += p.vx * deltaSeconds;
    p.y += p.vy * deltaSeconds;
    const dx = char.x - p.x;
    const dy = char.y - p.y;
    if (dx * dx + dy * dy < HIT_RADIUS * HIT_RADIUS) {
      takeDamage(io, room, PROJECTILE_DAMAGE, p.x, p.y);
      return false;
    }
    return p.y <= 580 && p.x >= -80 && p.x <= 1040 && p.y >= -80;
  });

  emitGameState(io, room, bossConfig);

  // Game-over check
  if (g.sharedHP <= 0 || g.bossHP <= 0) {
    room.status = "finished";
    stopLoop(room.code);
    io.to(room.code).emit("game_over", {
      winner:         g.bossHP <= 0 ? "players" : "boss",
      sharedHP:       g.sharedHP,
      bossHP:         g.bossHP,
      elapsedMs:      now - g.startedAt,
      totalWordsTyped: g.totalWordsTyped,
      players: room.players.map(({ socketId, username, wordsTyped, damageDealt }) => ({
        socketId, username, wordsTyped: wordsTyped || 0, damageDealt: damageDealt || 0,
      })),
    });
  }
};

const startGameLoop = (io, room, bossConfig) => {
  stopLoop(room.code);
  loops.set(room.code, setInterval(() => tick(io, room, bossConfig), GAME_TICK_MS));
};

module.exports = { startGameLoop, stopLoop };
