const { getDifficultyWord, getDifficultyPhase, getPhase } = require("./words");
const { SHARED_MAX_HP, COUNTDOWN_DURATION_MS } = require("./constants");
const { applyDifficultyToGame } = require("./difficulty");

const randomWeaponPos = () => ({
  x: 300 + Math.random() * 680,
  y: 350 + Math.random() * 200,
});

const toPublicRoomState = (room) => ({
  code:         room.code,
  hostSocketId: room.hostSocketId,
  selectedBoss: room.selectedBoss,
  gameMode:     room.gameMode || "coop",
  difficulty:   room.difficulty || "normal",
  players:      room.players.map(({ socketId, username, role, ready }) => ({
    socketId, username, role, ready: ready || false,
  })),
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

const buildBossStateForClient = (boss, bossConfig, g) => ({
  x:           boss.x,
  y:           boss.y,
  attackType:  boss.windingUp ? (boss.windUpAttack || boss.attackType) : boss.attackType,
  windingUp:   boss.windingUp || false,
  windUpAttack: boss.windUpAttack || null,
  windUpRemaining: boss.windingUp ? Math.max(0, boss.windUpUntil - Date.now()) : 0,
  columnState: boss.columnState || null,
  columnX:     boss.columnX || 640,
  phase:       getPhase(g?.bossHP ?? 0, bossConfig?.maxHP || 250),
});

const emitGameState = (io, room, bossConfig) => {
  const g   = room.game;
  const cfg = bossConfig || { maxHP: g.bossMaxHP };
  io.to(room.code).emit("game_state", {
    roomCode:         room.code,
    gameMode:         room.gameMode || "coop",
    difficulty:       room.difficulty || "normal",
    bossId:           room.selectedBoss,
    sharedHP:         g.sharedHP,
    sharedMaxHP:      g.sharedMaxHP,
    bossHP:           g.bossHP,
    bossMaxHP:        g.bossMaxHP,
    bossShield:       g.bossShield || 0,
    bossShieldMax:    g.bossShieldMax || 0,
    teamShield:       g.teamShield || 0,
    poisoned:         Boolean(g.poisonUntil && Date.now() < g.poisonUntil),
    slowed:           g.slowed || false,
    weaponHeld:       g.weapon?.held  || false,
    weaponX:          g.weapon?.x,
    weaponY:          g.weapon?.y,
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
    boss:             buildBossStateForClient({ ...g.boss, _bossHP: g.bossHP }, cfg, g),
    projectiles:      g.projectiles,
    players:          room.players.map(playerStateForClient),
  });
};

const createInitialGameState = (bossConfig, opts = {}) => {
  const now   = Date.now();
  const maxHP = bossConfig.maxHP;
  const gameMode = opts.gameMode || "coop";

  const g = {
    gameMode,
    sharedHP:    SHARED_MAX_HP,
    sharedMaxHP: SHARED_MAX_HP,
    bossHP:      maxHP,
    bossMaxHP:   maxHP,
    bossShield:  0,
    bossShieldMax: 0,
    shieldInitialized: false,
    teamShield:  0,
    poisonUntil: 0,
    slowed:      false,
    moveSpeedMult: 1,
    bossState:   "countdown",
    stateEndsAt: now + COUNTDOWN_DURATION_MS,
    triggeredSwapThresholds: [],
    ultimateTriggered: false,
    bossInvulnUntil:   0,
    _combat:           bossConfig.combatProfile ? { state: "idle", currentId: null, startedAt: 0, cooldowns: {}, data: {} } : null,
    _groundHazards:    [],
    _telegraphs:       [],
    currentWord:      getDifficultyWord(maxHP, maxHP),
    currentWordPhase: getDifficultyPhase(maxHP, maxHP),
    typedProgress: 0,
    streak:        0,
    totalWordsTyped: 0,
    character: { x: 640, y: 490 },
    boss: {
      x:       640,
      y:       bossConfig.yBase || 110,
      targetX: 640,
      targetY: bossConfig.yBase || 110,
      nextMoveAt: now + 2000,
      attackType:     bossConfig.attackQueues[0][0],
      attackTimer:    bossConfig.attackDurations[bossConfig.attackQueues[0][0]] || 5000,
      attackQueueIdx: 0,
      lastFireAt:     now,
      spiralAngle:    0,
      circleFired:    false,
      hellSpiralAt:   0,
      hellRainAt:     0,
      tempestSweepAt: 0,
      tempestRainAt:  0,
      tempestChainAt: 0,
      wildfireSpreadAt: 0,
      wildfireRainAt:   0,
      avalancheFromLeft: false,
      windingUp:     false,
      windUpAttack:  null,
      windUpUntil:   0,
      columnState:   null,
      columnX:       640,
      columnStateAt: 0,
    },
    projectiles:      [],
    nextProjectileId: 1,
    _toxicPools:      [],
    _slowFields:      [],
    _delayedSpawns:   [],
    _voidZoneDetonates: [],
    _magnetActive:    false,
    startedAt:        now,
    lastTickAt:       now,
    weapon: { ...randomWeaponPos(), held: false, pickedUpAt: 0, pickupLockedUntil: 0 },
    streakMult:      1,
    streakMultWords: 0,
    furyActive:      false,
  };

  if (opts.difficulty) applyDifficultyToGame(g, opts.difficulty);
  return g;
};

module.exports = { toPublicRoomState, playerStateForClient, emitGameState, createInitialGameState };
