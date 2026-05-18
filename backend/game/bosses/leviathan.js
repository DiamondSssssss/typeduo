/** Abyss Leviathan — tidal lanes and whirlpool. */
module.exports = {
  id: "leviathan", name: "Abyss Leviathan",
  tagline: "The deep claims all.", difficulty: 3, maxHP: 780,
  moveSpeed: [80, 115, 155], yBase: 95, yRange: 50,
  projSpeed: [160, 215, 280],
  attackQueues: [
    ["spray", "tidal_sweep", "spray", "depth_charge"],
    ["whirlpool", "tidal_sweep", "spray", "depth_charge"],
    ["tidal_sweep", "whirlpool", "depth_charge", "spray", "tidal_sweep"],
  ],
  attackDurations: { spray: 3000, tidal_sweep: 4500, depth_charge: 3500, whirlpool: 5000 },
  windUps: { tidal_sweep: 900, whirlpool: 1100, depth_charge: 700 },
  fireIntervals: {
    spray: [700, 550, 420], depth_charge: [500, 400, 300],
    tidal_sweep: [9999, 9999, 9999], whirlpool: [9999, 9999, 9999],
  },
  spreadConfig: { counts: [4, 6, 8], halfSpread: [0.35, 0.5, 0.65] },
  columnAttack: null,
  special: { id: "maelstrom", name: "Maelstrom", triggerHpPct: 0.1, windUpMs: 2400, durationMs: 9500, attackType: "whirlpool" },
};
