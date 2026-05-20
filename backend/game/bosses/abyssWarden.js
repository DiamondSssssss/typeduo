/** Abyss Warden — 7★ abyssal. Shield words, ruin pillars, sustained laser. */
module.exports = {
  id: "abyss_warden",
  name: "Abyss Warden",
  tagline: "Break its wards or the abyss breaks you.",
  difficulty: 7,
  maxHP: 1050,
  moveSpeed: [88, 118, 155],
  yBase: 105,
  yRange: 50,
  projSpeed: [190, 245, 310],
  attackQueues: [["dark_pulse"]],
  attackDurations: {},
  windUps: {},
  fireIntervals: {},
  combatProfile: {
    attacks: [
      { id: "shield_word",      weight: 18 },
      { id: "laser_beam",       weight: 17 },
      { id: "ruin_pillars",     weight: 16 },
      { id: "overcharge_blast", weight: 14 },
      { id: "shadow_runes",     weight: 12 },
      { id: "phantom_volley",   weight: 10, minRange: 80 },
      { id: "boss_dash",        weight: 10, minRange: 140 },
    ],
    ultimate: { id: "warden_ultimate", triggerHpPct: 0.48, name: "Abyss Collapse" },
  },
};
