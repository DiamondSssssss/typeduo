const MAX_PLAYERS_PER_ROOM = 2;
const GAME_TICK_MS = 50;
const COUNTDOWN_DURATION_MS = 3000;
const ROAR_DURATION_MS = 3000;
const STUN_DURATION_MS = 1500;
const PROJECTILE_DAMAGE = 10;
const STUN_DAMAGE_MULTIPLIER = 2;
const HEAL_STREAK_THRESHOLD = 3;
const HEAL_AMOUNT = 6;
const BOSS_MAX_HP = 100;
const SHARED_MAX_HP = 100;
const SWAP_THRESHOLDS = [75, 50, 25];

const SHORT_WORDS = [
  "alpha", "brave", "crown", "delta", "ember", "frost", "giant", "hazel",
  "ivory", "jolly", "lunar", "mango", "noble", "ocean", "pixel", "quest",
  "raven", "solar", "tidal", "unity", "vivid", "whale", "young", "zebra",
  "amber", "bloom", "candle", "dream", "earth", "flame", "glide", "honey",
  "iris", "jade", "kite", "lemon", "mint", "nest", "opal", "plume",
  "rust", "sage", "tide", "void", "wave", "yarn", "zinc", "lace",
];

const MED_WORDS = [
  "knight", "thunder", "phantom", "horizon", "cascade", "monarch", "crystal",
  "twilight", "forge", "shimmer", "mystic", "dynamic", "blizzard", "voyage",
  "ancient", "kingdom", "warrior", "channel", "harmony", "journey", "balance",
  "skyline", "crimson", "scarlet", "lantern", "compass", "vortex", "bramble",
  "celebrate", "infinite", "frostbite", "midnight", "phoenix", "nebula",
  "aurora", "echelon", "glimmer", "haunting", "intense", "labyrinth",
  "moonlight", "outburst", "panorama", "quasar", "radiant", "shadow",
];

const HARD_WORDS = [
  "constellation", "synchronize", "kaleidoscope", "labyrinthine", "phenomenon",
  "encyclopedia", "thunderstorm", "obliterating", "incandescent", "metamorphosis",
  "cryptography", "juxtaposition", "extraordinary", "phosphorescent",
  "perpendicular", "serendipitous", "cataclysm", "effervescent", "luminescent",
  "renaissance", "magnanimous", "subterranean", "ubiquitous", "voracious",
  "reverberation", "orchestration", "transcendental", "incomprehensible",
  "interplanetary", "protagonist", "philosophical", "astronomical",
  "circumstantial", "indistinguishable", "extravagance", "overwhelmingly",
];

const ALL_WORDS = [...SHORT_WORDS, ...MED_WORDS, ...HARD_WORDS];
const PHASE_LABELS = ["short", "medium", "hard"];

const getPhase = (bossHP, bossMaxHP) => {
  const safeMax = Math.max(1, bossMaxHP || BOSS_MAX_HP);
  const pct = Math.max(0, Math.min(1, (bossHP || 0) / safeMax));
  if (pct > 0.66) return 0;
  if (pct > 0.33) return 1;
  return 2;
};

const getDifficultyWord = (bossHP, bossMaxHP) => {
  const phase = getPhase(bossHP, bossMaxHP);
  const pool = phase === 0 ? SHORT_WORDS : phase === 1 ? MED_WORDS : HARD_WORDS;
  return pool[Math.floor(Math.random() * pool.length)];
};

const getDifficultyPhase = (bossHP, bossMaxHP) => PHASE_LABELS[getPhase(bossHP, bossMaxHP)];

// Boss attack scaling per phase
const PROJECTILE_INTERVAL_BY_PHASE = [1000, 800, 620];
const PROJECTILE_SPEED_BY_PHASE = [200, 245, 290];
const HIT_RADIUS = 22;

const computeWordDamage = (word) => {
  const len = word?.length || 0;
  // 5 letter -> 8, 7 -> 12, 10 -> 17, 13 -> 22, 15 -> 25
  const base = Math.round(len * 1.7);
  return Math.max(6, Math.min(28, base));
};

const rooms = new Map();
const roomLoops = new Map();

const START_POSITIONS = [
  { x: 280, y: 380 },
  { x: 680, y: 380 },
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

const randomWord = () => ALL_WORDS[Math.floor(Math.random() * ALL_WORDS.length)];

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

const playerStateForClient = (player) => ({
  socketId: player.socketId,
  x: player.x,
  y: player.y,
  facing: player.facing,
  role: player.role,
  username: player.username,
  wordsTyped: player.wordsTyped || 0,
  damageDealt: player.damageDealt || 0,
});

const emitGameState = (io, room) => {
  io.to(room.code).emit("game_state", {
    roomCode: room.code,
    sharedHP: room.game.sharedHP,
    sharedMaxHP: room.game.sharedMaxHP,
    bossHP: room.game.bossHP,
    bossMaxHP: room.game.bossMaxHP,
    bossState: room.game.bossState,
    stateEndsAt: room.game.stateEndsAt,
    countdownRemaining:
      room.game.bossState === "countdown"
        ? Math.max(0, room.game.stateEndsAt - Date.now())
        : 0,
    currentWord: room.game.currentWord,
    currentWordPhase: room.game.currentWordPhase,
    typedProgress: room.game.typedProgress,
    streak: room.game.streak,
    projectiles: room.game.projectiles,
    players: room.players.map(playerStateForClient),
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

const createInitialGameState = () => {
  const startingWord = getDifficultyWord(BOSS_MAX_HP, BOSS_MAX_HP);
  const now = Date.now();
  return {
    sharedHP: SHARED_MAX_HP,
    sharedMaxHP: SHARED_MAX_HP,
    bossHP: BOSS_MAX_HP,
    bossMaxHP: BOSS_MAX_HP,
    bossState: "countdown",
    stateEndsAt: now + COUNTDOWN_DURATION_MS,
    triggeredSwapThresholds: [],
    currentWord: startingWord,
    currentWordPhase: getDifficultyPhase(BOSS_MAX_HP, BOSS_MAX_HP),
    typedProgress: 0,
    streak: 0,
    totalWordsTyped: 0,
    projectiles: [],
    nextProjectileId: 1,
    lastProjectileAt: now,
    lastTickAt: now,
    startedAt: now,
  };
};

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

  if (game.bossState === "countdown" && now >= game.stateEndsAt) {
    game.bossState = "attack";
    game.stateEndsAt = 0;
    game.lastProjectileAt = now;
    io.to(room.code).emit("battle_started", { roomCode: room.code });
    return;
  }

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
    game.lastProjectileAt = now;
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

    const phase = getPhase(activeRoom.game.bossHP, activeRoom.game.bossMaxHP);
    const projectileInterval = PROJECTILE_INTERVAL_BY_PHASE[phase];
    const projectileSpeed = PROJECTILE_SPEED_BY_PHASE[phase];

    if (
      activeRoom.game.bossState === "attack" &&
      now - activeRoom.game.lastProjectileAt >= projectileInterval
    ) {
      activeRoom.game.lastProjectileAt = now;
      // Aim a fraction of projectiles toward the runner in late phases
      const runnerForAim = activeRoom.players.find((p) => p.role === "runner");
      const aimAtRunner = phase >= 1 && runnerForAim && Math.random() < 0.35 + 0.2 * phase;
      let spawnX;
      let vx = 0;
      let vy = projectileSpeed;
      if (aimAtRunner) {
        spawnX = runnerForAim.x + (Math.random() * 60 - 30);
        const dx = runnerForAim.x - spawnX;
        const dy = runnerForAim.y - 95;
        const len = Math.max(1, Math.sqrt(dx * dx + dy * dy));
        vx = (dx / len) * projectileSpeed;
        vy = (dy / len) * projectileSpeed;
      } else {
        spawnX = Math.floor(Math.random() * 760) + 100;
      }
      activeRoom.game.projectiles.push({
        id: `${now}-${activeRoom.game.nextProjectileId}`,
        x: spawnX,
        y: 95,
        vx,
        vy,
      });
      activeRoom.game.nextProjectileId += 1;
    }

    const runner = activeRoom.players.find((player) => player.role === "runner");
    activeRoom.game.projectiles = activeRoom.game.projectiles.filter((projectile) => {
      projectile.x += (projectile.vx || 0) * deltaSeconds;
      projectile.y += projectile.vy * deltaSeconds;

      if (runner) {
        const dx = runner.x - projectile.x;
        const dy = runner.y - projectile.y;
        if (dx * dx + dy * dy < HIT_RADIUS * HIT_RADIUS) {
          activeRoom.game.sharedHP = Math.max(
            0,
            activeRoom.game.sharedHP - PROJECTILE_DAMAGE
          );
          activeRoom.game.streak = 0;
          io.to(activeRoom.code).emit("player_hit", {
            socketId: runner.socketId,
            damage: PROJECTILE_DAMAGE,
            sharedHP: activeRoom.game.sharedHP,
            x: projectile.x,
            y: projectile.y,
          });
          return false;
        }
      }

      return projectile.y <= 560 && projectile.x >= -40 && projectile.x <= 1000;
    });

    emitGameState(io, activeRoom);

    if (activeRoom.game.sharedHP <= 0 || activeRoom.game.bossHP <= 0) {
      activeRoom.status = "finished";
      stopRoomLoop(activeRoom.code);
      const elapsedMs = now - activeRoom.game.startedAt;
      io.to(activeRoom.code).emit("game_over", {
        winner: activeRoom.game.bossHP <= 0 ? "players" : "boss",
        sharedHP: activeRoom.game.sharedHP,
        bossHP: activeRoom.game.bossHP,
        elapsedMs,
        totalWordsTyped: activeRoom.game.totalWordsTyped,
        players: activeRoom.players.map((p) => ({
          socketId: p.socketId,
          username: p.username,
          wordsTyped: p.wordsTyped || 0,
          damageDealt: p.damageDealt || 0,
        })),
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

const buildPlayer = (socketId, username, role, position) => ({
  socketId,
  username,
  role,
  x: position.x,
  y: position.y,
  facing: { x: 0, y: 0 },
  wordsTyped: 0,
  damageDealt: 0,
});

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
        players: [buildPlayer(socket.id, username, "runner", START_POSITIONS[0])],
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

      room.players.push(buildPlayer(socket.id, username, "typer", START_POSITIONS[1]));
      socket.join(roomCode);
      io.to(roomCode).emit("room_update", toPublicRoomState(room));

      if (room.players.length === MAX_PLAYERS_PER_ROOM) {
        room.status = "in_game";
        room.game = createInitialGameState();
        io.to(roomCode).emit("startGame", {
          roomCode,
          players: room.players.map(playerStateForClient),
          sharedHP: room.game.sharedHP,
          sharedMaxHP: room.game.sharedMaxHP,
          bossHP: room.game.bossHP,
          bossMaxHP: room.game.bossMaxHP,
          bossState: room.game.bossState,
          stateEndsAt: room.game.stateEndsAt,
          countdownRemaining: Math.max(0, room.game.stateEndsAt - Date.now()),
          currentWord: room.game.currentWord,
          currentWordPhase: room.game.currentWordPhase,
          typedProgress: room.game.typedProgress,
          streak: 0,
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
      if (room.game?.bossState === "countdown") {
        callback?.({ ok: false, message: "Battle hasn't started yet." });
        return;
      }

      const nextX = Number(x);
      const nextY = Number(y);
      if (!Number.isFinite(nextX) || !Number.isFinite(nextY)) {
        callback?.({ ok: false, message: "Invalid position payload." });
        return;
      }

      const clampedX = Math.max(20, Math.min(940, nextX));
      const clampedY = Math.max(160, Math.min(460, nextY));
      const dx = clampedX - player.x;
      const dy = clampedY - player.y;
      if (dx !== 0 || dy !== 0) {
        const mag = Math.max(0.0001, Math.sqrt(dx * dx + dy * dy));
        player.facing = { x: dx / mag, y: dy / mag };
      }
      player.x = clampedX;
      player.y = clampedY;
      io.to(code).emit("player_moved", {
        socketId: player.socketId,
        x: player.x,
        y: player.y,
        facing: player.facing,
      });
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
      if (room.game.bossState === "countdown" || room.game.bossState === "roar") {
        callback?.({ ok: false, message: "Typing disabled." });
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
        room.game.streak = 0;
        io.to(code).emit("typo", {
          socketId: player.socketId,
          username: player.username,
          char: input,
          expected,
        });
      }

      if (room.game.typedProgress >= room.game.currentWord.length) {
        const completedWord = room.game.currentWord;
        const baseDamage = computeWordDamage(completedWord);
        const stunBonus = room.game.bossState === "stunned" ? STUN_DAMAGE_MULTIPLIER : 1;
        const damage = baseDamage * stunBonus;
        const prevBossHp = room.game.bossHP;
        room.game.bossHP = Math.max(0, room.game.bossHP - damage);

        player.wordsTyped = (player.wordsTyped || 0) + 1;
        player.damageDealt = (player.damageDealt || 0) + damage;
        room.game.totalWordsTyped += 1;
        room.game.streak += 1;

        let healed = 0;
        if (room.game.streak > 0 && room.game.streak % HEAL_STREAK_THRESHOLD === 0) {
          const before = room.game.sharedHP;
          room.game.sharedHP = Math.min(
            room.game.sharedMaxHP,
            room.game.sharedHP + HEAL_AMOUNT
          );
          healed = room.game.sharedHP - before;
        }

        room.game.currentWord = getDifficultyWord(room.game.bossHP, room.game.bossMaxHP);
        room.game.currentWordPhase = getDifficultyPhase(room.game.bossHP, room.game.bossMaxHP);
        room.game.typedProgress = 0;

        io.to(code).emit("word_completed", {
          socketId: player.socketId,
          by: player.username,
          word: completedWord,
          damage,
          baseDamage,
          stunBonus: stunBonus > 1,
          bossHP: room.game.bossHP,
          phase: room.game.currentWordPhase,
          streak: room.game.streak,
          healed,
          wordsTyped: player.wordsTyped,
        });
        maybeTriggerRoar(io, room, prevBossHp);
      }

      io.to(code).emit("typing_progress", {
        currentWord: room.game.currentWord,
        typedProgress: room.game.typedProgress,
        streak: room.game.streak,
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

module.exports = { registerSocketHandlers, randomWord };
