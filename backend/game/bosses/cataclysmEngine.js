/** Cataclysm Engine — 8★ cataclysm. Overcharge, minions, paralyze, bullet hell. */
module.exports = {
  id: "cataclysm_engine",
  name: "Cataclysm Engine",
  tagline: "A war machine that punishes every hesitation.",
  difficulty: 8,
  maxHP: 1200,
  moveSpeed: [92, 125, 168],
  yBase: 100,
  yRange: 55,
  projSpeed: [200, 260, 330],
  attackQueues: [["tempest"]],
  attackDurations: {},
  windUps: {},
  fireIntervals: {},
  combatProfile: {
    attacks: [
      { id: "overcharge_blast",       weight: 18 },
      { id: "summon_typable_minions", weight: 17 },
      { id: "paralyze_typer",         weight: 15 },
      { id: "laser_beam",             weight: 14 },
      { id: "ruin_pillars",           weight: 13 },
      { id: "tempest",                weight: 10 },
      { id: "chain_lightning",        weight: 10 },
      { id: "melee_swipe",            weight: 8, maxRange: 200 },
    ],
    ultimate: { id: "cataclysm_ultimate", triggerHpPct: 0.42, name: "Worldbreaker" },
  },
};
