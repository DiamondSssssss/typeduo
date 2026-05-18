/**
 * Socket handler — thin wiring layer.
 */
const {
  MAX_PLAYERS_PER_ROOM, DEFAULT_BOSS_ID,
  STUN_DAMAGE_MULTIPLIER, STREAK_TIERS, FURY_REFRESH_EVERY, FURY_REFRESH_HEAL,
  ROAR_DURATION_MS, SWAP_THRESHOLDS,
} = require("../game/constants");
const { getDifficultyWord, getDifficultyPhase, computeWordDamage } = require("../game/words");
const { getBoss, BOSS_LIST } = require("../game/bosses");
const { emitGameState, toPublicRoomState, playerStateForClient, createInitialGameState } = require("../game/gameState");
const { startGameLoop, stopLoop } = require("../game/gameLoop");
const { applyBossWordDamage } = require("../game/bossDamage");

const rooms = new Map();

const generateCode = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let c = "";
  for (let i = 0; i < 6; i++) c += chars[Math.floor(Math.random() * chars.length)];
  return c;
};
const uniqueCode = () => { let c = generateCode(); while (rooms.has(c)) c = generateCode(); return c; };

const buildPlayer = (socketId, username, role) => ({
  socketId, username, role,
  facing:      { x: 0, y: 0 },
  wordsTyped:  0,
  damageDealt: 0,
  ready:       false,
});

const buildStartPayload = (room, g) => ({
  roomCode: room.code,
  gameMode: room.gameMode || "coop",
  difficulty: room.difficulty || "normal",
  bossId:   room.selectedBoss,
  players:  room.players.map(playerStateForClient),
  sharedHP: g.sharedHP, sharedMaxHP: g.sharedMaxHP,
  bossHP:   g.bossHP,   bossMaxHP:   g.bossMaxHP,
  bossShield: g.bossShield || 0, bossShieldMax: g.bossShieldMax || 0,
  bossState:          g.bossState,
  stateEndsAt:        g.stateEndsAt,
  countdownRemaining: Math.max(0, g.stateEndsAt - Date.now()),
  currentWord: g.currentWord, currentWordPhase: g.currentWordPhase,
  typedProgress: 0, streak: 0,
  character: g.character,
  boss: { x: g.boss.x, y: g.boss.y, attackType: g.boss.attackType, windingUp: false, windUpRemaining: 0, columnState: null, phase: 0 },
  weaponHeld: g.weapon?.held || false, weaponX: g.weapon.x, weaponY: g.weapon.y,
});

const resetRoomToWaiting = (io, room) => {
  room.status = "waiting";
  room.game   = null;
  stopLoop(room.code);
  io.to(room.code).emit("room_update", toPublicRoomState(room));
};

const handleDisconnect = (io, socket) => {
  for (const [code, room] of rooms.entries()) {
    const idx = room.players.findIndex((p) => p.socketId === socket.id);
    if (idx === -1) continue;
    room.players.splice(idx, 1);
    if (room.players.length === 0) { stopLoop(code); rooms.delete(code); return; }
    if (room.hostSocketId === socket.id) room.hostSocketId = room.players[0].socketId;
    resetRoomToWaiting(io, room);
    return;
  }
};

const startGameForRoom = (io, room, cb) => {
  const bossConfig = getBoss(room.selectedBoss);
  room.status = "in_game";
  room.game   = createInitialGameState(bossConfig, {
    gameMode:   room.gameMode || "coop",
    difficulty: room.difficulty || "normal",
  });
  const g = room.game;
  const startPayload = buildStartPayload(room, g);
  io.to(room.code).emit("startGame", startPayload);
  emitGameState(io, room, bossConfig);
  startGameLoop(io, room, bossConfig);
  cb?.({ ok: true });
};

const registerSocketHandlers = (io) => {
  io.on("connection", (socket) => {

    socket.on("create_room", ({ username }, cb) => {
      if (!username) { cb?.({ ok: false, message: "Username required." }); return; }
      const code = uniqueCode();
      const room = {
        code,
        hostSocketId: socket.id,
        selectedBoss: DEFAULT_BOSS_ID,
        gameMode:  "coop",
        difficulty: "normal",
        status:  "waiting",
        players: [buildPlayer(socket.id, username, "runner")],
        game:    null,
      };
      rooms.set(code, room);
      socket.join(code);
      cb?.({ ok: true, room: toPublicRoomState(room), bossList: BOSS_LIST });
      io.to(code).emit("room_update", toPublicRoomState(room));
    });

    socket.on("start_solo", ({ username, bossId, difficulty }, cb) => {
      if (!username) { cb?.({ ok: false, message: "Username required." }); return; }
      const boss = getBoss(bossId || DEFAULT_BOSS_ID);
      const code = uniqueCode();
      const room = {
        code,
        hostSocketId: socket.id,
        selectedBoss: boss.id,
        gameMode:  "solo",
        difficulty: difficulty || "normal",
        status:  "in_game",
        players: [buildPlayer(socket.id, username, "solo")],
        game:    null,
      };
      rooms.set(code, room);
      socket.join(code);
      startGameForRoom(io, room, cb);
    });

    socket.on("join_room", ({ code, username }, cb) => {
      const roomCode = (code || "").toUpperCase().trim();
      const room     = rooms.get(roomCode);
      if (!room) { cb?.({ ok: false, message: "Room not found." }); return; }
      if (room.gameMode === "solo") { cb?.({ ok: false, message: "Solo room cannot be joined." }); return; }
      if (room.players.length >= MAX_PLAYERS_PER_ROOM) { cb?.({ ok: false, message: "Room is full." }); return; }
      const taken = room.players.some((p) => p.username.toLowerCase() === (username || "").toLowerCase());
      if (!username || taken) { cb?.({ ok: false, message: taken ? "Username taken." : "Username required." }); return; }

      room.players.push(buildPlayer(socket.id, username, "typer"));
      socket.join(roomCode);
      io.to(roomCode).emit("room_update", toPublicRoomState(room));
      cb?.({ ok: true, room: toPublicRoomState(room), bossList: BOSS_LIST });
    });

    socket.on("select_boss", ({ code, bossId }, cb) => {
      const roomCode = (code || "").toUpperCase().trim();
      const room     = rooms.get(roomCode);
      if (!room) { cb?.({ ok: false, message: "Room not found." }); return; }
      if (room.hostSocketId !== socket.id) { cb?.({ ok: false, message: "Only host can choose boss." }); return; }
      if (room.status !== "waiting") { cb?.({ ok: false, message: "Game already started." }); return; }
      const boss = getBoss(bossId);
      room.selectedBoss = boss.id;
      io.to(roomCode).emit("room_update", toPublicRoomState(room));
      cb?.({ ok: true, selectedBoss: boss.id });
    });

    socket.on("player_ready", ({ code }, cb) => {
      const roomCode = (code || "").toUpperCase().trim();
      const room     = rooms.get(roomCode);
      if (!room) { cb?.({ ok: false, message: "Room not found." }); return; }
      if (room.status !== "waiting") { cb?.({ ok: false }); return; }
      const player = room.players.find((p) => p.socketId === socket.id);
      if (!player) { cb?.({ ok: false, message: "Not in room." }); return; }
      player.ready = !player.ready;
      io.to(roomCode).emit("room_update", toPublicRoomState(room));
      cb?.({ ok: true, ready: player.ready });
    });

    socket.on("start_game", ({ code }, cb) => {
      const roomCode = (code || "").toUpperCase().trim();
      const room     = rooms.get(roomCode);
      if (!room) { cb?.({ ok: false, message: "Room not found." }); return; }
      if (room.hostSocketId !== socket.id) { cb?.({ ok: false, message: "Only the host can start." }); return; }
      if (room.status !== "waiting") { cb?.({ ok: false, message: "Game already started." }); return; }
      if (room.players.length < MAX_PLAYERS_PER_ROOM) { cb?.({ ok: false, message: "Still waiting for a player." }); return; }
      const nonHost = room.players.filter((p) => p.socketId !== room.hostSocketId);
      if (!nonHost.every((p) => p.ready)) { cb?.({ ok: false, message: "Not all players are ready." }); return; }
      startGameForRoom(io, room, cb);
    });

    socket.on("leave_room", ({ code }, cb) => {
      const roomCode = (code || "").toUpperCase().trim();
      const room     = rooms.get(roomCode);
      if (!room) { cb?.({ ok: false, message: "Room not found." }); return; }
      const idx = room.players.findIndex((p) => p.socketId === socket.id);
      if (idx === -1) { cb?.({ ok: false, message: "Not in room." }); return; }
      room.players.splice(idx, 1);
      socket.leave(roomCode);
      if (room.players.length === 0) { stopLoop(roomCode); rooms.delete(roomCode); cb?.({ ok: true }); return; }
      if (room.hostSocketId === socket.id) room.hostSocketId = room.players[0].socketId;
      resetRoomToWaiting(io, room);
      cb?.({ ok: true, room: toPublicRoomState(room) });
    });

    socket.on("player_move", ({ roomCode, x, y }, cb) => {
      const code = (roomCode || "").toUpperCase().trim();
      const room = rooms.get(code);
      if (!room || room.status !== "in_game") { cb?.({ ok: false }); return; }
      const player = room.players.find((p) => p.socketId === socket.id);
      if (!player || (player.role !== "runner" && player.role !== "solo")) { cb?.({ ok: false }); return; }
      if (room.game?.bossState === "countdown") { cb?.({ ok: false }); return; }

      const mult = room.game.moveSpeedMult || 1;
      const cx = Math.max(30, Math.min(1250, Number(x) || 0));
      const cy = Math.max(200, Math.min(590, Number(y) || 0));
      const ddx = cx - room.game.character.x;
      const ddy = cy - room.game.character.y;
      if (ddx !== 0 || ddy !== 0) {
        const mag = Math.max(0.0001, Math.sqrt(ddx * ddx + ddy * ddy));
        player.facing = { x: ddx / mag, y: ddy / mag };
      }
      room.game.character.x = cx;
      room.game.character.y = cy;
      io.to(code).emit("character_moved", { x: cx, y: cy, facing: player.facing });
      cb?.({ ok: true });
    });

    socket.on("typer_input", ({ roomCode, char }, cb) => {
      const code = (roomCode || "").toUpperCase().trim();
      const room = rooms.get(code);
      if (!room || room.status !== "in_game" || !room.game) { cb?.({ ok: false }); return; }
      const player = room.players.find((p) => p.socketId === socket.id);
      if (!player || (player.role !== "typer" && player.role !== "solo")) { cb?.({ ok: false }); return; }
      const g = room.game;
      if (g.bossState === "countdown" || g.bossState === "roar") { cb?.({ ok: false }); return; }
      const input = String(char || "").toLowerCase();
      if (input.length !== 1 || !/[a-z]/.test(input)) { cb?.({ ok: false }); return; }

      if (!g.weapon?.held) {
        io.to(code).emit("no_weapon", { socketId: player.socketId });
        cb?.({ ok: false, reason: "no_weapon" });
        return;
      }

      const expected = g.currentWord[g.typedProgress];
      if (input === expected) {
        g.typedProgress += 1;
      } else {
        g.typedProgress    = input === g.currentWord[0] ? 1 : 0;
        g.streak           = 0;
        g.streakMult       = 1;
        g.streakMultWords  = 0;
        g.furyActive       = false;
        io.to(code).emit("typo", { socketId: player.socketId, char: input, expected });
      }

      if (g.typedProgress >= g.currentWord.length) {
        const bossConfig    = getBoss(room.selectedBoss);
        const completedWord = g.currentWord;
        const base          = computeWordDamage(completedWord);
        const stunMult   = g.bossState === "stunned" ? STUN_DAMAGE_MULTIPLIER : 1;
        const streakMult = g.streakMultWords > 0 ? g.streakMult : 1;
        const damage     = Math.round(base * stunMult * streakMult);

        if (g.streakMultWords > 0) {
          g.streakMultWords--;
          if (g.streakMultWords === 0) {
            g.streakMult = 1;
            if (g.streak < 10) g.furyActive = false;
          }
        }

        const prevHP = g.bossHP;
        const prevShield = g.bossShield || 0;
        applyBossWordDamage(g, damage);
        player.wordsTyped++;
        player.damageDealt += damage;
        g.totalWordsTyped++;
        g.streak++;

        let healed = 0;
        let streakEvent = null;
        const tier = STREAK_TIERS.find((t) => t.at === g.streak);
        if (tier) {
          healed = tier.heal;
          streakEvent = tier.event;
          if (tier.mult > 1) { g.streakMult = tier.mult; g.streakMultWords = tier.multWords; }
          if (tier.event === "fury") g.furyActive = true;
        } else if (g.streak > 10 && (g.streak - 10) % FURY_REFRESH_EVERY === 0) {
          healed = FURY_REFRESH_HEAL;
          streakEvent = "fury";
          g.streakMult = 2.0;
          g.streakMultWords = 3;
          g.furyActive = true;
        }
        if (healed > 0) g.sharedHP = Math.min(g.sharedMaxHP, g.sharedHP + healed);

        g.currentWord      = getDifficultyWord(g.bossHP, g.bossMaxHP);
        g.currentWordPhase = getDifficultyPhase(g.bossHP, g.bossMaxHP);
        g.typedProgress    = 0;

        io.to(code).emit("word_completed", {
          socketId: player.socketId, by: player.username, word: completedWord,
          damage, baseDamage: base,
          appliedMult: Math.round(stunMult * streakMult * 10) / 10,
          stunBonus: stunMult > 1, streakBonus: streakMult > 1,
          bossHP: g.bossHP, bossShield: g.bossShield || 0,
          shieldBroken: prevShield > 0 && (g.bossShield || 0) === 0,
          streak: g.streak, healed, streakEvent,
          streakMult: g.streakMult, streakMultWords: g.streakMultWords,
          furyActive: g.furyActive, wordsTyped: player.wordsTyped,
        });

        const soloMode = room.gameMode === "solo";
        const threshold = SWAP_THRESHOLDS.find(
          (t) =>
            !g.triggeredSwapThresholds.includes(t) &&
            prevHP > (g.bossMaxHP * t / 100) &&
            g.bossHP <= (g.bossMaxHP * t / 100)
        );
        if (threshold && g.bossState !== "roar" && g.bossState !== "stunned") {
          g.triggeredSwapThresholds.push(threshold);
          g.bossState   = "roar";
          g.stateEndsAt = Date.now() + ROAR_DURATION_MS;
          g.projectiles = [];
          io.to(code).emit("boss_roar_start", { threshold, countdownMs: ROAR_DURATION_MS, soloMode });
        }
      }

      io.to(code).emit("typing_progress", { currentWord: g.currentWord, typedProgress: g.typedProgress, streak: g.streak });
      emitGameState(io, room, getBoss(room.selectedBoss));
      cb?.({ ok: true });
    });

    socket.on("disconnect", () => handleDisconnect(io, socket));
  });
};

module.exports = { registerSocketHandlers };
