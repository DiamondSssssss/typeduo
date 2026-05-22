/**
 * Animous Codex (Thiên Ma Lục) — alignment, neutral pairs, holy/demon verses.
 */
const { NEUTRAL_PAIR_COUNT, getNeutralPair, buildVerseOffer, computeVerseDamage } = require("./bookWords");
const { applyBossWordDamage } = require("./bossDamage");
const { STUN_DAMAGE_MULTIPLIER } = require("./constants");

const BOOK_WEAPON_ID = "animous_codex";
const TRANSFORM_AT = 10;
const HOLY_TYPO_SELF_DMG = 8;
const DEMON_TYPO_SELF_DMG = 8;

const isBookWeapon = (g) => g.weapon?.typeId === BOOK_WEAPON_ID;

const initBookState = (g) => {
  if (!g.book) {
    g.book = {
      alignment: "neutral",
      goodProgress: 0,
      evilProgress: 0,
      neutralIndex: 0,
      committed: false,
      committedPool: null,
      neutralPrefix: "",
      offerGood: null,
      offerEvil: null,
      aegisCharges: 0,
      verse: null,
      temptationActive: false,
      sanctuaryUntil: 0,
    };
  }
  return g.book;
};

const emitBookPair = (io, room) => {
  const g = room.game;
  const book = initBookState(g);
  const pair = getNeutralPair(book.neutralIndex);
  book.offerGood = pair.good;
  book.offerEvil = pair.evil;
  book.committed = false;
  book.committedPool = null;
  book.neutralPrefix = "";
  g.currentWord = "";
  g.typedProgress = 0;
  g.currentWordPhase = "book_neutral";
  io.to(room.code).emit("book_pair_offer", {
    good: pair.good,
    evil: pair.evil,
    goodProgress: book.goodProgress,
    evilProgress: book.evilProgress,
    neutralIndex: book.neutralIndex,
  });
};

const offerNeutralPair = (g) => {
  const book = initBookState(g);
  const pair = getNeutralPair(book.neutralIndex);
  book.offerGood = pair.good;
  book.offerEvil = pair.evil;
  book.committed = false;
  book.committedPool = null;
  book.neutralPrefix = "";
  g.currentWord = "";
  g.typedProgress = 0;
  g.currentWordPhase = "book_neutral";
};

const offerVerse = (g, alignment) => {
  const book = initBookState(g);
  const offer = buildVerseOffer(alignment);
  book.verse = offer;
  book.temptationActive = Boolean(offer.temptation);
  g.currentWord = offer.text;
  g.typedProgress = 0;
  g.currentWordPhase = alignment === "holy" ? "book_holy" : "book_demon";
};

const fallToNeutral = (io, room, reason = "fall") => {
  const g = room.game;
  const book = initBookState(g);
  book.alignment = "neutral";
  book.goodProgress = 0;
  book.evilProgress = 0;
  book.neutralIndex = 0;
  book.aegisCharges = 0;
  book.verse = null;
  book.temptationActive = false;
  offerNeutralPair(g);
  io.to(room.code).emit("book_fall_neutral", { reason });
  emitBookPair(io, room);
};

const transformBook = (io, room, alignment) => {
  const g = room.game;
  const book = initBookState(g);
  book.alignment = alignment;
  book.goodProgress = 0;
  book.evilProgress = 0;
  book.aegisCharges = 0;
  offerVerse(g, alignment);
  io.to(room.code).emit("book_transform", {
    alignment,
    currentWord: g.currentWord,
    currentWordPhase: g.currentWordPhase,
    temptation: book.verse?.temptation || null,
  });
};

/** Neutral pool pick — prefix match until only one word fits (same first letter). */
const tryCommitNeutralPool = (g, char) => {
  const book = initBookState(g);
  if (book.alignment !== "neutral" || book.committed) return { handled: false };
  const pair = getNeutralPair(book.neutralIndex);
  const c = String(char || "").toLowerCase();
  if (c.length !== 1 || !/[a-z]/.test(c)) return { handled: true, ignored: true };

  const next = (book.neutralPrefix || "") + c;
  const goodMatch = pair.good.startsWith(next);
  const evilMatch = pair.evil.startsWith(next);

  if (!goodMatch && !evilMatch) {
    book.neutralPrefix = "";
    g.typedProgress = 0;
    return { handled: true, typo: true };
  }

  book.neutralPrefix = next;
  g.typedProgress = next.length;

  if (goodMatch && evilMatch) {
    return { handled: true, ambiguous: true, prefix: next };
  }

  book.committedPool = goodMatch ? "good" : "evil";
  book.committed = true;
  book.neutralPrefix = "";
  g.currentWord = goodMatch ? pair.good : pair.evil;
  return {
    handled: true,
    committed: book.committedPool,
    word: g.currentWord,
    prefix: next,
  };
};

const onNeutralWordComplete = (io, room) => {
  const g = room.game;
  const book = initBookState(g);
  const pool = book.committedPool;
  if (pool === "good") {
    book.goodProgress++;
    book.evilProgress = 0;
  } else {
    book.evilProgress++;
    book.goodProgress = 0;
  }
  book.neutralIndex = (book.neutralIndex + 1) % NEUTRAL_PAIR_COUNT;

  if (book.goodProgress >= TRANSFORM_AT) {
    transformBook(io, room, "holy");
    return { transformed: "holy" };
  }
  if (book.evilProgress >= TRANSFORM_AT) {
    transformBook(io, room, "demon");
    return { transformed: "demon" };
  }

  emitBookPair(io, room);
  return {
    goodProgress: book.goodProgress,
    evilProgress: book.evilProgress,
    transformed: null,
  };
};

const onHolyVerseComplete = (g) => {
  const book = initBookState(g);
  book.aegisCharges = Math.min(2, (book.aegisCharges || 0) + 1);
  offerVerse(g, "holy");
  return { aegisCharges: book.aegisCharges };
};

const onDemonVerseComplete = (g) => {
  offerVerse(g, "demon");
  return {};
};

const onBookTypo = (io, room) => {
  const g = room.game;
  const book = initBookState(g);
  if (book.alignment === "demon") {
    const { takeDamage } = require("./helpers");
    takeDamage(io, room, DEMON_TYPO_SELF_DMG, g.character.x, g.character.y, {
      source: "typo_backlash",
      skipWeaponDrop: true,
      skipWeaponStreakReset: true,
    });
    io.to(room.code).emit("book_demon_typo", { damage: DEMON_TYPO_SELF_DMG });
  }
};

const checkTemptationFall = (io, room, g, typedSlice) => {
  const book = initBookState(g);
  const t = book.verse?.temptation;
  if (!t || book.alignment === "neutral") return false;
  if (typedSlice !== t.word.slice(0, typedSlice.length)) return false;
  if (typedSlice.length >= t.word.length) {
    fallToNeutral(io, room, "temptation");
    return true;
  }
  return false;
};

/** Double-space skip temptation segment. */
const trySkipTemptation = (io, room) => {
  const g = room.game;
  const book = initBookState(g);
  const t = book.verse?.temptation;
  if (!t || !book.temptationActive) return false;
  if (g.typedProgress !== t.start) return false;

  const before = g.currentWord.slice(0, t.start);
  const after = g.currentWord.slice(t.start + t.len);
  g.currentWord = `${before}${after}`.replace(/\s+/g, " ").trim();
  book.verse = { text: g.currentWord, temptation: null };
  book.temptationActive = false;
  g.typedProgress = before.length;
  io.to(room.code).emit("book_temptation_skipped", {
    currentWord: g.currentWord,
    typedProgress: g.typedProgress,
  });
  return true;
};

const consumeAegis = (g) => {
  const book = initBookState(g);
  if (book.alignment !== "holy" || !book.aegisCharges) return false;
  if (g.sanctuaryUntil && Date.now() < g.sanctuaryUntil) return true;
  book.aegisCharges--;
  return true;
};

const applySanctuary = (g, durationMs = 3000) => {
  g.sanctuaryUntil = Date.now() + durationMs;
};

const refreshBookPrompt = (g) => {
  if (!isBookWeapon(g)) return false;
  const book = initBookState(g);
  if (book.alignment === "neutral") {
    offerNeutralPair(g);
  } else {
    offerVerse(g, book.alignment);
  }
  return true;
};

const getBookPublicState = (g) => {
  if (!isBookWeapon(g)) return null;
  const book = initBookState(g);
  return {
    alignment: book.alignment,
    goodProgress: book.goodProgress,
    evilProgress: book.evilProgress,
    neutralIndex: book.neutralIndex,
    offerGood: book.offerGood,
    offerEvil: book.offerEvil,
    committed: book.committed,
    neutralPrefix: book.neutralPrefix || "",
    aegisCharges: book.aegisCharges,
    temptation: book.verse?.temptation || null,
  };
};

const completeBookWord = (io, room, player) => {
  const g = room.game;
  const book = initBookState(g);
  const stunMult = g.bossState === "stunned" ? STUN_DAMAGE_MULTIPLIER : 1;
  const completedWord = g.currentWord;
  let bossDamage = 0;
  let healed = 0;
  const prevHP = g.bossHP;

  if (book.alignment === "neutral") {
    const meta = onNeutralWordComplete(io, room);
    player.wordsTyped++;
    g.totalWordsTyped++;
    return {
      socketId: player.socketId,
      by: player.username,
      word: completedWord,
      weaponTypeId: BOOK_WEAPON_ID,
      damage: 0,
      bossHP: g.bossHP,
      prevHP,
      weaponRage: g.weaponRage || 0,
      bookMeta: meta,
      book: getBookPublicState(g),
    };
  }

  const dmg = computeVerseDamage(completedWord, book.alignment, stunMult);
  applyBossWordDamage(g, dmg);
  bossDamage = dmg;
  player.wordsTyped++;
  player.damageDealt += dmg;
  g.totalWordsTyped++;

  if (book.alignment === "holy") {
    const h = onHolyVerseComplete(g);
    healed = 0;
    if (io) {
      const { addRage, tryOfferUltimate, RAGE_MAX } = require("./weaponRage");
      addRage(g, BOOK_WEAPON_ID);
      tryOfferUltimate(io, room, g);
    }
    return {
      socketId: player.socketId,
      by: player.username,
      word: completedWord,
      weaponTypeId: BOOK_WEAPON_ID,
      damage: bossDamage,
      bossHP: g.bossHP,
      prevHP,
      weaponRage: g.weaponRage || 0,
      aegisCharges: h.aegisCharges,
      book: getBookPublicState(g),
      temptation: book.verse?.temptation || null,
    };
  }

  onDemonVerseComplete(g);
  if (io) {
    const { addRage, tryOfferUltimate } = require("./weaponRage");
    addRage(g, BOOK_WEAPON_ID);
    tryOfferUltimate(io, room, g);
  }
  return {
    socketId: player.socketId,
    by: player.username,
    word: completedWord,
    weaponTypeId: BOOK_WEAPON_ID,
    damage: bossDamage,
    bossHP: g.bossHP,
    prevHP,
    weaponRage: g.weaponRage || 0,
    book: getBookPublicState(g),
    temptation: book.verse?.temptation || null,
  };
};

module.exports = {
  BOOK_WEAPON_ID,
  TRANSFORM_AT,
  isBookWeapon,
  initBookState,
  emitBookPair,
  offerNeutralPair,
  fallToNeutral,
  transformBook,
  tryCommitNeutralPool,
  onNeutralWordComplete,
  onHolyVerseComplete,
  onDemonVerseComplete,
  onBookTypo,
  checkTemptationFall,
  trySkipTemptation,
  consumeAegis,
  applySanctuary,
  refreshBookPrompt,
  getBookPublicState,
  computeVerseDamage,
  completeBookWord,
  HOLY_TYPO_SELF_DMG,
};
