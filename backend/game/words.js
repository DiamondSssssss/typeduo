const SHORT_WORDS = [
  "alpha","brave","crown","delta","ember","frost","giant","hazel",
  "ivory","jolly","lunar","mango","noble","ocean","pixel","quest",
  "raven","solar","tidal","unity","vivid","whale","young","zebra",
  "amber","bloom","candle","dream","earth","flame","glide","honey",
  "iris","jade","kite","lemon","mint","nest","opal","plume",
  "rust","sage","tide","void","wave","yarn","zinc","lace",
  "apple","berry","brick","chart","cliff","crane","dance","depot",
  "eager","eagle","fault","fence","flora","fluid","ghost","glass",
  "glory","grand","grape","grass","happy","haven","heart","hover",
  "index","jewel","juice","laser","limit","lucky","magic","maker",
  "match","merit","model","mouse","music","nerve","north","nurse",
  "oasis","orbit","paper","party","pearl","pilot","plant","porch",
  "pound","pride","punch","quiet","radar","radio","rebel","river",
  "robot","route","scale","scene","sheep","shift","shirt","smile",
  "smoke","snake","space","spark","storm","stone","story","sugar",
  "super","table","tiger","track","train","trust","union","urban",
  "value","video","virus","voice","watch","water","wheat","wheel",
  "white","witch","world","youth","acute","baker","cabin","diary"
];

const MED_WORDS = [
  "knight","thunder","phantom","horizon","cascade","monarch","crystal",
  "twilight","forge","shimmer","mystic","dynamic","blizzard","voyage",
  "ancient","kingdom","warrior","channel","harmony","journey","balance",
  "skyline","crimson","scarlet","lantern","compass","vortex","bramble",
  "celebrate","infinite","frostbite","midnight","phoenix","nebula",
  "aurora","echelon","glimmer","haunting","intense","labyrinth",
  "moonlight","outburst","panorama","quasar","radiant","shadow",
  "ability","absence","academy","account","advance","airport","battery",
  "bedroom","blanket","cabinet","captain","capture","careful","century",
  "chapter","circuit","classic","climate","cluster","command","comment",
  "complex","concept","concert","connect","control","courage","culture",
  "current","delight","density","despair","diamond","disease","display",
  "distance","ecology","economy","edition","element","emotion","endless",
  "freedom","gallery","general","gravity","habitat","healthy","history",
  "holiday","hopeful","housing","illusion","impulse","include","machine",
  "majesty","miracle","mystery","network","nuclear","passion","plastic",
  "popular","predict","present","project","promise","protest","pyramid",
  "radical","realize","reflect","silence","spatial","station","surface",
  "survive","typical","venture","village","volcano","weather","western",
  "whisper","bargain","builder","diamond","fantasy","fortune","freedom"
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
  "accelerate","acceptable","accomplish","accumulate","accurately",
  "additional","adequately","adjustment","admiration","aggressive",
  "agriculture","allocation","ambassador","appearance","appreciate",
  "artificial","assignment","assistance","atmosphere","attraction",
  "background","basketball","capability","collection","combination",
  "commercial","commission","commitment","communication","comparison",
  "competitor","completely","conclusion","confidence","connection",
  "consistent","continuous","contribute","convention","conviction",
  "definition","democratic","department","depression","difference",
  "difficulty","discipline","discussion","distribute","ecological",
  "efficiency","electrical","electronic","elementary","employment",
  "enterprise","definitely","everywhere","exhibition","experience",
  "expression","frequently","generation","government","healthcare",
  "historical","hypothesis","illustrate","impossible","impression",
  "independent","individual","industrial","ingredient","innovation",
  "institution","intelligence","investment","laboratory","leadership",
  "legitimate","literature","management","microphone","motorcycle",
  "mysterious","navigation","negotiation","observation","occupation",
  "parliament","particular","percentage","perception","permission",
  "photograph","population","production","profession","proportion",
  "psychology","reflection","researcher","resolution","restaurant",
  "retirement","revolution","scholarship","spectacular","strawberry",
  "successful","sufficient","television","tournament","understand",
  "unexpected","university","vocabulary","vulnerable","wilderness"
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