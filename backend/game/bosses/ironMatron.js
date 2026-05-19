/** Iron Matron — beginner-friendly hybrid boss (★★). */
module.exports = {
  id: "iron_matron",
  name: "Iron Matron",
  tagline: "Forged in wrath, tempered in battle.",
  difficulty: 1,
  maxHP: 520,
  moveSpeed: [50, 72, 95],
  yBase: 118,
  yRange: 30,
  projSpeed: [120, 155, 200],
  attackQueues: [["rust_shot"]],
  attackDurations: {},
  windUps: {},
  fireIntervals: {},
  combatProfile: {
    attacks: [
      { id: "melee_swipe",  weight: 25, maxRange: 180 },
      { id: "rust_shot",    weight: 22, minRange: 60 },
      { id: "gear_spread",  weight: 18, minRange: 40 },
      { id: "boss_dash",    weight: 15, minRange: 180 },
      { id: "shadow_runes", weight: 12 },
    ],
    ultimate: { id: "matron_ultimate", triggerHpPct: 0.5, name: "Iron Judgment" },
  },
};
