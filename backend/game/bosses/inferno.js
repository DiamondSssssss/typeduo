/**
 * Boss: Inferno — The living pyre. Heat incarnate.
 * Theme: fire, molten, chaotic arcs and eruptions.
 * Unique mechanic: fire_pillar column targets a RANDOM x (not char/boss),
 * forcing the runner to watch unpredictable zones.
 */
module.exports = {
  id:         "inferno",
  name:       "Inferno",
  tagline:    "The living pyre. Heat incarnate.",
  difficulty: 3,
  maxHP:      600,

  moveSpeed: [120, 175, 240],  // erratic, medium-high speed
  yBase:      85,
  yRange:     55,

  projSpeed: [195, 260, 335],

  attackQueues: [
    ["molten_rain", "ember_arc", "molten_rain", "fire_pillar"],
    ["fire_pillar", "ember_arc", "wildfire",    "molten_rain"],
    ["wildfire",    "fire_pillar", "ember_arc", "molten_rain", "wildfire"],
  ],

  attackDurations: {
    molten_rain: 3200,
    ember_arc:   4000,
    fire_pillar: 2800,
    wildfire:    5500,
  },

  windUps: {
    fire_pillar: 1100,
    wildfire:    800,
    ember_arc:   500,
  },

  fireIntervals: {
    molten_rain:      [320, 240, 165],
    ember_arc:        [900, 700, 520],
    wildfire_normal:  [460, 360, 270],
    wildfire_spread:  [1700, 1250, 900],
    wildfire_rain:    [750, 580, 420],
  },

  spreadConfig: {
    counts:     [4, 6, 8],
    halfSpread: [0.35, 0.50, 0.65],
  },

  // Column attack fires at a RANDOM x every time (targetMode: "random")
  columnAttack: {
    type:       "fire_pillar",
    warnMs:     1200,
    activeMs:   600,
    width:      88,
    damage:     22,
    color:      0xff6600,
    targetMode: "random",
  },

  special: {
    id:          "eruption_burst",
    name:        "Eruption Burst",
    triggerHpPct: 0.10,
    windUpMs:    2200,
    durationMs:  8000,
    attackType:  "wildfire",
  },
};
