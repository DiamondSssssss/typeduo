/**
 * The Watcher — arcane magic boss.
 * Phase 0 (>66% HP): spread, aimed bursts, rain, arcane_volley.
 * Phase 1 (33–66%): adds circle bursts and tracking laser column.
 * Phase 2 (<33%): spiral, hell-mode, multi-column laser, void ring.
 * Special at 10% HP: "Third Eye" — triple-origin circle burst.
 */
module.exports = {
  id:         "watcher",
  name:       "The Watcher",
  tagline:    "An ancient arcane entity that sees all.",
  difficulty: 2,
  maxHP:      550,

  // Movement
  moveSpeed:   [90, 135, 180],
  yBase:       100,
  yRange:      40,

  // Projectile speeds per phase
  projSpeed:   [195, 255, 325],

  // Attack queue per phase (cycles endlessly)
  attackQueues: [
    ["arcane_volley", "spread",  "rain",          "arcane_volley", "normal"],
    ["spread",        "laser",   "circle",         "arcane_volley", "rain",   "laser"],
    ["spiral",        "hell",    "laser",           "arcane_volley", "circle", "laser"],
  ],

  attackDurations: {
    normal:        5000,
    spread:        4500,
    rain:          3200,
    circle:        2800,
    spiral:        5500,
    laser:         3800, // covers columnAttack.warnMs + activeMs
    hell:          8000,
    arcane_volley: 3500,
  },

  // Wind-up delay (ms) before the attack actually fires.
  windUps: {
    circle:        700,
    laser:         1400,
    hell:          1000,
    spiral:        600,
    arcane_volley: 400,
  },

  fireIntervals: {
    normal:        [1000, 750,  550],
    spread:        [2400, 1900, 1400],
    rain:          [270,  210,  155],
    spiral:        [290,  230,  175],
    arcane_volley: [2800, 2200, 1700],
    hell_normal:   [520,  400,  300],
    hell_spiral:   [240,  190,  145],
    hell_rain:     [850,  680,  520],
  },

  spreadConfig: {
    counts:     [3, 5, 7],
    halfSpread: [0.4, 0.55, 0.7],
  },

  // Column attack: tracks player position ("char" mode)
  columnAttack: {
    type:       "laser",
    warnMs:     1800,
    activeMs:   700,
    width:      110,
    damage:     22,
    color:      0xff3333,
    targetMode: "char",
  },

  special: {
    id:           "third_eye",
    name:         "Third Eye",
    triggerHpPct: 0.1,
    windUpMs:     2000,
    durationMs:   9000,
    attackType:   "hell",
  },
};
