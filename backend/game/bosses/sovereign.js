/** The Sovereign — final boss with shield phase. */
module.exports = {
  id: "sovereign", name: "The Sovereign",
  tagline: "Kneel or perish.", difficulty: 5, maxHP: 900,
  shieldMax: 80, shieldPhase: 1,
  moveSpeed: [90, 130, 175], yBase: 100, yRange: 48,
  projSpeed: [170, 230, 300],
  attackQueues: [
    ["crown_volley", "knight_charge", "crown_volley", "royal_lance"],
    ["edict_zone", "crown_volley", "knight_charge", "judgment_beam"],
    ["judgment_beam", "edict_zone", "crown_volley", "knight_charge", "royal_lance"],
  ],
  attackDurations: { crown_volley: 3500, knight_charge: 3000, edict_zone: 5000, judgment_beam: 4000, royal_lance: 2800 },
  windUps: { edict_zone: 1100, judgment_beam: 900, royal_lance: 1000 },
  fireIntervals: {
    crown_volley: [750, 600, 450], knight_charge: [1200, 950, 700],
    edict_zone: [9999, 9999, 9999], judgment_beam: [9999, 9999, 9999],
  },
  columnAttack: { type: "royal_lance", warnMs: 1100, activeMs: 550, width: 76, damage: 24, color: 0xfbbf24, targetMode: "char" },
  special: { id: "royal_decree", name: "Royal Decree", triggerHpPct: 0.1, windUpMs: 2800, durationMs: 11000, attackType: "judgment_beam" },
};
