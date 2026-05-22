const { NEUTRAL_GOOD_10, NEUTRAL_EVIL_10, NEUTRAL_PAIR_COUNT } = require("./neutralPairs");
const { HOLY_VERSES } = require("./holyVerses");
const { DEMON_VERSES } = require("./demonVerses");
const { EVIL_TEMPT_WORDS, GOOD_TEMPT_WORDS } = require("./temptationLex");

const TEMPTATION_CHANCE = 0.2;

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/** Build verse text; ~20% chance embed opposite-alignment temptation word. */
const buildVerseOffer = (alignment) => {
  const pool = alignment === "holy" ? HOLY_VERSES : DEMON_VERSES;
  const temptPool = alignment === "holy" ? EVIL_TEMPT_WORDS : GOOD_TEMPT_WORDS;
  let text = pick(pool);
  let temptation = null;

  if (Math.random() < TEMPTATION_CHANCE) {
    const tw = pick(temptPool);
    const insertAt = Math.max(0, text.lastIndexOf(" "));
    if (insertAt > 0) {
      const before = text.slice(0, insertAt);
      const after = text.slice(insertAt + 1);
      temptation = {
        word: tw,
        kind: alignment === "holy" ? "evil" : "good",
        start: before.length + 1,
        len: tw.length,
      };
      text = `${before} ${tw} ${after}`;
    }
  }

  return { text, temptation };
};

const getNeutralPair = (index) => {
  const i = index % NEUTRAL_PAIR_COUNT;
  return {
    index: i,
    good: NEUTRAL_GOOD_10[i],
    evil: NEUTRAL_EVIL_10[i],
  };
};

const computeVerseDamage = (text, alignment, stunMult = 1) => {
  const len = text?.length || 0;
  const base = Math.round(8 + len * 1.35);
  const mult = alignment === "demon" ? 1.42 : 1.02;
  return Math.round(base * mult * stunMult);
};

module.exports = {
  NEUTRAL_PAIR_COUNT,
  getNeutralPair,
  buildVerseOffer,
  computeVerseDamage,
  HOLY_VERSES,
  DEMON_VERSES,
};
