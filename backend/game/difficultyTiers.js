/** Star difficulty tiers (1–10). 7–10 reserved for future bosses. */
const DIFFICULTY_LABELS = {
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
const COMING_SOON_DIFFICULTIES = [7, 8, 9, 10];

module.exports = { DIFFICULTY_LABELS, DIFFICULTY_MAX_STARS, COMING_SOON_DIFFICULTIES };
