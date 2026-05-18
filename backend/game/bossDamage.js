/** Apply word damage — respects boss shield. Returns actual HP damage dealt. */
const applyBossWordDamage = (g, damage) => {
  let remaining = damage;
  if (g.bossShield > 0) {
    const absorbed = Math.min(g.bossShield, remaining);
    g.bossShield -= absorbed;
    remaining -= absorbed;
  }
  if (remaining > 0) {
    g.bossHP = Math.max(0, g.bossHP - remaining);
  }
  return remaining;
};

/** Init shield when boss enters configured phase. */
const maybeInitBossShield = (g, bossConfig, phase) => {
  if (!bossConfig.shieldMax) return;
  const needPhase = bossConfig.shieldPhase ?? 2;
  if (phase >= needPhase && !g.shieldInitialized) {
    g.bossShield = bossConfig.shieldMax;
    g.bossShieldMax = bossConfig.shieldMax;
    g.shieldInitialized = true;
  }
};

module.exports = { applyBossWordDamage, maybeInitBossShield };
