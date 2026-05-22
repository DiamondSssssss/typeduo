/** Training Dummy — ☆0 target with infinite HP for weapon testing. */
module.exports = {
  id: "training_dummy",
  name: "Dummy",
  tagline: "Mục tiêu luyện tập — máu vô hạn, không tấn công.",
  difficulty: 0,
  trainingMode: true,
  color: 0x94a3b8,
  maxHP: 999999,
  moveSpeed: [0],
  yBase: 130,
  yRange: 0,
  projSpeed: [0],
  attackQueues: [["rust_shot"]],
  attackDurations: { rust_shot: 999999999 },
  fireIntervals: { rust_shot: 999999999 },
  combatProfile: {
    attacks: [],
  },
};
