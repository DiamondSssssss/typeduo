/** Rust Golem — slow mechanical boss, magnet pull. */
module.exports = {
  id: "rust_golem", name: "Rust Golem",
  tagline: "Ancient iron that never rests.", difficulty: 2, maxHP: 580,
  moveSpeed: [55, 80, 110], yBase: 115, yRange: 35,
  projSpeed: [130, 170, 220],
  attackQueues: [
    ["rust_shot", "gear_spread", "rust_shot", "scrap_beam"],
    ["shockwave", "rust_shot", "magnet_pull", "gear_spread"],
    ["magnet_pull", "shockwave", "gear_spread", "scrap_beam", "shockwave"],
  ],
  attackDurations: { rust_shot: 3500, gear_spread: 3000, shockwave: 4000, magnet_pull: 4500, scrap_beam: 2800 },
  windUps: { shockwave: 700, magnet_pull: 900, scrap_beam: 1000 },
  fireIntervals: {
    rust_shot: [1100, 900, 700], gear_spread: [2800, 2200, 1700],
    shockwave: [9999, 9999, 9999], magnet_pull: [9999, 9999, 9999],
  },
  spreadConfig: { counts: [4, 5, 7], halfSpread: [0.3, 0.45, 0.55] },
  columnAttack: { type: "scrap_beam", warnMs: 1100, activeMs: 550, width: 80, damage: 20, color: 0xb45309, targetMode: "random" },
  special: { id: "meltdown", name: "Meltdown", triggerHpPct: 0.1, windUpMs: 2000, durationMs: 8000, attackType: "shockwave" },
  combatProfile: {
    attacks: [
      { id: "melee_swipe",  weight: 22, maxRange: 185 },
      { id: "rust_shot",    weight: 20, minRange: 50 },
      { id: "shockwave",    weight: 18, maxRange: 260 },
      { id: "magnet_pull",  weight: 14, minRange: 80, maxRange: 350 },
      { id: "boss_dash",    weight: 16, minRange: 160 },
      { id: "gear_spread",  weight: 10, minRange: 40 },
    ],
    ultimate: { id: "matron_ultimate", triggerHpPct: 0.5, name: "Iron Overload" },
  },
};
