/**
 * Streak tiers — evaluated when g.streak increments to each `at` value.
 *   heal       — HP restored immediately
 *   mult       — damage multiplier applied to the NEXT `multWords` words
 *   multWords  — how many future words carry the multiplier (0 = no bonus)
 *   event      — client event name for visual feedback
 */
const STREAK_TIERS = [
  { at: 3,  heal: 8,  mult: 1.0, multWords: 0, event: "streak3" },
  { at: 5,  heal: 15, mult: 1.3, multWords: 1, event: "streak5" },
  { at: 8,  heal: 22, mult: 1.5, multWords: 2, event: "streak8" },
  { at: 10, heal: 30, mult: 2.0, multWords: 3, event: "fury"    },
];

module.exports = {
  MAX_PLAYERS_PER_ROOM:   2,
  GAME_TICK_MS:           50,
  COUNTDOWN_DURATION_MS:  3000,
  ROAR_DURATION_MS:       3000,
  STUN_DURATION_MS:       1600,
  PROJECTILE_DAMAGE:      8,
  STUN_DAMAGE_MULTIPLIER: 2,
  SHARED_MAX_HP:          100,
  SWAP_THRESHOLDS:        [75, 50, 25], // percent of boss maxHP
  HIT_RADIUS:             15,
  BOSS_X_MIN:             220,
  BOSS_X_MAX:             1060,
  WEAPON_PICKUP_RADIUS:   40,
  WEAPON_DROP_IMMUNITY_MS: 1500, // can't drop again within 1.5s of pickup
  DEFAULT_BOSS_ID:        "watcher",
  // Streak system
  STREAK_TIERS,
  FURY_REFRESH_EVERY: 3,   // after streak > 10, re-trigger fury every N more words
  FURY_REFRESH_HEAL:  20,  // HP healed on fury refresh
};
