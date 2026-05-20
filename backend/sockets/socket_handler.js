/**
 * Socket handler — thin wiring layer.
 */
const {
  MAX_PLAYERS_PER_ROOM, DEFAULT_BOSS_ID,
  ROAR_DURATION_MS, SWAP_THRESHOLDS,
} = require("../game/constants");
const { getBoss, BOSS_LIST } = require("../game/bosses");
const { WEAPON_LIST, DEFAULT_WEAPON_ID, getWeapon } = require("../game/weapons");
const {
  bumpWordTimer,
  handleTypo,
  completeWord,
} = require("../game/weaponCombat");
const { emitGameState, toPublicRoomState, playerStateForClient, createInitialGameState } = require("../game/gameState");
const { startGameLoop, stopLoop } = require("../game/gameLoop");
const { resolveBossConfig } = require("../game/bossTransform");
const { takeDamage } = require("../game/helpers");
const {
  processChallengeInput,
  applyTypoBossEffect,
  resetTypoStreak,
} = require("../game/typingChallenges");

const rooms = new Map();
/** How long a disconnected player can resume the same in-progress game. */
const DISCONNECT_GRACE_MS = 5 * 60 * 1000;

const generateCode = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let c = "";
  for (let i = 0; i < 6; i++) c += chars[Math.floor(Math.random() * chars.length)];
  return c;
};
const uniqueCode = () => { let c = generateCode(); while (rooms.has(c)) c = generateCode(); return c; };

const buildPlayer = (socketId, username, role) => ({
  socketId, username, role,
  facing:         { x: 0, y: 0 },
  wordsTyped:     0,
  damageDealt:    0,
  ready:          false,
  weaponTypeId:   DEFAULT_WEAPON_ID,
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
  typedProgress: 0,
  weaponStreak: g.weaponStreak || 0,
  weaponTypeId: g.weapon?.typeId || DEFAULT_WEAPON_ID,
  wordExpiresAt: g.wordExpiresAt || 0,
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

/** After a match ends — back to lobby in the same room (keep code, boss, weapons). */
const prepareRematch = (io, room) => {
  stopLoop(room.code);
  room.game = null;
  room.status = "waiting";
  for (const p of room.players) {
    p.ready = false;
    p.wordsTyped = 0;
    p.damageDealt = 0;
    p.wantsPlayAgain = false;
    p.disconnectedAt = null;
  }
  const publicRoom = toPublicRoomState(room);
  io.to(room.code).emit("rematch_lobby", publicRoom);
  io.to(room.code).emit("room_update", publicRoom);
};

const emitPlayAgainUpdate = (io, room) => {
  const connected = room.players.filter((p) => p.socketId);
  io.to(room.code).emit("play_again_update", {
    roomCode: room.code,
    voted: room.players.map((p) => ({
      username: p.username,
      wantsPlayAgain: Boolean(p.wantsPlayAgain),
      connected: Boolean(p.socketId),
    })),
    allVoted: connected.length >= MAX_PLAYERS_PER_ROOM
      && connected.every((p) => p.wantsPlayAgain),
  });
};

const handleDisconnect = (io, socket) => {
  for (const [code, room] of rooms.entries()) {
    const idx = room.players.findIndex((p) => p.socketId === socket.id);
    if (idx === -1) continue;
    const player = room.players[idx];

    // In-progress game: keep state + game loop — client can resume_game after reconnect
    if (room.status === "in_game" && room.game) {
      player.socketId = null;
      player.disconnectedAt = Date.now();
      io.to(code).emit("player_disconnected", {
        username: player.username,
        graceMs: DISCONNECT_GRACE_MS,
      });
      return;
    }

    // Lobby: remove player as before
    room.players.splice(idx, 1);
    if (room.players.length === 0) { stopLoop(code); rooms.delete(code); return; }
    if (room.hostSocketId === socket.id) room.hostSocketId = room.players[0].socketId;
    resetRoomToWaiting(io, room);
    return;
  }
};

const startGameForRoom = (io, room, cb) => {
  const bossConfig = getBoss(room.selectedBoss);
  const carrier = room.players.find((p) => p.role === "typer" || p.role === "solo");
  const teamWeaponId = carrier?.weaponTypeId || DEFAULT_WEAPON_ID;
  if (room.gameMode !== "solo") {
    room.players.forEach((p) => { p.weaponTypeId = teamWeaponId; });
  }
  room.status = "in_game";
  room.game   = createInitialGameState(bossConfig, {
    gameMode:     room.gameMode || "coop",
    difficulty:   room.difficulty || "normal",
    weaponTypeId: teamWeaponId,
  });
  const g = room.game;
  const startPayload = buildStartPayload(room, g);
  io.to(room.code).emit("startGame", startPayload);
  emitGameState(io, room, resolveBossConfig(room));
  startGameLoop(io, room);
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

    socket.on("start_solo", ({ username, bossId, difficulty, weaponTypeId }, cb) => {
      if (!username) { cb?.({ ok: false, message: "Username required." }); return; }
      const boss = getBoss(bossId || DEFAULT_BOSS_ID);
      const weapon = getWeapon(weaponTypeId);
      const code = uniqueCode();
      const player = buildPlayer(socket.id, username, "solo");
      player.weaponTypeId = weapon.id;
      const room = {
        code,
        hostSocketId: socket.id,
        selectedBoss: boss.id,
        gameMode:  "solo",
        difficulty: difficulty || "normal",
        status:  "in_game",
        players: [player],
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

    socket.on("select_weapon", ({ code, weaponTypeId }, cb) => {
      const roomCode = (code || "").toUpperCase().trim();
      const room     = rooms.get(roomCode);
      if (!room) { cb?.({ ok: false, message: "Room not found." }); return; }
      const player = room.players.find((p) => p.socketId === socket.id);
      if (!player) { cb?.({ ok: false, message: "Not in room." }); return; }
      if (player.role !== "typer" && player.role !== "solo") {
        cb?.({ ok: false, message: "Only the typer can choose a weapon." });
        return;
      }
      const weapon = getWeapon(weaponTypeId);
      player.weaponTypeId = weapon.id;
      // Co-op loadout is shared — both players keep the same weapon when they swap roles.
      if (room.gameMode !== "solo") {
        room.players.forEach((p) => { p.weaponTypeId = weapon.id; });
      }
      if (room.game?.weapon) {
        room.game.weapon.typeId = weapon.id;
      }
      io.to(roomCode).emit("room_update", toPublicRoomState(room));
      cb?.({ ok: true, weaponTypeId: weapon.id });
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

    socket.on("play_again", ({ code }, cb) => {
      const roomCode = (code || "").toUpperCase().trim();
      const room = rooms.get(roomCode);
      if (!room) { cb?.({ ok: false, message: "Room not found." }); return; }
      const player = room.players.find((p) => p.socketId === socket.id);
      if (!player) { cb?.({ ok: false, message: "Not in room." }); return; }
      if (room.status !== "finished" && room.status !== "in_game") {
        cb?.({ ok: false, message: "No finished game to replay." });
        return;
      }

      if (room.gameMode === "solo") {
        prepareRematch(io, room);
        startGameForRoom(io, room, cb);
        return;
      }

      player.wantsPlayAgain = true;
      const connected = room.players.filter((p) => p.socketId);
      const allVoted = connected.length >= MAX_PLAYERS_PER_ROOM
        && connected.every((p) => p.wantsPlayAgain);

      emitPlayAgainUpdate(io, room);

      if (allVoted) {
        prepareRematch(io, room);
        cb?.({ ok: true, rematchLobby: true, room: toPublicRoomState(room) });
        return;
      }

      const waitingFor = connected
        .filter((p) => !p.wantsPlayAgain)
        .map((p) => p.username);
      cb?.({ ok: true, waitingFor });
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

    socket.on("resume_game", ({ roomCode, username }, cb) => {
      const code = (roomCode || "").toUpperCase().trim();
      const room = rooms.get(code);
      if (!room || room.status !== "in_game" || !room.game) {
        cb?.({ ok: false, message: "No active game found for this room." });
        return;
      }
      const player = room.players.find(
        (p) => p.username.toLowerCase() === String(username || "").toLowerCase()
      );
      if (!player) {
        cb?.({ ok: false, message: "You were not in this game." });
        return;
      }
      if (player.disconnectedAt && Date.now() - player.disconnectedAt > DISCONNECT_GRACE_MS) {
        cb?.({ ok: false, message: "Session expired. Start a new game." });
        return;
      }

      player.socketId = socket.id;
      player.disconnectedAt = null;
      const hostGone = !room.players.some((p) => p.socketId === room.hostSocketId);
      if (hostGone) room.hostSocketId = socket.id;

      socket.join(code);
      const bossConfig = getBoss(room.selectedBoss);
      startGameLoop(io, room);
      const payload = buildStartPayload(room, room.game);
      socket.emit("startGame", payload);
      emitGameState(io, room, resolveBossConfig(room));
      io.to(code).emit("player_reconnected", { username: player.username, socketId: socket.id });
      cb?.({ ok: true, roomCode: code, resumed: true });
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
      if (room.game?._playerStun?.active) { cb?.({ ok: false, reason: "stunned" }); return; }

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

      if (g._challenge) {
        const ch = processChallengeInput(io, room, player, input);
        if (ch.handled) {
          emitGameState(io, room, resolveBossConfig(room));
          cb?.({ ok: true, challenge: true });
          return;
        }
      }

      const expected = g.currentWord[g.typedProgress];
      if (input === expected) {
        g.typedProgress += 1;
        resetTypoStreak(g);
        bumpWordTimer(g);
      } else {
        g.typedProgress = input === g.currentWord[0] ? 1 : 0;
        handleTypo(g);
        io.to(code).emit("typo", { socketId: player.socketId, char: input, expected });
        const bossCfg = resolveBossConfig(room);
        if (bossCfg.typoFeed || bossCfg.typoEnrage || bossCfg.typoBomb) {
          applyTypoBossEffect(io, room, bossCfg, g);
        } else if (bossCfg.typoBacklash?.damage) {
          takeDamage(io, room, bossCfg.typoBacklash.damage, g.character.x, g.character.y);
          io.to(code).emit("typo_backlash", {
            damage: bossCfg.typoBacklash.damage,
            socketId: player.socketId,
          });
        }
      }

      if (g.typedProgress >= g.currentWord.length) {
        const bossConfig = resolveBossConfig(room);
        const result = completeWord(room, player, io);

        io.to(code).emit("word_completed", result);

        const soloMode = room.gameMode === "solo";
        const threshold = SWAP_THRESHOLDS.find(
          (t) =>
            !g.triggeredSwapThresholds.includes(t) &&
            result.prevHP > (g.bossMaxHP * t / 100) &&
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

      io.to(code).emit("typing_progress", {
        currentWord: g.currentWord,
        typedProgress: g.typedProgress,
        weaponStreak: g.weaponStreak || 0,
        wordExpiresAt: g.wordExpiresAt || 0,
        weaponTypeId: g.weapon?.typeId,
        weaponRage: g.weaponRage || 0,
        ultimateMode: Boolean(g._ultimateMode),
        currentWordPhase: g.currentWordPhase,
      });
      emitGameState(io, room, resolveBossConfig(room));
      cb?.({ ok: true });
    });

    socket.on("disconnect", () => handleDisconnect(io, socket));
  });
};

module.exports = { registerSocketHandlers };
