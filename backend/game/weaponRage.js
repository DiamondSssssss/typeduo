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
  gatling_gun: 3,
};

/** Holy/Demon verses count as one word but are long — higher gain per completion. */
const RAGE_PER_BOOK_VERSE = 34;

const RAGE_LOST_ON_TYPO = 18;

/** Fixed phrases — must match exactly (lowercase). */
const WEAPON_ULTIMATES = {
  swift_blade: {
    phrase: "blade of the storm cuts deep",
    name: "Storm Cut",
    hits: 12,
    hitDamage: 20,
    hitIntervalMs: 56,
    windupMs: 420,
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
  gatling_gun: {
    phrase: "lead storm falls upon the dark throne",
    name: "Lead Storm",
    hits: 56,
    hitDamage: 8,
    hitIntervalMs: 38,
    windupMs: 480,
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

/** Ultimate phrase locked at enter — survives book falling neutral mid-phrase. */
const getBookUltimateForExecute = (g) => {
  const align = g._ultimateBookAlignment || g.book?.alignment;
  if (align === "holy") return BOOK_HOLY_ULTIMATE;
  if (align === "demon") return BOOK_DEMON_ULTIMATE;
  return null;
};

const addRage = (g, weaponId) => {
  initRage(g);
  if (weaponId === "animous_codex" && g.book?.alignment === "neutral") {
    return g.weaponRage || 0;
  }
  const gain = weaponId === "animous_codex"
    ? RAGE_PER_BOOK_VERSE
    : (RAGE_PER_WORD[weaponId] ?? 12);
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
  g._ultimateBookAlignment = null;
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
  if (weapon.id === "animous_codex") {
    const { initBookState } = require("./bookCombat");
    initBookState(g);
    g._ultimateBookAlignment = g.book.alignment;
  }
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

const finishUltimateState = (g, weapon, ult) => {
  if (ult.bonusEffect === "timer_refresh" && weapon.wordTimer) {
    const len = g.currentWord?.length || 5;
    g.wordExpiresAt = Date.now() + weapon.timerBaseMs + len * weapon.timerPerCharMs;
  }
  if (weapon.streakDamage && ult.keepStreak) {
    g.weaponStreak = (g.weaponStreak || 0) + 1;
  }
  g.weaponRage = 0;
  g._ultimateMode = false;
  g._ultimateBookAlignment = null;
  g._savedWeaponWord = null;
  const { refreshWeaponWord } = require("./weaponCombat");
  refreshWeaponWord(g);
};

const executeSwiftStormCut = (io, room, player, g, ult, stunMult) => {
  const { emitGameState } = require("./gameState");
  const { resolveBossConfig } = require("./bossTransform");
  const weapon = getWeapon("swift_blade");
  const hits = ult.hits || 10;
  const hitDmg = Math.round((ult.hitDamage || 20) * stunMult);
  const interval = ult.hitIntervalMs || 52;
  const prevHP = g.bossHP;
  const totalDamage = hitDmg * hits;

  finishUltimateState(g, weapon, ult);
  player.wordsTyped++;
  g.totalWordsTyped++;

  const windup = ult.windupMs ?? 420;
  io.to(room.code).emit("weapon_ult_swift_start", {
    bossX: g.boss.x,
    bossY: g.boss.y,
    totalHits: hits,
    windupMs: windup,
  });

  for (let i = 0; i < hits; i++) {
    setTimeout(() => {
      if (room.status !== "in_game" || !room.game) return;
      const rg = room.game;
      applyBossWordDamage(rg, hitDmg);
      player.damageDealt += hitDmg;
      const angle = (i / hits) * Math.PI * 2 + (Math.random() - 0.5) * 0.35;
      const isFinale = i === hits - 1;
      io.to(room.code).emit("weapon_ult_swift_stab", {
        hit: i + 1,
        totalHits: hits,
        damage: hitDmg,
        bossX: rg.boss.x,
        bossY: rg.boss.y,
        angle,
        finale: isFinale,
      });
      emitGameState(io, room, resolveBossConfig(room));
    }, windup + i * interval);
  }

  return {
    socketId: player.socketId,
    by: player.username,
    word: ult.phrase,
    weaponTypeId: weapon.id,
    damage: totalDamage,
    healed: 0,
    ultimate: true,
    ultimateName: ult.name,
    bossHP: g.bossHP,
    prevHP,
    weaponRage: 0,
    ultimateHits: hits,
  };
};

const executeGatlingLeadStorm = (io, room, player, g, ult, stunMult) => {
  const { emitGameState } = require("./gameState");
  const { resolveBossConfig } = require("./bossTransform");
  const weapon = getWeapon("gatling_gun");
  const hits = ult.hits || 56;
  const hitDmg = Math.round((ult.hitDamage || 8) * stunMult);
  const interval = ult.hitIntervalMs || 38;
  const prevHP = g.bossHP;
  const totalDamage = hitDmg * hits;

  finishUltimateState(g, weapon, ult);
  player.wordsTyped++;
  g.totalWordsTyped++;

  const windup = ult.windupMs ?? 480;
  io.to(room.code).emit("weapon_ult_gatling_start", {
    bossX: g.boss.x,
    bossY: g.boss.y,
    totalHits: hits,
    windupMs: windup,
  });

  for (let i = 0; i < hits; i++) {
    setTimeout(() => {
      if (room.status !== "in_game" || !room.game) return;
      const rg = room.game;
      applyBossWordDamage(rg, hitDmg);
      player.damageDealt += hitDmg;
      const spread = (i % 7) - 3;
      const isFinale = i === hits - 1;
      // Pseudo-random spawn — avoid i % 5 bands that looked like 5 parallel screen slashes
      const spawnX = 64 + ((i * 47 + spread * 13) % 1152);
      const spawnY = 24 + ((i * 29 + spread * 11) % 100);
      io.to(room.code).emit("weapon_ult_gatling_rain", {
        hit: i + 1,
        totalHits: hits,
        damage: hitDmg,
        bossX: rg.boss.x,
        bossY: rg.boss.y,
        spawnX,
        spawnY,
        finale: isFinale,
      });
      emitGameState(io, room, resolveBossConfig(room));
    }, windup + i * interval);
  }

  return {
    socketId: player.socketId,
    by: player.username,
    word: ult.phrase,
    weaponTypeId: weapon.id,
    damage: totalDamage,
    healed: 0,
    ultimate: true,
    ultimateName: ult.name,
    bossHP: g.bossHP,
    prevHP,
    weaponRage: 0,
    ultimateHits: hits,
  };
};

const executeUltimate = (io, room, player, g) => {
  const weapon = getWeapon(g.weapon?.typeId);
  let ult;
  if (weapon.id === "animous_codex") {
    const { initBookState } = require("./bookCombat");
    initBookState(g);
    ult = getBookUltimateForExecute(g);
  } else {
    ult = WEAPON_ULTIMATES[weapon.id];
  }

  if (!ult) {
    if (g._ultimateMode) cancelUltimateMode(g);
    return {
      socketId: player.socketId,
      by: player.username,
      word: g.currentWord || "",
      weaponTypeId: weapon.id,
      damage: 0,
      bossHP: g.bossHP,
      prevHP: g.bossHP,
      weaponRage: g.weaponRage || 0,
      aborted: true,
    };
  }

  const stunMult = g.bossState === "stunned" ? 2 : 1;
  if (weapon.id === "swift_blade" && ult.hits && ult.hitDamage) {
    return executeSwiftStormCut(io, room, player, g, ult, stunMult);
  }
  if (weapon.id === "gatling_gun" && ult.hits && ult.hitDamage) {
    return executeGatlingLeadStorm(io, room, player, g, ult, stunMult);
  }

  let damage;
  if (weapon.id === "animous_codex") {
    const { computeVerseDamage } = require("./bookWords");
    const align = g._ultimateBookAlignment || g.book?.alignment || "holy";
    damage = Math.round(computeVerseDamage(ult.phrase, align, stunMult) * ult.bossDamageMult);
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

  finishUltimateState(g, weapon, ult);

  const payload = {
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
  if (weapon.id === "animous_codex") {
    const { getBookPublicState } = require("./bookCombat");
    payload.book = getBookPublicState(g);
  }
  return payload;
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
  cancelUltimateMode,
  getBookUltimateForExecute,
};
