/** Phantom Reaper — melee/dash/teleport specialist (★★★). Uses modern combatProfile. */
module.exports = {
  id: "phantom_reaper",
  name: "Phantom Reaper",
  tagline: "Death moves faster than you can type.",
  difficulty: 3,
  maxHP: 640,
  moveSpeed: [70, 95, 125],
  yBase: 108,
  yRange: 45,
  projSpeed: [140, 180, 230],
  // Legacy fields unused when combatProfile is set; kept for fallback tooling
  attackQueues: [["melee_swipe"], ["boss_dash"], ["phantom_volley"]],
  attackDurations: { melee_swipe: 3000 },
  windUps: {},
  fireIntervals: {},
  combatProfile: {
    attacks: [
      { id: "melee_swipe",    weight: 28, maxRange: 200 },
      { id: "boss_dash",      weight: 24, minRange: 150 },
      { id: "boss_teleport",  weight: 14 },
      { id: "shadow_runes",   weight: 18 },
      { id: "phantom_volley", weight: 12, minRange: 90 },
      { id: "ruin_pillars",   weight: 8 },
    ],
    ultimate: { id: "reaper_ultimate", triggerHpPct: 0.5, name: "Harvest Moon" },
  },
};
