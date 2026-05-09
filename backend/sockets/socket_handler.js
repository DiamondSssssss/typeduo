const MAX_PLAYERS_PER_ROOM = 2;
const GAME_TICK_MS = 50;
const PROJECTILE_SPEED = 220;
const PROJECTILE_INTERVAL_MS = 900;
const PROJECTILE_DAMAGE = 10;
const WORD_DAMAGE = 10;
const ROAR_DURATION_MS = 3000;
const STUN_DURATION_MS = 1200;
const BOSS_MAX_HP = 100;
const SWAP_THRESHOLDS = [75, 50, 25];
const WORDS = [
  "alpha",
  "brave",
  "crown",
  "delta",
  "ember",
  "frost",
  "giant",
  "hazel",
  "ivory",
  "jolly",
  "knight",
  "lunar",
  "mango",
  "noble",
  "ocean",
  "pixel",
  "quest",
  "raven",
  "solar",
  "tidal",
  "unity",
  "vivid",
  "whale",
  "xenon",
  "young",
  "zebra",
];

const rooms = new Map();
const roomLoops = new Map();

const START_POSITIONS = [
  { x: 260, y: 430 },
  { x: 700, y: 430 },
];

const generateRoomCode = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i += 1) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
};

const createUniqueRoomCode = () => {
  let code = generateRoomCode();
  while (rooms.has(code)) code = generateRoomCode();
  return code;
};

const randomWord = () => WORDS[Math.floor(Math.random() * WORDS.length)];

const toPublicRoomState = (room) => ({
  code: room.code,
  hostSocketId: room.hostSocketId,
  players: room.players.map((player) => ({
    socketId: player.socketId,
    username: player.username,
    role: player.role,
  })),
  status: room.status,
});

const emitGameState = (io, room) => {
  io.to(room.code).emit("game_state", {
    roomCode: room.code,
    sharedHP: room.game.sharedHP,
    bossHP: room.game.bossHP,
    bossMaxHP: room.game.bossMaxHP,
    bossState: room.game.bossState,
    currentWord: room.game.currentWord,
    typedProgress: room.game.typedProgress,
    projectiles: room.game.projectiles,
    players: room.players.map((player) => ({
      socketId: player.socketId,
      x: player.x,
      y: player.y,
      role: player.role,
      username: player.username,
    })),
  });
};

const stopRoomLoop = (roomCode) => {
  const loop = roomLoops.get(roomCode);
  if (!loop) return;
  clearInterval(loop);
  roomLoops.delete(roomCode);
};

const resetRoomToWaiting = (io, room) => {
  room.status = "waiting";
  room.game = null;
  stopRoomLoop(room.code);
  io.to(room.code).emit("room_update", toPublicRoomState(room));
};

const cleanupRoom = (roomCode) => {
  stopRoomLoop(roomCode);
  rooms.delete(roomCode);
};

const createInitialGameState = () => ({
  sharedHP: 100,
  bossHP: BOSS_MAX_HP,
  bossMaxHP: BOSS_MAX_HP,
  bossState: "attack",
  stateEndsAt: 0,
  triggeredSwapThresholds: [],
  currentWord: randomWord(),
  typedProgress: 0,
  projectiles: [],
  nextProjectileId: 1,
  lastProjectileAt: Date.now(),
  lastTickAt: Date.now(),
});

const swapRoles = (players) => {
  players.forEach((player) => {
    player.role = player.role === "runner" ? "typer" : "runner";
  });
};

const maybeTriggerRoar = (io, room, prevBossHp) => {
  const game = room.game;
  if (!game || game.bossState === "roar" || game.bossState === "stunned") return;

  const reachedThreshold = SWAP_THRESHOLDS.find(
    (threshold) =>
      !game.triggeredSwapThresholds.includes(threshold) &&
      prevBossHp > threshold &&
      game.bossHP <= threshold
  );
  if (!reachedThreshold) return;

  game.triggeredSwapThresholds.push(reachedThreshold);
  game.bossState = "roar";
  game.stateEndsAt = Date.now() + ROAR_DURATION_MS;
  game.projectiles = [];

  io.to(room.code).emit("boss_roar_start", {
    threshold: reachedThreshold,
    countdownMs: ROAR_DURATION_MS,
  });
};

const advanceBossState = (io, room, now) => {
  const game = room.game;
  if (!game) return;

  if (game.bossState === "roar" && now >= game.stateEndsAt) {
    swapRoles(room.players);
    game.bossState = "stunned";
    game.stateEndsAt = now + STUN_DURATION_MS;

    io.to(room.code).emit("roles_swapped", {
      players: room.players.map((player) => ({
        socketId: player.socketId,
        username: player.username,
        role: player.role,
      })),
    });
    io.to(room.code).emit("room_update", toPublicRoomState(room));
    return;
  }

  if (game.bossState === "stunned" && now >= game.stateEndsAt) {
    game.bossState = "attack";
    game.stateEndsAt = 0;
  }
};

const startGameLoop = (io, room) => {
  const tick = () => {
    const activeRoom = rooms.get(room.code);
    if (!activeRoom || activeRoom.status !== "in_game" || !activeRoom.game) {
      stopRoomLoop(room.code);
      return;
    }

    const now = Date.now();
    const deltaSeconds = (now - activeRoom.game.lastTickAt) / 1000;
    activeRoom.game.lastTickAt = now;
    advanceBossState(io, activeRoom, now);

    if (
      activeRoom.game.bossState === "attack" &&
      now - activeRoom.game.lastProjectileAt >= PROJECTILE_INTERVAL_MS
    ) {
      activeRoom.game.lastProjectileAt = now;
      activeRoom.game.projectiles.push({
        id: `${now}-${activeRoom.game.nextProjectileId}`,
        x: Math.floor(Math.random() * 760) + 100,
        y: 95,
        vy: PROJECTILE_SPEED,
      });
      activeRoom.game.nextProjectileId += 1;
    }

    const runner = activeRoom.players.find((player) => player.role === "runner");
    activeRoom.game.projectiles = activeRoom.game.projectiles.filter((projectile) => {
      projectile.y += projectile.vy * deltaSeconds;

      if (runner) {
        const hitX = Math.abs(runner.x - projectile.x) < 18;
        const hitY = Math.abs(runner.y - projectile.y) < 18;
        if (hitX && hitY) {
          activeRoom.game.sharedHP = Math.max(
            0,
            activeRoom.game.sharedHP - PROJECTILE_DAMAGE
          );
          return false;
        }
      }

      return projectile.y <= 560;
    });

    emitGameState(io, activeRoom);

    if (activeRoom.game.sharedHP <= 0 || activeRoom.game.bossHP <= 0) {
      activeRoom.status = "finished";
      stopRoomLoop(activeRoom.code);
      io.to(activeRoom.code).emit("game_over", {
        winner: activeRoom.game.bossHP <= 0 ? "players" : "boss",
        sharedHP: activeRoom.game.sharedHP,
        bossHP: activeRoom.game.bossHP,
      });
    }
  };

  stopRoomLoop(room.code);
  roomLoops.set(room.code, setInterval(tick, GAME_TICK_MS));
};

const handleDisconnect = (io, socket) => {
  for (const [code, room] of rooms.entries()) {
    const playerIndex = room.players.findIndex((p) => p.socketId === socket.id);
    if (playerIndex === -1) continue;

    room.players.splice(playerIndex, 1);
    if (room.players.length === 0) {
      cleanupRoom(code);
      return;
    }

    if (room.hostSocketId === socket.id) {
      room.hostSocketId = room.players[0].socketId;
    }

    resetRoomToWaiting(io, room);
    return;
  }
};

const registerSocketHandlers = (io) => {
  io.on("connection", (socket) => {
    socket.on("create_room", ({ username }, callback) => {
      if (!username) {
        callback?.({ ok: false, message: "Username is required." });
        return;
      }

      const code = createUniqueRoomCode();
      const room = {
        code,
        hostSocketId: socket.id,
        status: "waiting",
        players: [
          {
            socketId: socket.id,
            username,
            role: "runner",
            x: START_POSITIONS[0].x,
            y: START_POSITIONS[0].y,
          },
        ],
        game: null,
      };

      rooms.set(code, room);
      socket.join(code);
      callback?.({ ok: true, room: toPublicRoomState(room) });
      io.to(code).emit("room_update", toPublicRoomState(room));
    });

    socket.on("join_room", ({ code, username }, callback) => {
      const roomCode = (code || "").toUpperCase().trim();
      const room = rooms.get(roomCode);
      if (!room) {
        callback?.({ ok: false, message: "Room not found." });
        return;
      }
      if (room.players.length >= MAX_PLAYERS_PER_ROOM) {
        callback?.({ ok: false, message: "Room is full." });
        return;
      }

      const hasSameName = room.players.some(
        (player) => player.username.toLowerCase() === (username || "").toLowerCase()
      );
      if (!username || hasSameName) {
        callback?.({
          ok: false,
          message: hasSameName
            ? "Username already exists in room."
            : "Username is required.",
        });
        return;
      }

      room.players.push({
        socketId: socket.id,
        username,
        role: "typer",
        x: START_POSITIONS[1].x,
        y: START_POSITIONS[1].y,
      });
      socket.join(roomCode);
      io.to(roomCode).emit("room_update", toPublicRoomState(room));

      if (room.players.length === MAX_PLAYERS_PER_ROOM) {
        room.status = "in_game";
        room.game = createInitialGameState();
        io.to(roomCode).emit("startGame", {
          roomCode,
          players: room.players,
          sharedHP: room.game.sharedHP,
          bossHP: room.game.bossHP,
          bossState: room.game.bossState,
          currentWord: room.game.currentWord,
          typedProgress: room.game.typedProgress,
        });
        emitGameState(io, room);
        startGameLoop(io, room);
      }

      callback?.({ ok: true, room: toPublicRoomState(room) });
    });

    socket.on("player_move", ({ roomCode, x, y }, callback) => {
      const code = (roomCode || "").toUpperCase().trim();
      const room = rooms.get(code);
      if (!room || room.status !== "in_game") {
        callback?.({ ok: false, message: "Room not in game state." });
        return;
      }

      const player = room.players.find((p) => p.socketId === socket.id);
      if (!player) {
        callback?.({ ok: false, message: "Player not in room." });
        return;
      }
      if (player.role !== "runner") {
        callback?.({ ok: false, message: "Only runner can move." });
        return;
      }

      const nextX = Number(x);
      const nextY = Number(y);
      if (!Number.isFinite(nextX) || !Number.isFinite(nextY)) {
        callback?.({ ok: false, message: "Invalid position payload." });
        return;
      }

      player.x = Math.max(20, Math.min(940, nextX));
      player.y = Math.max(100, Math.min(520, nextY));
      io.to(code).emit("player_moved", { socketId: player.socketId, x: player.x, y: player.y });
      callback?.({ ok: true });
    });

    socket.on("typer_input", ({ roomCode, char }, callback) => {
      const code = (roomCode || "").toUpperCase().trim();
      const room = rooms.get(code);
      if (!room || room.status !== "in_game" || !room.game) {
        callback?.({ ok: false, message: "Room not in game state." });
        return;
      }

      const player = room.players.find((p) => p.socketId === socket.id);
      if (!player || player.role !== "typer") {
        callback?.({ ok: false, message: "Only typer can submit letters." });
        return;
      }
      if (room.game.bossState === "roar" || room.game.bossState === "stunned") {
        callback?.({ ok: false, message: "Typing disabled during roar/stunned." });
        return;
      }

      const input = String(char || "").toLowerCase();
      if (input.length !== 1 || !/[a-z]/.test(input)) {
        callback?.({ ok: false, message: "Only single alphabet characters allowed." });
        return;
      }

      const expected = room.game.currentWord[room.game.typedProgress];
      if (input === expected) {
        room.game.typedProgress += 1;
      } else {
        room.game.typedProgress = input === room.game.currentWord[0] ? 1 : 0;
      }

      if (room.game.typedProgress >= room.game.currentWord.length) {
        const completedWord = room.game.currentWord;
        const prevBossHp = room.game.bossHP;
        room.game.bossHP = Math.max(0, room.game.bossHP - WORD_DAMAGE);
        room.game.currentWord = randomWord();
        room.game.typedProgress = 0;
        io.to(code).emit("word_completed", {
          by: player.username,
          word: completedWord,
          damage: WORD_DAMAGE,
          bossHP: room.game.bossHP,
        });
        maybeTriggerRoar(io, room, prevBossHp);
      }

      io.to(code).emit("typing_progress", {
        currentWord: room.game.currentWord,
        typedProgress: room.game.typedProgress,
      });
      emitGameState(io, room);
      callback?.({ ok: true });
    });

    socket.on("leave_room", ({ code }, callback) => {
      const roomCode = (code || "").toUpperCase().trim();
      const room = rooms.get(roomCode);
      if (!room) {
        callback?.({ ok: false, message: "Room not found." });
        return;
      }

      const playerIndex = room.players.findIndex((p) => p.socketId === socket.id);
      if (playerIndex === -1) {
        callback?.({ ok: false, message: "Player is not in this room." });
        return;
      }

      room.players.splice(playerIndex, 1);
      socket.leave(roomCode);

      if (room.players.length === 0) {
        cleanupRoom(roomCode);
        callback?.({ ok: true });
        return;
      }

      if (room.hostSocketId === socket.id) {
        room.hostSocketId = room.players[0].socketId;
      }

      resetRoomToWaiting(io, room);
      callback?.({ ok: true, room: toPublicRoomState(room) });
    });

    socket.on("disconnect", () => handleDisconnect(io, socket));
  });
};

module.exports = { registerSocketHandlers };
