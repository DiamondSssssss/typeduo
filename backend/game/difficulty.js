const { SHARED_MAX_HP, DIFFICULTY_SETTINGS, PROJECTILE_DAMAGE } = require("./constants");

const getDifficultySettings = (difficulty) =>
  DIFFICULTY_SETTINGS[difficulty] || DIFFICULTY_SETTINGS.normal;

const applyDifficultyToGame = (game, difficulty) => {
  const s = getDifficultySettings(difficulty);
  game.sharedMaxHP = Math.round(SHARED_MAX_HP * s.hpMult);
  game.sharedHP    = game.sharedMaxHP;
  game.projDmgMult = s.projDmgMult;
  game.windUpMult  = s.windUpMult;
  game.difficulty  = difficulty || "normal";
};

const getProjectileDamage = (game) =>
  Math.round(PROJECTILE_DAMAGE * (game.projDmgMult || 1));

module.exports = { getDifficultySettings, applyDifficultyToGame, getProjectileDamage };
