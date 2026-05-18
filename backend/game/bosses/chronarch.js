/** Chronarch — delayed attacks and slow fields. */
module.exports = {
  id: "chronarch", name: "Chronarch",
  tagline: "Time is its weapon.", difficulty: 3, maxHP: 700,
  moveSpeed: [65, 95, 130], yBase: 108, yRange: 42,
  projSpeed: [140, 190, 250],
  attackQueues: [
    ["clock_bolt", "delayed_orb", "clock_bolt", "time_slice"],
    ["slow_field", "delayed_orb", "clock_bolt", "rewind_burst"],
    ["rewind_burst", "delayed_orb", "slow_field", "time_slice", "clock_bolt"],
  ],
  attackDurations: { clock_bolt: 3500, delayed_orb: 5000, slow_field: 4500, rewind_burst: 4000, time_slice: 3000 },
  windUps: { delayed_orb: 1200, rewind_burst: 1000, time_slice: 900 },
  fireIntervals: {
    clock_bolt: [800, 650, 500], delayed_orb: [9999, 9999, 9999],
    slow_field: [9999, 9999, 9999], rewind_burst: [9999, 9999, 9999],
  },
  columnAttack: { type: "time_slice", warnMs: 1200, activeMs: 500, width: 72, damage: 22, color: 0xfbbf24, targetMode: "char" },
  special: { id: "time_stop", name: "Time Stop", triggerHpPct: 0.1, windUpMs: 2500, durationMs: 10000, attackType: "rewind_burst" },
};
