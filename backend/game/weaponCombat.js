const { STUN_DAMAGE_MULTIPLIER } = require("./constants");
const { getWeapon, DEFAULT_WEAPON_ID } = require("./weapons");
const {
  getWeaponWord,
  getWeaponWordPhase,
  computeWordDamage,
} = require("./words");
const { applyBossWordDamage } = require("./bossDamage");
const {
  hasActiveMinions,
  hasActivePillars,
  tryKillMinionOnWord,
  tryDestroyPillarOnWord,
} = require("./typingChallenges");

/** Assign a new word for the held weapon (or default pool if none held). */
const refreshWeaponWord = (g) => {
  const typeId = g.weapon?.typeId || DEFAULT_WEAPON_ID;
  g.currentWord = getWeaponWord(typeId, g.bossHP, g.bossMaxHP);
  g.currentWordPhase = getWeaponWordPhase(typeId, g.currentWord);
  g.typedProgress = 0;

  const weapon = getWeapon(typeId);
  if (weapon.wordTimer && g.weapon?.held) {
    const len = g.currentWord?.length || 4;
    g.wordExpiresAt =
      Date.now() + weapon.timerBaseMs + len * weapon.timerPerCharMs;
  } else {
    g.wordExpiresAt = 0;
  }
};

/** Extend timer after each correct keystroke (swift blade). */
const bumpWordTimer = (g) => {
  const weapon = getWeapon(g.weapon?.typeId);
  if (!weapon.wordTimer || !g.weapon?.held) return;
  const remaining = g.currentWord.length - g.typedProgress;
  g.wordExpiresAt =
    Date.now() + weapon.timerBaseMs * 0.35 + remaining * weapon.timerPerCharMs;
};

const resetWeaponStreak = (g) => {
  g.weaponStreak = 0;
};

const getStreakDamageMult = (g, weapon) => {
  if (!weapon.streakDamage) return 1;
  const stacks = Math.min(g.weaponStreak || 0, weapon.streakCap || 15);
  return 1 + stacks * (weapon.streakBonusPerStack || 0.1);
};

const computeAttackDamage = (g, word, weapon, stunMult) => {
  const base = computeWordDamage(word) * (weapon.damageMult || 1);
  const streakMult = getStreakDamageMult(g, weapon);
  return Math.round(base * stunMult * streakMult);
};

/**
 * Word timer expired — roll a new word (swift blade).
 * @returns {boolean} true if state changed
 */
const tickWordExpiry = (io, room, now) => {
  const g = room.game;
  if (!g?.weapon?.held || !g.wordExpiresAt || now < g.wordExpiresAt) return false;
  const weapon = getWeapon(g.weapon?.typeId);
  if (!weapon.wordTimer) return false;

  resetWeaponStreak(g);
  refreshWeaponWord(g);
  io.to(room.code).emit("word_expired", {
    weaponTypeId: g.weapon.typeId,
    currentWord: g.currentWord,
    typedProgress: 0,
    wordExpiresAt: g.wordExpiresAt,
    weaponStreak: 0,
  });
  return true;
};

/**
 * Complete the current word — damage, heal, streak, next word.
 * @returns {object} payload for word_completed event
 */
const completeWord = (room, player, io = null) => {
  const g = room.game;

  if (isUltimateMode(g) && io) {
    return executeUltimate(io, room, player, g);
  }

  const weapon = getWeapon(g.weapon?.typeId);
  const completedWord = g.currentWord;
  const stunMult =
    g.bossState === "stunned" ? STUN_DAMAGE_MULTIPLIER : 1;
  const streakMult = getStreakDamageMult(g, weapon);
  const damage = computeAttackDamage(g, completedWord, weapon, stunMult);

  const prevHP = g.bossHP;
  const prevShield = g.bossShield || 0;

  let minionKilled = false;
  let pillarDestroyed = false;
  let bossDamage = 0;

  // Minions/pillars: use your normal weapon word to clear them (no separate challenge words).
  if (io && hasActiveMinions(g)) {
    minionKilled = tryKillMinionOnWord(io, room, g);
  } else if (io && hasActivePillars(g)) {
    pillarDestroyed = tryDestroyPillarOnWord(io, room, g);
  } else {
    const shieldWordOnly = Boolean(g._shieldWordMode && (g.bossShield || 0) > 0);
    if (!shieldWordOnly) {
      applyBossWordDamage(g, damage);
      bossDamage = damage;
    }
  }

  player.wordsTyped++;
  player.damageDealt += bossDamage;
  g.totalWordsTyped++;

  let healed = 0;
  if (weapon.healOnWord) {
    healed = weapon.healOnWord;
    g.sharedHP = Math.min(g.sharedMaxHP, g.sharedHP + healed);
  }

  if (weapon.streakDamage) {
    g.weaponStreak = (g.weaponStreak || 0) + 1;
  }

  if (io) {
    addRage(g, weapon.id);
    tryOfferUltimate(io, room, g);
  }

  refreshWeaponWord(g);

  return {
    socketId: player.socketId,
    by: player.username,
    word: completedWord,
    weaponTypeId: weapon.id,
    damage: bossDamage,
    minionKilled,
    pillarDestroyed,
    baseDamage: Math.round(computeWordDamage(completedWord) * (weapon.damageMult || 1)),
    appliedMult: Math.round(stunMult * streakMult * 10) / 10,
    stunBonus: stunMult > 1,
    streakBonus: streakMult > 1,
    weaponStreak: g.weaponStreak || 0,
    bossHP: g.bossHP,
    bossShield: g.bossShield || 0,
    shieldBroken: prevShield > 0 && (g.bossShield || 0) === 0,
    healed,
    wordsTyped: player.wordsTyped,
    prevHP,
    weaponRage: g.weaponRage || 0,
    rageMax: RAGE_MAX,
  };
};

const { loseRageOnTypo, isUltimateMode, executeUltimate, addRage, tryOfferUltimate, RAGE_MAX } = require("./weaponRage");

const handleTypo = (g) => {
  resetWeaponStreak(g);
  loseRageOnTypo(g);
  if (g._ultimateMode) {
    g._ultimateMode = false;
    g._savedWeaponWord = null;
  }
};

module.exports = {
  refreshWeaponWord,
  bumpWordTimer,
  resetWeaponStreak,
  tickWordExpiry,
  completeWord,
  handleTypo,
  computeAttackDamage,
  getStreakDamageMult,
};
