/**
 * Boss: Glacier — Cold, patient, inevitable.
 * Theme: ice, crystal, slow-but-suffocating coverage.
 * Unique mechanics:
 *   frost_ring  — very slow expanding ring, requires threading gaps
 *   avalanche   — horizontal wave from alternating sides, dense horizontal sweep
 *   blizzard    — relentless dense rain covering the full arena width
 */
module.exports = {
  id:         "glacier",
  name:       "Glacier",
  tagline:    "Cold, patient, inevitable.",
  difficulty: 3,
  maxHP:      760,

  moveSpeed: [58,  88, 130],  // slow and deliberate
  yBase:     108,
  yRange:     32,

  projSpeed: [168, 225, 295],

  attackQueues: [
    ["ice_shard", "blizzard",  "ice_shard",  "frost_ring"],
    ["blizzard",  "ice_shard", "freeze_ray", "frost_ring"],
    ["avalanche", "freeze_ray","blizzard",   "frost_ring", "ice_shard"],
  ],

  attackDurations: {
    ice_shard:  4000,
    blizzard:   3500,
    frost_ring: 4500,
    freeze_ray: 2500,
    avalanche:  4000,
  },

  windUps: {
    frost_ring: 900,
    freeze_ray: 700,
    avalanche:  1300,
    blizzard:   600,
  },

  fireIntervals: {
    ice_shard: [820, 630, 460],
    blizzard:  [150, 110,  80],
    frost_ring:[3600, 3600, 3600], // fires once per attack
    avalanche: [2200, 1700, 1200],
  },

  spreadConfig: {
    counts:     [3, 5, 7],
    halfSpread: [0.20, 0.30, 0.42], // tight ice-shard cluster
  },

  sweepConfig: {
    counts:   [9, 12, 16],
    gap:      30,
    speedMult: 0.80,
  },

  // Column targets character — freeze_ray precision beam
  columnAttack: {
    type:       "freeze_ray",
    warnMs:     1100,
    activeMs:   620,
    width:      76,
    damage:     22,
    color:      0x7dd3fc,
    targetMode: "char",
  },

  special: {
    id:          "permafrost",
    name:        "Permafrost",
    triggerHpPct: 0.10,
    windUpMs:    2500,
    durationMs:  10000,
    attackType:  "avalanche",
  },
};
