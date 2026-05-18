/**
 * Regenerates backend/game/words.js with 1000+ words per difficulty tier.
 * Run: node scripts/generate-words.js
 */
const fs = require("fs");
const https = require("https");
const path = require("path");

const fetchText = (url) =>
  new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let d = "";
      res.on("data", (c) => { d += c; });
      res.on("end", () => resolve(d));
    }).on("error", reject);
  });

const isPlayable = (w) => {
  if (!/^[a-z]+$/.test(w)) return false;
  if (!/[aeiouy]/.test(w)) return false;
  if (new Set(w).size < 2) return false;
  if (/(.)\1\1/.test(w)) return false; // triple letter
  return true;
};

const dedupeSort = (arr) => [...new Set(arr)].sort();

const pickAtLeast = (arr, min) => {
  if (arr.length <= min) return arr;
  // Fisher–Yates shuffle then take min for variety across regenerations use seeded sort by hash? 
  // Just use full pool if > min — more variety is better.
  return arr;
};

async function main() {
  const [googleRaw, alphaRaw] = await Promise.all([
    fetchText("https://raw.githubusercontent.com/first20hours/google-10000-english/master/google-10000-english-no-swears.txt"),
    fetchText("https://raw.githubusercontent.com/dwyl/english-words/master/words_alpha.txt"),
  ]);

  const google = googleRaw.split(/\r?\n/).map((w) => w.trim().toLowerCase()).filter(isPlayable);
  const alpha = alphaRaw.split(/\r?\n/).map((w) => w.trim().toLowerCase()).filter(isPlayable);

  const existing = {
    short: require("../game/words.js").SHORT_WORDS,
    med: require("../game/words.js").MED_WORDS,
    hard: require("../game/words.js").HARD_WORDS,
  };

  const shortPool = dedupeSort([
    ...existing.short,
    ...google.filter((w) => w.length >= 3 && w.length <= 5),
    ...alpha.filter((w) => w.length >= 3 && w.length <= 5),
  ]);

  const medPool = dedupeSort([
    ...existing.med,
    ...google.filter((w) => w.length >= 6 && w.length <= 9),
    ...alpha.filter((w) => w.length >= 6 && w.length <= 9),
  ]);

  const hardPool = dedupeSort([
    ...existing.hard,
    ...google.filter((w) => w.length >= 10 && w.length <= 16),
    ...alpha.filter((w) => w.length >= 10 && w.length <= 16),
  ]);

  const MIN = 1000;
  const CAP = 3000; // keep file size reasonable; still 3× minimum

  const prioritize = (all, preferred) => {
    const set = new Set(all);
    const head = preferred.filter((w) => set.has(w));
    const tail = all.filter((w) => !head.includes(w));
    return [...head, ...tail];
  };

  const shortWords = prioritize(shortPool, existing.short).slice(0, CAP);
  const medWords = prioritize(medPool, existing.med).slice(0, CAP);
  const hardWords = prioritize(hardPool, existing.hard).slice(0, CAP);

  if (shortWords.length < MIN || medWords.length < MIN || hardWords.length < MIN) {
    console.error("Pool too small:", shortWords.length, medWords.length, hardWords.length);
    process.exit(1);
  }

  const formatArray = (name, words) => {
    const lines = [];
    for (let i = 0; i < words.length; i += 8) {
      lines.push(`  ${words.slice(i, i + 8).map((w) => JSON.stringify(w)).join(",")}`);
    }
    return `const ${name} = [\n${lines.join(",\n")}\n];`;
  };

  const out = `/**
 * Word pools for TypeDuo — ${shortWords.length} short, ${medWords.length} medium, ${hardWords.length} hard.
 * Regenerate: node scripts/generate-words.js
 */
${formatArray("SHORT_WORDS", shortWords)}

${formatArray("MED_WORDS", medWords)}

${formatArray("HARD_WORDS", hardWords)}

const PHASE_LABELS = ["short", "medium", "hard"];

const getPhase = (hp, maxHP) => {
  const pct = Math.max(0, Math.min(1, (hp || 0) / Math.max(1, maxHP || 1)));
  if (pct > 0.66) return 0;
  if (pct > 0.33) return 1;
  return 2;
};

const getDifficultyWord = (hp, maxHP) => {
  const p = getPhase(hp, maxHP);
  const pool = p === 0 ? SHORT_WORDS : p === 1 ? MED_WORDS : HARD_WORDS;
  return pool[Math.floor(Math.random() * pool.length)];
};

const getDifficultyPhase = (hp, maxHP) => PHASE_LABELS[getPhase(hp, maxHP)];

const computeWordDamage = (word) =>
  Math.max(6, Math.min(30, Math.round((word?.length || 0) * 1.7)));

module.exports = {
  SHORT_WORDS, MED_WORDS, HARD_WORDS,
  getPhase, getDifficultyWord, getDifficultyPhase, computeWordDamage,
};
`;

  const target = path.join(__dirname, "../game/words.js");
  fs.writeFileSync(target, out, "utf8");
  console.log(`Wrote ${target}`);
  console.log(`  SHORT: ${shortWords.length}`);
  console.log(`  MED:   ${medWords.length}`);
  console.log(`  HARD:  ${hardWords.length}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
