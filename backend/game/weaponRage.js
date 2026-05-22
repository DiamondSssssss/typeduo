/**
 * Weapon Rage — build meter by completing words; at 100% type a fixed ultimate phrase.
 */
const { getWeapon } = require("./weapons");
const { applyBossWordDamage } = require("./bossDamage");
const { computeWordDamage } = require("./words");

const RAGE_MAX = 100;

const RAGE_PER_WORD = {
  swift_blade: 14,
  shortsword: 11,
  greatsword: 9,
  lifestaff: 12,
  fury_axe: 13,
  animous_codex: 11,
};

const RAGE_LOST_ON_TYPO = 18;

/** Fixed phrases — must match exactly (lowercase). */
const WEAPON_ULTIMATES = {
  swift_blade: {
    phrase: "blade of the storm cuts deep",
    name: "Storm Cut",
    bossDamageMult: 2.2,
    bonusEffect: "timer_refresh",
  },
  shortsword: {
    phrase: "honor guards the fallen line",
    name: "Guardian Strike",
    bossDamageMult: 1.6,
    teamHeal: 12,
  },
  greatsword: {
    phrase: "the earth splits before my steel",
    name: "Earth Splitter",
    bossDamageMult: 3.4,
  },
  lifestaff: {
    phrase: "life blooms where shadows fall",
    name: "Bloom of Life",
    bossDamageMult: 1.2,
    teamHeal: 28,
  },
  fury_axe: {
    phrase: "rage consumes all who stand near",
    name: "Consuming Rage",
    bossDamageMult: 2.8,
    keepStreak: true,
  },
};

const BOOK_HOLY_ULTIMATE = {
  phrase: "sanctuary psalm shields the faithful",
  name: "Sanctuary Psalm",
  bossDamageMult: 1.85,
  teamHeal: 15,
  sanctuaryMs: 3000,
};

const BOOK_DEMON_ULTIMATE = {
  phrase: "cataclysm verdict ends all hope",
  name: "Cataclysm Verdict",
  bossDamageMult: 3.1,
  selfCost: 5,
};

const initRage = (g) => {
  if (g.weaponRage == null) g.weaponRage = 0;
  if (g.consecutiveTypos == null) g.consecutiveTypos = 0;
};

const getBookUltimate = (g) => {
  if (g.book?.alignment === "holy") return BOOK_HOLY_ULTIMATE;
  if (g.book?.alignment === "demon") return BOOK_DEMON_ULTIMATE;
  return null;
};

const addRage = (g, weaponId) => {
  initRage(g);
  if (weaponId === "animous_codex" && g.book?.alignment === "neutral") {
    return g.weaponRage || 0;
  }
  const gain = RAGE_PER_WORD[weaponId] ?? 12;
  g.weaponRage = Math.min(RAGE_MAX, (g.weaponRage || 0) + gain);
  return g.weaponRage;
};

const restoreSavedWeaponWord = (g) => {
  const s = g._savedWeaponWord;
  g._savedWeaponWord = null;
  if (!s) {
    const { refreshWeaponWord } = require("./weaponCombat");
    refreshWeaponWord(g);
    return;
  }
  g.currentWord = s.currentWord;
  g.typedProgress = s.typedProgress;
  g.currentWordPhase = s.currentWordPhase;
  g.wordExpiresAt = s.wordExpiresAt;
};

const cancelUltimateMode = (g) => {
  if (!g._ultimateMode) return;
  g._ultimateMode = false;
  restoreSavedWeaponWord(g);
};

const loseRageOnTypo = (g) => {
  initRage(g);
  g.weaponRage = Math.max(0, (g.weaponRage || 0) - RAGE_LOST_ON_TYPO);
  if (g._ultimateMode) cancelUltimateMode(g);
};

const DEFERRED_CHALLENGE_KINDS = new Set(["shield_break", "mirror_word", "safe_zone"]);

const enterUltimateMode = (io, room, g) => {
  const weapon = getWeapon(g.weapon?.typeId);
  const ult = weapon.id === "animous_codex"
    ? getBookUltimate(g)
    : WEAPON_ULTIMATES[weapon.id];
  if (!ult || g._ultimateMode) return false;
  if (g._challenge && DEFERRED_CHALLENGE_KINDS.has(g._challenge.kind)) return false;

  if (!g._savedWeaponWord) {
    g._savedWeaponWord = {
      currentWord: g.currentWord,
      typedProgress: g.typedProgress,
      currentWordPhase: g.currentWordPhase,
      wordExpiresAt: g.wordExpiresAt,
    };
  }
  g._ultimateMode = true;
  g.currentWord = ult.phrase;
  g.typedProgress = 0;
  g.currentWordPhase = "ultimate";
  g.wordExpiresAt = 0;

  io.to(room.code).emit("weapon_ultimate_ready", {
    phrase: ult.phrase,
    name: ult.name,
    weaponTypeId: weapon.id,
    weaponRage: g.weaponRage,
    currentWord: ult.phrase,
    currentWordPhase: "ultimate",
    typedProgress: 0,
  });
  return true;
};

const tryOfferUltimate = (io, room, g) => {
  initRage(g);
  if (g.weaponRage >= RAGE_MAX && !g._ultimateMode) {
    enterUltimateMode(io, room, g);
  }
};

const executeUltimate = (io, room, player, g) => {
  const weapon = getWeapon(g.weapon?.typeId);
  const ult = weapon.id === "animous_codex"
    ? getBookUltimate(g)
    : WEAPON_ULTIMATES[weapon.id];
  if (!ult) return null;

  const stunMult = g.bossState === "stunned" ? 2 : 1;
  let damage;
  if (weapon.id === "animous_codex") {
    const { computeVerseDamage } = require("./bookWords");
    damage = Math.round(computeVerseDamage(ult.phrase, g.book.alignment, stunMult) * ult.bossDamageMult);
  } else {
    const base = computeWordDamage(ult.phrase) * (weapon.damageMult || 1);
    damage = Math.round(base * ult.bossDamageMult * stunMult);
  }
  const prevHP = g.bossHP;

  applyBossWordDamage(g, damage);
  player.damageDealt += damage;
  player.wordsTyped++;
  g.totalWordsTyped++;

  let healed = 0;
  if (ult.teamHeal) {
    healed = ult.teamHeal;
    g.sharedHP = Math.min(g.sharedMaxHP, g.sharedHP + healed);
  }

  if (ult.sanctuaryMs) {
    const { applySanctuary } = require("./bookCombat");
    applySanctuary(g, ult.sanctuaryMs);
    io.to(room.code).emit("book_sanctuary_start", { durationMs: ult.sanctuaryMs });
  }

  if (ult.selfCost) {
    const { takeDamage } = require("./helpers");
    takeDamage(io, room, ult.selfCost, g.character.x, g.character.y, {
      source: "typo_backlash",
      skipWeaponDrop: true,
      skipWeaponStreakReset: true,
    });
  }

  if (ult.bonusEffect === "timer_refresh" && weapon.wordTimer) {
    const len = g.currentWord?.length || 5;
    g.wordExpiresAt = Date.now() + weapon.timerBaseMs + len * weapon.timerPerCharMs;
  }

  if (weapon.streakDamage && ult.keepStreak) {
    g.weaponStreak = (g.weaponStreak || 0) + 1;
  }

  g.weaponRage = 0;
  g._ultimateMode = false;
  g._savedWeaponWord = null;

  const { refreshWeaponWord } = require("./weaponCombat");
  refreshWeaponWord(g);

  return {
    socketId: player.socketId,
    by: player.username,
    word: ult.phrase,
    weaponTypeId: weapon.id,
    damage,
    healed,
    ultimate: true,
    ultimateName: ult.name,
    bossHP: g.bossHP,
    prevHP,
    weaponRage: 0,
  };
};

const isUltimateMode = (g) => Boolean(g._ultimateMode);

module.exports = {
  RAGE_MAX,
  WEAPON_ULTIMATES,
  addRage,
  loseRageOnTypo,
  tryOfferUltimate,
  executeUltimate,
  isUltimateMode,
  enterUltimateMode,
};
