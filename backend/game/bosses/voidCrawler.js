/**
 * Void Crawler — dark void boss.
 * Phase 0 (>66% HP): slow homing orbs, tendril bursts.
 * Phase 1 (33–66%): adds eruption (burst from char pos) + dark pulse + void_zone.
 * Phase 2 (<33%): singularity + densely homing chaos + void_zone.
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
    ["void_orb",    "tendrils",    "void_orb",    "dark_pulse"],
    ["void_orb",    "tendrils",    "dark_pulse",  "eruption",  "void_zone"],
    ["singularity", "void_orb",    "tendrils",    "void_zone", "eruption"],
  ],

  attackDurations: {
    void_orb:    4000,
    tendrils:    3500,
    eruption:    3500,
    dark_pulse:  4500,
    singularity: 6000,
    void_zone:   5000,
  },

  windUps: {
    void_orb:    600,
    tendrils:    500,
    dark_pulse:  800,
    eruption:    900,
    singularity: 1800,
    void_zone:   1200,
  },

  fireIntervals: {
    void_orb:    [2200, 1700, 1300],
    tendrils:    [3200, 2500, 1900],
    eruption:    [2800, 2200, 1700],
    dark_pulse:  [2000, 1600, 1200],
    singularity: [9999, 9999, 9999], // fires once (handled specially)
    void_zone:   [9999, 9999, 9999], // fires once per activation
  },

  orbConfig: {
    speed:       [100, 130, 165],
    homingTurn:  0.035,
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
