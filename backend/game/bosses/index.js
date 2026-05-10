const watcher     = require("./watcher");
const stormDrake  = require("./stormDrake");
const voidCrawler = require("./voidCrawler");
const inferno     = require("./inferno");
const glacier     = require("./glacier");

const BOSSES = {
  [watcher.id]:     watcher,
  [stormDrake.id]:  stormDrake,
  [voidCrawler.id]: voidCrawler,
  [inferno.id]:     inferno,
  [glacier.id]:     glacier,
};

const getBoss = (id) => BOSSES[id] || watcher;

const BOSS_LIST = Object.values(BOSSES).map(({ id, name, tagline, difficulty, maxHP }) => ({
  id, name, tagline, difficulty, maxHP,
}));

module.exports = { BOSSES, getBoss, BOSS_LIST };
