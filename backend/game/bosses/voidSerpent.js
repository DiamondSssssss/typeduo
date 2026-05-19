/** Void Serpent — apex predator, full kit (★★★★★). */
module.exports = {
  id: "void_serpent",
  name: "Void Serpent",
  tagline: "Coils of nothingness devour the unwary.",
  difficulty: 5,
  maxHP: 950,
  moveSpeed: [65, 92, 130],
  yBase: 105,
  yRange: 50,
  projSpeed: [160, 210, 270],
  attackQueues: [["void_orb"]],
  attackDurations: {},
  windUps: {},
  fireIntervals: {},
  shieldMax: 60,
  shieldPhase: 1,
  combatProfile: {
    attacks: [
      { id: "melee_swipe",    weight: 18, maxRange: 210 },
      { id: "boss_dash",      weight: 22, minRange: 140 },
      { id: "boss_teleport",  weight: 16 },
      { id: "shadow_runes",   weight: 16 },
      { id: "void_orb",       weight: 14, minRange: 80 },
      { id: "phantom_volley", weight: 10, minRange: 100 },
    ],
    ultimate: { id: "serpent_ultimate", triggerHpPct: 0.5, name: "Abyss Maw" },
  },
};
