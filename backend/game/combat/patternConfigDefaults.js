/**
 * Ensures legacy PATTERN_MAP functions have required cfg fields.
 * Combat-profile bosses often omit fireIntervals — without this the game loop crashes.
 *
 * TWEAK: change DEFAULT_INTERVAL values to speed up/slow down bridged attacks globally.
 */
const DEFAULT_INTERVAL = [1400, 1100, 850];

/** Attacks that fire once per applyAttack cycle (no fireIntervals check). */
const ONE_SHOT_ATTACKS = new Set([
  "circle", "shockwave", "magnet_pull", "void_zone", "eruption",
  "slow_field", "toxic_pool", "knight_charge", "edict_zone",
]);

/** Multi-key interval groups used by composite attacks. */
const COMPOSITE_INTERVALS = {
  hell: ["hell_normal", "hell_spiral", "hell_rain"],
  tempest: ["tempest_sweep", "tempest_rain", "tempest_bolt"],
  wildfire: ["wildfire_normal", "wildfire_spread", "wildfire_rain"],
};

const ensurePatternConfig = (cfg, patternId) => {
  if (!cfg.fireIntervals) cfg.fireIntervals = {};

  if (!ONE_SHOT_ATTACKS.has(patternId) && !cfg.fireIntervals[patternId]) {
    cfg.fireIntervals[patternId] = [...DEFAULT_INTERVAL];
  }

  const composite = COMPOSITE_INTERVALS[patternId];
  if (composite) {
    for (const key of composite) {
      if (!cfg.fireIntervals[key]) cfg.fireIntervals[key] = [...DEFAULT_INTERVAL];
    }
  }

  if ((patternId === "gear_spread" || patternId === "spread") && !cfg.spreadConfig) {
    cfg.spreadConfig = { counts: [4, 5, 7], halfSpread: [0.3, 0.45, 0.55] };
  }
  if (patternId === "void_orb" && !cfg.orbConfig) {
    cfg.orbConfig = { homingTurn: 0.035 };
  }
  if (patternId === "sweep" && !cfg.sweepConfig) {
    cfg.sweepConfig = { yMin: 200, yMax: 520 };
  }
};

/** Wrap every pattern so cfg is always safe before legacy fire* runs. */
const wrapPatternMap = (map) => {
  const wrapped = {};
  for (const [id, fn] of Object.entries(map)) {
    wrapped[id] = (game, boss, char, phase, speed, cfg, now) => {
      ensurePatternConfig(cfg, id);
      return fn(game, boss, char, phase, speed, cfg, now);
    };
  }
  return wrapped;
};

module.exports = { ensurePatternConfig, wrapPatternMap, DEFAULT_INTERVAL };
