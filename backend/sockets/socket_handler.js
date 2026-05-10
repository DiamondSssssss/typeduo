/**
 * Socket handler — thin wiring layer.
 * All game logic lives in backend/game/*.
 */
const { MAX_PLAYERS_PER_ROOM, DEFAULT_BOSS_ID, HEAL_STREAK_THRESHOLD, HEAL_AMOUNT, STUN_DAMAGE_MULTIPLIER } = require("../game/constants");
const { getDifficultyWord, getDifficultyPhase, computeWordDamage } = require("../game/words");
const { getBoss, BOSS_LIST } = require("../game/bosses");
const { emitGameState, toPublicRoomState, playerStateForClient, createInitialGameState } = require("../game/gameState");
const { startGameLoop, stopLoop } = require("../game/gameLoop");
const { applyAttack } = require("../game/bossAI");

// ── Room store ────────────────────────────────────────────────────────────────
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

// ── Socket wiring ─────────────────────────────────────────────────────────────
const registerSocketHandlers = (io) => {
  io.on("connection", (socket) => {

    // ── Room management ───────────────────────────────────────────────────────

    socket.on("create_room", ({ username }, cb) => {
      if (!username) { cb?.({ ok: false, message: "Username required." }); return; }
      const code = uniqueCode();
      const room = {
        code,
        hostSocketId: socket.id,
        selectedBoss: DEFAULT_BOSS_ID,
        status:  "waiting",
        players: [buildPlayer(socket.id, username, "runner")],
        game:    null,
      };
      rooms.set(code, room);
      socket.join(code);
      cb?.({ ok: true, room: toPublicRoomState(room), bossList: BOSS_LIST });
      io.to(code).emit("room_update", toPublicRoomState(room));
    });

    socket.on("join_room", ({ code, username }, cb) => {
      const roomCode = (code || "").toUpperCase().trim();
      const room     = rooms.get(roomCode);
      if (!room) { cb?.({ ok: false, message: "Room not found." }); return; }
      if (room.players.length >= MAX_PLAYERS_PER_ROOM) { cb?.({ ok: false, message: "Room is full." }); return; }
      const taken = room.players.some((p) => p.username.toLowerCase() === (username || "").toLowerCase());
      if (!username || taken) { cb?.({ ok: false, message: taken ? "Username taken." : "Username required." }); return; }

      room.players.push(buildPlayer(socket.id, username, "typer"));
      socket.join(roomCode);
      io.to(roomCode).emit("room_update", toPublicRoomState(room));

      if (room.players.length === MAX_PLAYERS_PER_ROOM) {
        const bossConfig = getBoss(room.selectedBoss);
        room.status  = "in_game";
        room.game    = createInitialGameState(bossConfig);
        const g      = room.game;
        const startPayload = {
          roomCode,
          bossId:   room.selectedBoss,
          players:  room.players.map(playerStateForClient),
          sharedHP: g.sharedHP, sharedMaxHP: g.sharedMaxHP,
          bossHP:   g.bossHP,   bossMaxHP:   g.bossMaxHP,
          bossState: g.bossState,
          stateEndsAt: g.stateEndsAt,
          countdownRemaining: Math.max(0, g.stateEndsAt - Date.now()),
          currentWord: g.currentWord, currentWordPhase: g.currentWordPhase,
          typedProgress: 0, streak: 0,
          character: g.character,
          boss: { x: g.boss.x, y: g.boss.y, attackType: g.boss.attackType, windingUp: false, windUpRemaining: 0, columnState: null, phase: 0 },
        };
        io.to(roomCode).emit("startGame", startPayload);
        emitGameState(io, room, bossConfig);
        startGameLoop(io, room, bossConfig);
      }
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

    // ── In-game events ────────────────────────────────────────────────────────

    socket.on("player_move", ({ roomCode, x, y }, cb) => {
      const code = (roomCode || "").toUpperCase().trim();
      const room = rooms.get(code);
      if (!room || room.status !== "in_game") { cb?.({ ok: false }); return; }
      const player = room.players.find((p) => p.socketId === socket.id);
      if (!player || player.role !== "runner") { cb?.({ ok: false }); return; }
      if (room.game?.bossState === "countdown") { cb?.({ ok: false }); return; }

      const cx = Math.max(20, Math.min(940, Number(x) || 0));
      const cy = Math.max(160, Math.min(460, Number(y) || 0));
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
      if (!player || player.role !== "typer") { cb?.({ ok: false }); return; }
      const g = room.game;
      if (g.bossState === "countdown" || g.bossState === "roar") { cb?.({ ok: false }); return; }
      const input = String(char || "").toLowerCase();
      if (input.length !== 1 || !/[a-z]/.test(input)) { cb?.({ ok: false }); return; }

      const expected = g.currentWord[g.typedProgress];
      if (input === expected) {
        g.typedProgress += 1;
      } else {
        g.typedProgress = input === g.currentWord[0] ? 1 : 0;
        g.streak = 0;
        io.to(code).emit("typo", { socketId: player.socketId, char: input, expected });
      }

      if (g.typedProgress >= g.currentWord.length) {
        const bossConfig  = getBoss(room.selectedBoss);
        const completedWord = g.currentWord;
        const base     = computeWordDamage(completedWord);
        const mult     = g.bossState === "stunned" ? STUN_DAMAGE_MULTIPLIER : 1;
        const damage   = base * mult;
        const prevHP   = g.bossHP;
        g.bossHP       = Math.max(0, g.bossHP - damage);
        player.wordsTyped++;
        player.damageDealt += damage;
        g.totalWordsTyped++;
        g.streak++;

        let healed = 0;
        if (g.streak % HEAL_STREAK_THRESHOLD === 0) {
          const before = g.sharedHP;
          g.sharedHP   = Math.min(g.sharedMaxHP, g.sharedHP + HEAL_AMOUNT);
          healed       = g.sharedHP - before;
        }

        g.currentWord      = getDifficultyWord(g.bossHP, g.bossMaxHP);
        g.currentWordPhase = getDifficultyPhase(g.bossHP, g.bossMaxHP);
        g.typedProgress    = 0;

        io.to(code).emit("word_completed", {
          socketId: player.socketId, by: player.username,
          word: completedWord, damage, baseDamage: base,
          stunBonus: mult > 1, bossHP: g.bossHP,
          streak: g.streak, healed, wordsTyped: player.wordsTyped,
        });

        // Roar check (maybeTriggerRoar is in gameLoop — call inline)
        const { SWAP_THRESHOLDS } = require("../game/constants");
        const threshold = SWAP_THRESHOLDS.find(
          (t) => !g.triggeredSwapThresholds.includes(t) && prevHP > (g.bossMaxHP * t / 100) && g.bossHP <= (g.bossMaxHP * t / 100)
        );
        if (threshold && g.bossState !== "roar" && g.bossState !== "stunned") {
          const { ROAR_DURATION_MS } = require("../game/constants");
          g.triggeredSwapThresholds.push(threshold);
          g.bossState   = "roar";
          g.stateEndsAt = Date.now() + ROAR_DURATION_MS;
          g.projectiles = [];
          io.to(code).emit("boss_roar_start", { threshold, countdownMs: ROAR_DURATION_MS });
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
