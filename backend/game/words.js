const SHORT_WORDS = [
  "alpha","brave","crown","delta","ember","frost","giant","hazel",
  "ivory","jolly","lunar","mango","noble","ocean","pixel","quest",
  "raven","solar","tidal","unity","vivid","whale","young","zebra",
  "amber","bloom","candle","dream","earth","flame","glide","honey",
  "iris","jade","kite","lemon","mint","nest","opal","plume",
  "rust","sage","tide","void","wave","yarn","zinc","lace",
];

const MED_WORDS = [
  "knight","thunder","phantom","horizon","cascade","monarch","crystal",
  "twilight","forge","shimmer","mystic","dynamic","blizzard","voyage",
  "ancient","kingdom","warrior","channel","harmony","journey","balance",
  "skyline","crimson","scarlet","lantern","compass","vortex","bramble",
  "celebrate","infinite","frostbite","midnight","phoenix","nebula",
  "aurora","echelon","glimmer","haunting","intense","labyrinth",
  "moonlight","outburst","panorama","quasar","radiant","shadow",
];

const HARD_WORDS = [
  "constellation","synchronize","kaleidoscope","labyrinthine","phenomenon",
  "encyclopedia","thunderstorm","obliterating","incandescent","metamorphosis",
  "cryptography","juxtaposition","extraordinary","phosphorescent",
  "perpendicular","serendipitous","cataclysm","effervescent","luminescent",
  "renaissance","magnanimous","subterranean","ubiquitous","voracious",
  "reverberation","orchestration","transcendental","incomprehensible",
  "interplanetary","protagonist","philosophical","astronomical",
  "circumstantial","indistinguishable","extravagance","overwhelmingly",
];

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
