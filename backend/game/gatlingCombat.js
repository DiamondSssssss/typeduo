/**
 * Gatling Gun — one random letter per shot; very low damage, high fire rate.
 */
const { STUN_DAMAGE_MULTIPLIER } = require("./constants");
const { getWeapon } = require("./weapons");
const { applyBossWordDamage } = require("./bossDamage");
const { resetTypoStreak, resetWeaponStreak } = require("./typingChallenges");
const { tryOfferUltimate, isUltimateMode, loseRageOnTypo } = require("./weaponRage");
const { emitGameState } = require("./gameState");
const { resolveBossConfig } = require("./bossTransform");

const GATLING_ALPHABET = "abcdefghijklmnopqrstuvwxyz";
const RAGE_PER_SHOT = 3;

const isGatlingWeapon = (g) => {
  const w = getWeapon(g.weapon?.typeId);
  return Boolean(w.gatlingMode);
};

const rollGatlingLetter = (prev) => {
  let next = GATLING_ALPHABET[Math.floor(Math.random() * 26)];
  if (prev && GATLING_ALPHABET.length > 1) {
    let guard = 0;
    while (next === prev && guard++ < 8) {
      next = GATLING_ALPHABET[Math.floor(Math.random() * 26)];
    }
  }
  return next;
};

/** Assign next target letter (also sets currentWord for HUD sync). */
const refreshGatlingTarget = (g) => {
  const letter = rollGatlingLetter(g.gatlingTarget);
  g.gatlingTarget = letter;
  g.currentWord = letter;
  g.typedProgress = 0;
  g.currentWordPhase = "gatling";
  g.wordExpiresAt = 0;
};

const computeGatlingShotDamage = (g, weapon, stunMult) => {
  const base = weapon.shotDamage ?? 3;
  return Math.max(1, Math.round(base * (weapon.damageMult || 0.4) * stunMult));
};

const addGatlingRage = (g) => {
  if (g.weaponRage == null) g.weaponRage = 0;
  g.weaponRage = Math.min(100, (g.weaponRage || 0) + RAGE_PER_SHOT);
};

/**
 * Handle one keystroke while holding Gatling (not in ultimate phrase mode).
 * @returns {boolean} true if handled
 */
const processGatlingInput = (io, room, player, input) => {
  const g = room.game;
  const code = room.code;
  const weapon = getWeapon(g.weapon?.typeId);
  if (!weapon.gatlingMode || isUltimateMode(g)) return false;

  const target = (g.gatlingTarget || g.currentWord || "a")[0];
  const bossCfg = resolveBossConfig(room);

  if (input !== target) {
    g.typedProgress = 0;
    resetWeaponStreak(g);
    loseRageOnTypo(g);
    io.to(code).emit("typo", {
      socketId: player.socketId,
      char: input,
      expected: target,
    });
    if (bossCfg.typoFeed || bossCfg.typoEnrage || bossCfg.typoBomb) {
      const { applyTypoBossEffect } = require("./typingChallenges");
      applyTypoBossEffect(io, room, bossCfg, g);
    } else if (bossCfg.typoBacklash?.damage) {
      const { takeDamage } = require("./helpers");
      takeDamage(io, room, bossCfg.typoBacklash.damage, g.character.x, g.character.y);
      io.to(code).emit("typo_backlash", {
        damage: bossCfg.typoBacklash.damage,
        socketId: player.socketId,
      });
    }
    io.to(code).emit("typing_progress", {
      currentWord: g.currentWord,
      typedProgress: g.typedProgress,
      weaponTypeId: g.weapon.typeId,
      weaponRage: g.weaponRage || 0,
      ultimateMode: false,
      currentWordPhase: g.currentWordPhase,
      gatlingTarget: g.gatlingTarget,
    });
    emitGameState(io, room, bossCfg);
    return true;
  }

  resetTypoStreak(g);
  const stunMult = g.bossState === "stunned" ? STUN_DAMAGE_MULTIPLIER : 1;
  const damage = computeGatlingShotDamage(g, weapon, stunMult);
  const prevHP = g.bossHP;

  const shieldWordOnly = Boolean(g._shieldWordMode && (g.bossShield || 0) > 0);
  if (!shieldWordOnly) {
    applyBossWordDamage(g, damage);
    player.damageDealt += damage;
  }

  player.wordsTyped++;
  g.totalWordsTyped++;

  addGatlingRage(g);
  tryOfferUltimate(io, room, g);

  const hitLetter = target;
  // Do not roll a new letter while ultimate phrase is active (rage just hit 100%).
  if (!isUltimateMode(g)) {
    refreshGatlingTarget(g);
  }

  io.to(code).emit("gatling_shot", {
    letter: hitLetter,
    damage: shieldWordOnly ? 0 : damage,
    weaponTypeId: weapon.id,
    weaponRage: g.weaponRage || 0,
    stunBonus: stunMult > 1,
    bossX: g.boss.x,
    bossY: g.boss.y,
    bossHP: g.bossHP,
    prevHP,
  });

  io.to(code).emit("typing_progress", {
    currentWord: g.currentWord,
    typedProgress: g.typedProgress,
    weaponTypeId: g.weapon.typeId,
    weaponRage: g.weaponRage || 0,
    ultimateMode: Boolean(g._ultimateMode),
    currentWordPhase: g.currentWordPhase,
    gatlingTarget: g.gatlingTarget,
  });
  emitGameState(io, room, bossCfg);
  return true;
};

module.exports = {
  isGatlingWeapon,
  refreshGatlingTarget,
  processGatlingInput,
  RAGE_PER_SHOT,
};
