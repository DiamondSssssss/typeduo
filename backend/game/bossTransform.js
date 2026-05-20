const { STUN_DURATION_MS } = require("./constants");

/**
 * Resolve boss config for an active game (handles The Glitch → The Entity).
 */
const resolveBossConfig = (room) => {
  const g = room?.game;
  if (g?._activeBossConfig) return g._activeBossConfig;
  const { getBoss } = require("./bosses");
  return getBoss(room?.selectedBoss);
};

/**
 * When boss HP hits 0, transform into second form instead of ending the fight.
 * @returns {boolean} true if transform happened (fight continues)
 */
const tryBossTransform = (io, room, baseConfig) => {
  const g = room.game;
  if (!g || g.bossHP > 0) return false;

  const sf = baseConfig?.transform?.secondForm;
  if (!sf || (g.bossForm || 1) >= 2) return false;

  g.bossForm = 2;
  g.bossDisplayName = sf.name || "The Entity";
  g.bossMaxHP = sf.maxHP;
  g.bossHP = sf.maxHP;
  g.bossShield = 0;
  g.bossShieldMax = sf.shieldMax || 0;
  g.shieldInitialized = false;

  g.ultimateTriggered = false;
  g.lowHpSpecialTriggered = false;
  g.projectiles = [];
  g._groundHazards = [];
  g._toxicPools = [];
  g._slowFields = [];
  g._delayedSpawns = [];
  g._voidZoneDetonates = [];
  g._magnetActive = false;
  g._challenge = null;
  g._windupCancel = null;
  g._chainCancel = null;
  g._savedWeaponWord = null;
  g._typableMinions = [];
  g._typablePillars = [];
  g._activeMinionId = null;
  g._playerStun = null;
  g._shieldWordMode = false;
  g.moveSpeedMult = 1;
  g._combat = { state: "idle", currentId: null, startedAt: 0, cooldowns: {}, data: {} };

  const b = g.boss;
  b.windingUp = false;
  b.windUpAttack = null;
  b.windUpUntil = 0;
  b.columnState = null;
  b.attackType = sf.combatProfile?.attacks?.[0]?.id || "dark_pulse";
  b.lastFireAt = Date.now();
  b.nextMoveAt = 0;

  const { maybeInitBossShield } = require("./bossDamage");
  const { getPhase } = require("./words");
  maybeInitBossShield(g, g._activeBossConfig, getPhase(g.bossHP, g.bossMaxHP));

  g.bossInvulnUntil = Date.now() + 2200;
  g.bossState = "stunned";
  g.stateEndsAt = Date.now() + STUN_DURATION_MS + 400;

  g._activeBossConfig = {
    ...baseConfig,
    ...sf,
    id: baseConfig.id,
    name: baseConfig.name,
    transform: null,
    combatProfile: sf.combatProfile,
    moveSpeed: sf.moveSpeed || baseConfig.moveSpeed,
    projSpeed: sf.projSpeed || baseConfig.projSpeed,
    yBase: sf.yBase ?? baseConfig.yBase,
    yRange: sf.yRange ?? baseConfig.yRange,
  };

  io.to(room.code).emit("boss_transform", {
    bossId: baseConfig.id,
    form: 2,
    displayName: g.bossDisplayName,
    visualKey: sf.visualKey || "the_entity",
    color: sf.color || 0x22d3ee,
    bossHP: g.bossHP,
    bossMaxHP: g.bossMaxHP,
    message: `${baseConfig.name} has become ${g.bossDisplayName}!`,
  });

  return true;
};

module.exports = { resolveBossConfig, tryBossTransform };
