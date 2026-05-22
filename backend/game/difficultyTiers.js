/** Star difficulty tiers (0 = training, 1–10 = live bosses). */
const DIFFICULTY_LABELS = {
  0:  "Training",
  1:  "Beginner",
  2:  "Easy",
  3:  "Medium",
  4:  "Hard",
  5:  "Nightmare",
  6:  "Mythic",
  7:  "Abyssal",
  8:  "Cataclysm",
  9:  "Oblivion",
  10: "Omega",
};

const DIFFICULTY_MAX_STARS = 10;
const COMING_SOON_DIFFICULTIES = [];

module.exports = { DIFFICULTY_LABELS, DIFFICULTY_MAX_STARS, COMING_SOON_DIFFICULTIES };
