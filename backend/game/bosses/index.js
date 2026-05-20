const watcher     = require("./watcher");
const stormDrake  = require("./stormDrake");
const voidCrawler = require("./voidCrawler");
const inferno     = require("./inferno");
const glacier     = require("./glacier");
const rustGolem   = require("./rustGolem");
const plagueHerald = require("./plagueHerald");
const chronarch   = require("./chronarch");
const leviathan   = require("./leviathan");
const sovereign   = require("./sovereign");
const phantomReaper = require("./phantomReaper");
const cinderMaw     = require("./cinderMaw");
const ironMatron    = require("./ironMatron");
const voidSerpent   = require("./voidSerpent");
const theGlitch     = require("./theGlitch");
const feedbackLeech = require("./feedbackLeech");
const { DIFFICULTY_LABELS } = require("../difficultyTiers");

const BOSSES = {
  [watcher.id]:      watcher,
  [stormDrake.id]:   stormDrake,
  [voidCrawler.id]:  voidCrawler,
  [inferno.id]:      inferno,
  [glacier.id]:      glacier,
  [rustGolem.id]:    rustGolem,
  [plagueHerald.id]: plagueHerald,
  [chronarch.id]:    chronarch,
  [leviathan.id]:    leviathan,
  [sovereign.id]:    sovereign,
  [phantomReaper.id]: phantomReaper,
  [cinderMaw.id]:     cinderMaw,
  [ironMatron.id]:    ironMatron,
  [voidSerpent.id]:   voidSerpent,
  [theGlitch.id]:     theGlitch,
  [feedbackLeech.id]: feedbackLeech,
};

const getBoss = (id) => BOSSES[id] || watcher;

const BOSS_LIST = Object.values(BOSSES).map(({ id, name, tagline, difficulty, maxHP, color }) => ({
  id,
  name,
  tagline,
  difficulty,
  maxHP,
  ...(color != null ? { color: `#${Number(color).toString(16).padStart(6, "0")}` } : {}),
}));

module.exports = { BOSSES, getBoss, BOSS_LIST, DIFFICULTY_LABELS };
