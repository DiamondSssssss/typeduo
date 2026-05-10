const { getDifficultyWord, getDifficultyPhase, getPhase } = require("./words");
const { SHARED_MAX_HP, COUNTDOWN_DURATION_MS } = require("./constants");

const toPublicRoomState = (room) => ({
  code:         room.code,
  hostSocketId: room.hostSocketId,
  selectedBoss: room.selectedBoss,
  players:      room.players.map(({ socketId, username, role }) => ({ socketId, username, role })),
  status:       room.status,
});

const playerStateForClient = (p) => ({
  socketId:    p.socketId,
  username:    p.username,
  role:        p.role,
  facing:      p.facing,
  wordsTyped:  p.wordsTyped  || 0,
  damageDealt: p.damageDealt || 0,
});

const buildBossStateForClient = (boss, bossConfig) => ({
  x:           boss.x,
  y:           boss.y,
  attackType:  boss.windingUp ? (boss.windUpAttack || boss.attackType) : boss.attackType,
  windingUp:   boss.windingUp || false,
  windUpAttack: boss.windUpAttack || null,
  windUpRemaining: boss.windingUp ? Math.max(0, boss.windUpUntil - Date.now()) : 0,
  columnState: boss.columnState || null,
  columnX:     boss.columnX || 480,
  phase:       getPhase(boss._bossHP || 0, bossConfig?.maxHP || 250),
});

const emitGameState = (io, room, bossConfig) => {
  const g   = room.game;
  const cfg = bossConfig || { maxHP: g.bossMaxHP };
  io.to(room.code).emit("game_state", {
    roomCode:         room.code,
    bossId:           room.selectedBoss,
    sharedHP:         g.sharedHP,
    sharedMaxHP:      g.sharedMaxHP,
    bossHP:           g.bossHP,
    bossMaxHP:        g.bossMaxHP,
    bossState:        g.bossState,
    stateEndsAt:      g.stateEndsAt,
    countdownRemaining: g.bossState === "countdown" ? Math.max(0, g.stateEndsAt - Date.now()) : 0,
    currentWord:      g.currentWord,
    currentWordPhase: g.currentWordPhase,
    typedProgress:    g.typedProgress,
    streak:           g.streak,
    streakMult:       g.streakMult      || 1,
    streakMultWords:  g.streakMultWords  || 0,
    furyActive:       g.furyActive      || false,
    character:        g.character,
    boss:             buildBossStateForClient({ ...g.boss, _bossHP: g.bossHP }, cfg),
    projectiles:      g.projectiles,
    players:          room.players.map(playerStateForClient),
  });
};

const createInitialGameState = (bossConfig) => {
  const now   = Date.now();
  const maxHP = bossConfig.maxHP;
  return {
    sharedHP:    SHARED_MAX_HP,
    sharedMaxHP: SHARED_MAX_HP,
    bossHP:      maxHP,
    bossMaxHP:   maxHP,
    bossState:   "countdown",
    stateEndsAt: now + COUNTDOWN_DURATION_MS,
    triggeredSwapThresholds: [],
    ultimateTriggered: false,
    currentWord:      getDifficultyWord(maxHP, maxHP),
    currentWordPhase: getDifficultyPhase(maxHP, maxHP),
    typedProgress: 0,
    streak:        0,
    totalWordsTyped: 0,
    character: { x: 480, y: 370 },
    boss: {
      x:       480,
      y:       bossConfig.yBase || 100,
      targetX: 480,
      targetY: bossConfig.yBase || 100,
      nextMoveAt: now + 2000,
      attackType:     bossConfig.attackQueues[0][0],
      attackTimer:    bossConfig.attackDurations[bossConfig.attackQueues[0][0]] || 5000,
      attackQueueIdx: 0,
      lastFireAt:     now,
      spiralAngle:    0,
      circleFired:    false,
      // Watcher / generic
      hellSpiralAt:   0,
      hellRainAt:     0,
      // Storm Drake
      tempestSweepAt: 0,
      tempestRainAt:  0,
      tempestChainAt: 0,
      // Inferno
      wildfireSpreadAt: 0,
      wildfireRainAt:   0,
      // Glacier
      avalancheFromLeft: false,
      // Wind-up
      windingUp:     false,
      windUpAttack:  null,
      windUpUntil:   0,
      // Column attack
      columnState:   null,
      columnX:       480,
      columnStateAt: 0,
    },
    projectiles:      [],
    nextProjectileId: 1,
    startedAt:        now,
    lastTickAt:       now,
    // Streak bonus system
    streakMult:      1,   // damage multiplier for the next streakMultWords words
    streakMultWords: 0,   // how many words still carry the bonus
    furyActive:      false,
  };
};

module.exports = { toPublicRoomState, playerStateForClient, emitGameState, createInitialGameState };
