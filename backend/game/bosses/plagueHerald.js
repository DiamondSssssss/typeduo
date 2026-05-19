/** Plague Herald — toxic pools and poison. */
module.exports = {
  id: "plague_herald", name: "Plague Herald",
  tagline: "Where it walks, life withers.", difficulty: 3, maxHP: 650,
  moveSpeed: [75, 110, 150], yBase: 100, yRange: 45,
  projSpeed: [150, 200, 260],
  attackQueues: [
    ["spore_burst", "sick_rain", "spore_burst", "toxic_pool"],
    ["toxic_pool", "plague_wave", "sick_rain", "spore_burst"],
    ["plague_wave", "toxic_pool", "sick_rain", "spore_burst", "plague_wave"],
  ],
  attackDurations: { spore_burst: 3200, sick_rain: 3500, toxic_pool: 5000, plague_wave: 3800 },
  windUps: { toxic_pool: 1000, plague_wave: 800 },
  fireIntervals: {
    spore_burst: [900, 700, 550], sick_rain: [400, 320, 240],
    toxic_pool: [9999, 9999, 9999], plague_wave: [9999, 9999, 9999],
  },
  spreadConfig: { counts: [5, 7, 9], halfSpread: [0.4, 0.55, 0.7] },
  columnAttack: null,
  special: { id: "pandemic", name: "Pandemic", triggerHpPct: 0.1, windUpMs: 2200, durationMs: 9000, attackType: "plague_wave" },
};
