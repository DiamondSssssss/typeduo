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
};

const getBoss = (id) => BOSSES[id] || watcher;

const BOSS_LIST = Object.values(BOSSES).map(({ id, name, tagline, difficulty, maxHP }) => ({
  id, name, tagline, difficulty, maxHP,
}));

module.exports = { BOSSES, getBoss, BOSS_LIST };
