/** Cinder Maw — fire hazards + melee (★★★★). */
module.exports = {
  id: "cinder_maw",
  name: "Cinder Maw",
  tagline: "The arena becomes an oven.",
  difficulty: 4,
  maxHP: 720,
  moveSpeed: [60, 88, 115],
  yBase: 112,
  yRange: 40,
  projSpeed: [150, 195, 250],
  attackQueues: [["ember_pools"]],
  attackDurations: {},
  windUps: {},
  fireIntervals: {},
  combatProfile: {
    attacks: [
      { id: "melee_swipe",   weight: 22, maxRange: 190, /* uses default red swipe */ },
      { id: "ember_pools",   weight: 26 },
      { id: "boss_dash",     weight: 20, minRange: 130 },
      { id: "boss_teleport", weight: 12 },
      { id: "void_orb",      weight: 10, minRange: 100 },
    ],
    ultimate: { id: "cinder_ultimate", triggerHpPct: 0.5, name: "Inferno Crown" },
  },
};
