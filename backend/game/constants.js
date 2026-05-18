/**
 * Streak tiers — evaluated when g.streak increments to each `at` value.
 */
const STREAK_TIERS = [
  { at: 3,  heal: 8,  mult: 1.0, multWords: 0, event: "streak3" },
  { at: 5,  heal: 15, mult: 1.3, multWords: 1, event: "streak5" },
  { at: 8,  heal: 22, mult: 1.5, multWords: 2, event: "streak8" },
  { at: 10, heal: 30, mult: 2.0, multWords: 3, event: "fury"    },
];

const DIFFICULTY_SETTINGS = {
  easy:   { hpMult: 1.2,  projDmgMult: 0.75, windUpMult: 1.2  },
  normal: { hpMult: 1.0,  projDmgMult: 1.0,  windUpMult: 1.0  },
  hard:   { hpMult: 0.85, projDmgMult: 1.25, windUpMult: 0.85 },
};

module.exports = {
  MAX_PLAYERS_PER_ROOM:   2,
  GAME_TICK_MS:           50,
  COUNTDOWN_DURATION_MS:  3000,
  ROAR_DURATION_MS:       3000,
  STUN_DURATION_MS:       1600,
  PROJECTILE_DAMAGE:      8,
  STUN_DAMAGE_MULTIPLIER: 2,
  SHARED_MAX_HP:          100,
  SWAP_THRESHOLDS:        [75, 50, 25],
  HIT_RADIUS:             15,
  BOSS_X_MIN:             220,
  BOSS_X_MAX:             1060,
  WEAPON_PICKUP_RADIUS:   40,
  WEAPON_DROP_IMMUNITY_MS: 800,
  WEAPON_DROP_DISTANCE_MIN: 105,
  WEAPON_DROP_DISTANCE_MAX: 150,
  WEAPON_PICKUP_LOCK_AFTER_DROP_MS: 400,
  DEFAULT_BOSS_ID:        "watcher",
  STREAK_TIERS,
  FURY_REFRESH_EVERY: 3,
  FURY_REFRESH_HEAL:  20,
  DIFFICULTY_SETTINGS,
  POISON_TICK_DAMAGE: 3,
  POISON_TICK_MS:     1000,
  SLOW_MOVE_MULT:     0.55,
  GAME_MODES:         ["coop", "solo", "tutorial"],
};
