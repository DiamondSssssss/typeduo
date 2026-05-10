/**
 * Void Crawler — dark void boss.
 * Phase 0 (>66% HP): slow homing orbs, tendril bursts.
 * Phase 1 (33–66%): adds eruption (burst from char pos) + dark pulse.
 * Phase 2 (<33%): singularity + densely homing chaos.
 * Special at 10% HP: "Void Collapse" — homing orbs + eruption combo.
 */
module.exports = {
  id:         "void_crawler",
  name:       "Void Crawler",
  tagline:    "From the space between stars.",
  difficulty: 3,
  maxHP:      720,

  moveSpeed:   [70, 100, 140],
  yBase:       105,
  yRange:      50,
  projSpeed:   [150, 200, 265],

  attackQueues: [
    ["void_orb",    "tendrils",    "void_orb",    "eruption"],
    ["void_orb",    "tendrils",    "dark_pulse",  "eruption",  "void_orb"],
    ["singularity", "void_orb",    "tendrils",    "dark_pulse", "eruption"],
  ],

  attackDurations: {
    void_orb:    4000,
    tendrils:    3500,
    eruption:    3000,
    dark_pulse:  4500,
    singularity: 6000,
  },

  windUps: {
    void_orb:    600,
    tendrils:    500,
    dark_pulse:  800,
    singularity: 1800,
  },

  fireIntervals: {
    void_orb:    [2200, 1700, 1300],
    tendrils:    [3200, 2500, 1900],
    eruption:    [2500, 2000, 1500],
    dark_pulse:  [2000, 1600, 1200],
    singularity: [9999, 9999, 9999], // fires once (handled specially)
  },

  orbConfig: {
    speed:       [100, 130, 165],
    homingTurn:  0.035, // per-tick turn strength (applied each tick)
  },

  // No column attack
  columnAttack: null,

  special: {
    id:           "void_collapse",
    name:         "Void Collapse",
    triggerHpPct: 0.1,
    windUpMs:     2500,
    durationMs:   10000,
    attackType:   "singularity",
  },
};
