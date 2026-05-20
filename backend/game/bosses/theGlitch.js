/** The Glitch — 6★ mythic. Dies once, then becomes The Entity with a new kit. */
module.exports = {
  id: "the_glitch",
  name: "The Glitch",
  tagline: "Reality tears. It has a second form.",
  difficulty: 6,
  maxHP: 520,
  moveSpeed: [78, 105, 140],
  yBase: 108,
  yRange: 48,
  projSpeed: [175, 225, 285],
  attackQueues: [["dark_pulse"]],
  attackDurations: {},
  windUps: {},
  fireIntervals: {},
  combatProfile: {
    attacks: [
      { id: "boss_teleport",  weight: 20, minRange: 60 },
      { id: "shadow_runes",   weight: 18 },
      { id: "phantom_volley", weight: 16, minRange: 90 },
      { id: "void_orb",       weight: 14, minRange: 70 },
      { id: "melee_swipe",    weight: 14, maxRange: 200 },
    ],
    ultimate: { id: "glitch_ultimate", triggerHpPct: 0.55, name: "System Crash" },
  },
  transform: {
    secondForm: {
      name: "The Entity",
      visualKey: "the_entity",
      color: 0x22d3ee,
      maxHP: 640,
      shieldMax: 40,
      moveSpeed: [95, 125, 165],
      projSpeed: [195, 250, 310],
      yBase: 100,
      combatProfile: {
        attacks: [
          { id: "boss_dash",      weight: 22, minRange: 130 },
          { id: "melee_swipe",    weight: 20, maxRange: 220 },
          { id: "ember_pools",    weight: 18 },
          { id: "frost_bolt",     weight: 16, minRange: 80 },
          { id: "singularity",    weight: 12, minRange: 100 },
        ],
        ultimate: { id: "entity_ultimate", triggerHpPct: 0.45, name: "Null Collapse" },
      },
    },
  },
};
