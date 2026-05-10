/**
 * Storm Drake — lightning and wind boss.
 * Phase 0 (>66% HP): thunder rain + horizontal sweeps.
 * Phase 1 (33–66%): adds lightning bolt columns + chain lightning.
 * Phase 2 (<33%): tempest multi-pattern chaos.
 * Special at 10% HP: "Thunderstrike" — five simultaneous column strikes.
 */
module.exports = {
  id:         "storm_drake",
  name:       "Storm Drake",
  tagline:    "Rider of storms, herald of lightning.",
  difficulty: 2,
  maxHP:      620,

  moveSpeed:   [110, 160, 220],
  yBase:       95,
  yRange:      35,
  projSpeed:   [210, 270, 345],

  attackQueues: [
    ["thunder_rain", "sweep",        "thunder_rain", "sweep",           "normal"],
    ["sweep",        "lightning_bolt","chain_lightning","thunder_rain",  "sweep"],
    ["tempest",      "lightning_bolt","chain_lightning","thunder_rain",  "sweep"],
  ],

  attackDurations: {
    normal:          4500,
    thunder_rain:    3000,
    sweep:           3500,
    lightning_bolt:  2500,
    chain_lightning: 4000,
    tempest:         7500,
  },

  windUps: {
    lightning_bolt:  800,
    chain_lightning: 600,
    tempest:         1200,
    sweep:           400,
  },

  fireIntervals: {
    normal:          [1000, 750, 550],
    thunder_rain:    [180,  140, 100],
    sweep:           [3000, 2400, 1800], // how often a new sweep row fires
    chain_lightning: [350,  280, 210],
    tempest_sweep:   [2200, 1700, 1200],
    tempest_bolt:    [2000, 1500, 1100],
    tempest_rain:    [180,  140, 100],
  },

  spreadConfig: {
    counts:     [3, 3, 5],
    halfSpread: [0.3, 0.4, 0.5],
  },

  sweepConfig: {
    counts:    [5, 7, 9],
    gap:       32,
    speedMult: 0.9,
  },

  chainCount: [2, 3, 4],

  // Column: lightning bolt targets CHAR x
  columnAttack: {
    type:       "lightning_bolt",
    warnMs:     900,
    activeMs:   450,
    width:      70,
    damage:     20,
    color:      0xfde68a,
    targetMode: "char",
  },

  special: {
    id:           "thunderstrike",
    name:         "Thunderstrike",
    triggerHpPct: 0.1,
    windUpMs:     2000,
    durationMs:   8000,
    attackType:   "tempest",
  },
};
