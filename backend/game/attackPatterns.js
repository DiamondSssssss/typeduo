/**
 * Pure attack-pattern functions.
 * Each function receives (game, boss, char, phase, speed, cfg, now)
 * and mutates game.projectiles by calling spawnProjectile.
 * Returns true if it actually fired something, false if on cooldown.
 */
const { spawnProjectile, aimAtChar } = require("./helpers");

// ── Shared / generic ─────────────────────────────────────────────────────────

exports.fireNormal = (game, boss, char, phase, speed, cfg, now) => {
  if (now - boss.lastFireAt < cfg.fireIntervals.normal[phase]) return false;
  boss.lastFireAt = now;
  const aimed = Math.random() < 0.45 + phase * 0.2;
  if (aimed) {
    spawnProjectile(game, aimAtChar(boss, char, speed, "aimed"));
  } else {
    spawnProjectile(game, { x: boss.x, y: boss.y, vx: (Math.random() - 0.5) * speed * 0.45, vy: speed * 0.9, type: "normal" });
  }
  if (phase === 2 && Math.random() < 0.45) spawnProjectile(game, aimAtChar(boss, char, speed * 0.85));
  return true;
};

exports.fireSpread = (game, boss, char, phase, speed, cfg, now) => {
  if (now - boss.lastFireAt < cfg.fireIntervals.spread[phase]) return false;
  boss.lastFireAt = now;
  const sc = cfg.spreadConfig || { counts: [3, 5, 7], halfSpread: [0.4, 0.55, 0.7] };
  const count = sc.counts[phase];
  const half  = sc.halfSpread[phase];
  const aimA  = Math.atan2(char.y - boss.y, char.x - boss.x);
  for (let i = 0; i < count; i++) {
    const angle = aimA - half + (2 * half * i / (count - 1));
    spawnProjectile(game, { x: boss.x, y: boss.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, type: "spread" });
  }
  return true;
};

exports.fireRain = (game, boss, char, phase, speed, cfg, now) => {
  if (now - boss.lastFireAt < cfg.fireIntervals.rain[phase]) return false;
  boss.lastFireAt = now;
  const drops = [1, 2, 3][phase];
  for (let i = 0; i < drops; i++) {
    const rx = Math.max(60, Math.min(900, boss.x + (Math.random() * 440 - 220)));
    spawnProjectile(game, { x: rx, y: 30, vx: 0, vy: speed * (1.1 + Math.random() * 0.5), type: "rain" });
  }
  return true;
};

exports.fireCircle = (game, boss, char, phase, speed, cfg, now) => {
  if (boss.circleFired) return false;
  boss.circleFired = true;
  const count = [10, 14, 18][phase];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    spawnProjectile(game, { x: boss.x, y: boss.y, vx: Math.cos(a) * speed * 0.78, vy: Math.sin(a) * speed * 0.78, type: "circle" });
  }
  if (phase === 2) {
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + Math.PI / 16;
      spawnProjectile(game, { x: boss.x, y: boss.y, vx: Math.cos(a) * speed * 0.55, vy: Math.sin(a) * speed * 0.55, type: "circle" });
    }
  }
  return true;
};

exports.fireSpiral = (game, boss, char, phase, speed, cfg, now) => {
  if (now - boss.lastFireAt < cfg.fireIntervals.spiral[phase]) return false;
  boss.lastFireAt = now;
  const sv = speed * 0.88;
  spawnProjectile(game, { x: boss.x, y: boss.y, vx: Math.cos(boss.spiralAngle) * sv, vy: Math.sin(boss.spiralAngle) * sv, type: "spiral" });
  if (phase >= 1) spawnProjectile(game, { x: boss.x, y: boss.y, vx: Math.cos(boss.spiralAngle + Math.PI) * sv, vy: Math.sin(boss.spiralAngle + Math.PI) * sv, type: "spiral" });
  if (phase === 2) spawnProjectile(game, { x: boss.x, y: boss.y, vx: Math.cos(boss.spiralAngle + Math.PI / 2) * sv * 0.72, vy: Math.sin(boss.spiralAngle + Math.PI / 2) * sv * 0.72, type: "spiral" });
  boss.spiralAngle += Math.PI / 4;
  return true;
};

exports.fireHell = (game, boss, char, phase, speed, cfg, now) => {
  let fired = false;
  if (now - boss.lastFireAt >= cfg.fireIntervals.hell_normal[phase]) {
    boss.lastFireAt = now;
    spawnProjectile(game, aimAtChar(boss, char, speed, "aimed"));
    if (Math.random() < 0.6) spawnProjectile(game, aimAtChar(boss, char, speed * 0.8, "aimed"));
    if (Math.random() < 0.35) {
      const aimA = Math.atan2(char.y - boss.y, char.x - boss.x);
      for (let i = 0; i < 3; i++) {
        const a = aimA - 0.5 + (i / 2);
        spawnProjectile(game, { x: boss.x, y: boss.y, vx: Math.cos(a) * speed * 0.9, vy: Math.sin(a) * speed * 0.9, type: "spread" });
      }
    }
    fired = true;
  }
  if (!boss.hellSpiralAt) boss.hellSpiralAt = now;
  if (now - boss.hellSpiralAt >= cfg.fireIntervals.hell_spiral[phase]) {
    boss.hellSpiralAt = now;
    const sv = speed * 0.85;
    spawnProjectile(game, { x: boss.x, y: boss.y, vx: Math.cos(boss.spiralAngle) * sv, vy: Math.sin(boss.spiralAngle) * sv, type: "spiral" });
    spawnProjectile(game, { x: boss.x, y: boss.y, vx: Math.cos(boss.spiralAngle + Math.PI) * sv, vy: Math.sin(boss.spiralAngle + Math.PI) * sv, type: "spiral" });
    boss.spiralAngle += Math.PI / 3;
    fired = true;
  }
  if (!boss.hellRainAt) boss.hellRainAt = now;
  if (now - boss.hellRainAt >= cfg.fireIntervals.hell_rain[phase]) {
    boss.hellRainAt = now;
    for (let i = 0; i < 3; i++) {
      const rx = Math.max(60, Math.min(900, boss.x + (Math.random() * 560 - 280)));
      spawnProjectile(game, { x: rx, y: 30, vx: 0, vy: speed * 1.4, type: "rain" });
    }
    fired = true;
  }
  return fired;
};

// ── Storm Drake ───────────────────────────────────────────────────────────────

exports.fireThunderRain = (game, boss, char, phase, speed, cfg, now) => {
  if (now - boss.lastFireAt < cfg.fireIntervals.thunder_rain[phase]) return false;
  boss.lastFireAt = now;
  const drops = 1 + phase;
  for (let i = 0; i < drops; i++) {
    const rx = Math.max(60, Math.min(900, boss.x + (Math.random() * 300 - 150)));
    spawnProjectile(game, { x: rx, y: 30, vx: 0, vy: speed * 1.4, type: "thunder_rain" });
  }
  return true;
};

exports.fireSweep = (game, boss, char, phase, speed, cfg, now) => {
  if (now - boss.lastFireAt < cfg.fireIntervals.sweep[phase]) return false;
  boss.lastFireAt = now;
  const sc = cfg.sweepConfig || { counts: [5, 7, 9], gap: 32, speedMult: 0.9 };
  const count = sc.counts[phase];
  const fromLeft = Math.random() < 0.5;
  const sweepY = 200 + Math.random() * 160;
  const vx = (fromLeft ? 1 : -1) * speed * sc.speedMult;
  for (let i = 0; i < count; i++) {
    spawnProjectile(game, {
      x: fromLeft ? 0 : 960,
      y: sweepY + (i - count / 2) * sc.gap,
      vx,
      vy: 0,
      type: "sweep",
    });
  }
  return true;
};

exports.fireChainLightning = (game, boss, char, phase, speed, cfg, now) => {
  if (now - boss.lastFireAt < cfg.fireIntervals.chain_lightning[phase]) return false;
  boss.lastFireAt = now;
  const count = cfg.chainCount?.[phase] ?? 2 + phase;
  for (let i = 0; i < count; i++) {
    const jitter = (Math.random() - 0.5) * 0.3;
    const dx = char.x - boss.x + (Math.random() - 0.5) * 80;
    const dy = char.y - boss.y + (Math.random() - 0.5) * 80;
    const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
    spawnProjectile(game, {
      x: boss.x, y: boss.y,
      vx: (dx / dist) * speed * (1 + jitter),
      vy: (dy / dist) * speed * (1 + jitter),
      type: "chain_lightning",
    });
  }
  return true;
};

exports.fireTempest = (game, boss, char, phase, speed, cfg, now) => {
  let fired = false;
  // Horizontal sweeps at higher frequency
  if (!boss.tempestSweepAt) boss.tempestSweepAt = now;
  if (now - boss.tempestSweepAt >= cfg.fireIntervals.tempest_sweep[phase]) {
    boss.tempestSweepAt = now;
    const sc = cfg.sweepConfig || { counts: [5, 7, 9], gap: 32, speedMult: 0.9 };
    const count = sc.counts[phase];
    const fromLeft = Math.random() < 0.5;
    const sweepY = 200 + Math.random() * 160;
    const vx = (fromLeft ? 1 : -1) * speed * sc.speedMult;
    for (let i = 0; i < count; i++) {
      spawnProjectile(game, { x: fromLeft ? 0 : 960, y: sweepY + (i - count / 2) * sc.gap, vx, vy: 0, type: "sweep" });
    }
    fired = true;
  }
  // Rapid thunder rain
  if (!boss.tempestRainAt) boss.tempestRainAt = now;
  if (now - boss.tempestRainAt >= cfg.fireIntervals.tempest_rain[phase]) {
    boss.tempestRainAt = now;
    for (let i = 0; i < 2; i++) {
      const rx = Math.max(60, Math.min(900, boss.x + (Math.random() * 300 - 150)));
      spawnProjectile(game, { x: rx, y: 30, vx: 0, vy: speed * 1.5, type: "thunder_rain" });
    }
    fired = true;
  }
  // Chain lightning
  if (!boss.tempestChainAt) boss.tempestChainAt = now;
  if (now - boss.tempestChainAt >= cfg.fireIntervals.tempest_bolt[phase]) {
    boss.tempestChainAt = now;
    const dx = char.x - boss.x; const dy = char.y - boss.y;
    const d = Math.max(1, Math.sqrt(dx * dx + dy * dy));
    spawnProjectile(game, { x: boss.x, y: boss.y, vx: (dx / d) * speed, vy: (dy / d) * speed, type: "chain_lightning" });
    fired = true;
  }
  return fired;
};

// ── Void Crawler ──────────────────────────────────────────────────────────────

exports.fireVoidOrb = (game, boss, char, phase, speed, cfg, now) => {
  if (now - boss.lastFireAt < cfg.fireIntervals.void_orb[phase]) return false;
  boss.lastFireAt = now;
  const orbSpeed = cfg.orbConfig?.speed?.[phase] ?? speed * 0.55;
  const count = 1 + phase;
  for (let i = 0; i < count; i++) {
    const jitter = (Math.random() - 0.5) * 0.4;
    const a = Math.atan2(char.y - boss.y, char.x - boss.x) + jitter;
    spawnProjectile(game, { x: boss.x, y: boss.y, vx: Math.cos(a) * orbSpeed, vy: Math.sin(a) * orbSpeed, type: "void_orb", homing: true });
  }
  return true;
};

exports.fireTendrils = (game, boss, char, phase, speed, cfg, now) => {
  if (now - boss.lastFireAt < cfg.fireIntervals.tendrils[phase]) return false;
  boss.lastFireAt = now;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    spawnProjectile(game, { x: boss.x, y: boss.y, vx: Math.cos(a) * speed * 0.9, vy: Math.sin(a) * speed * 0.9, type: "tendrils" });
  }
  if (phase === 2) {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      spawnProjectile(game, { x: boss.x, y: boss.y, vx: Math.cos(a) * speed * 0.65, vy: Math.sin(a) * speed * 0.65, type: "tendrils" });
    }
  }
  return true;
};

exports.fireEruption = (game, boss, char, phase, speed, cfg, now) => {
  if (now - boss.lastFireAt < cfg.fireIntervals.eruption[phase]) return false;
  boss.lastFireAt = now;
  const count = 8 + phase * 3;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + Math.random() * 0.25;
    spawnProjectile(game, { x: char.x, y: char.y, vx: Math.cos(a) * speed * 0.9, vy: Math.sin(a) * speed * 0.9, type: "eruption" });
  }
  return true;
};

exports.fireDarkPulse = (game, boss, char, phase, speed, cfg, now) => {
  if (now - boss.lastFireAt < cfg.fireIntervals.dark_pulse[phase]) return false;
  boss.lastFireAt = now;
  const count = 5;
  const aimA = Math.atan2(char.y - boss.y, char.x - boss.x);
  for (let i = 0; i < count; i++) {
    const a = aimA - 0.7 + (1.4 * i / (count - 1));
    spawnProjectile(game, { x: boss.x, y: boss.y, vx: Math.cos(a) * speed * 0.75, vy: Math.sin(a) * speed * 0.75, type: "dark_pulse" });
  }
  // Homing tail
  if (phase >= 1) {
    spawnProjectile(game, { x: boss.x, y: boss.y, vx: Math.cos(aimA) * speed * 0.5, vy: Math.sin(aimA) * speed * 0.5, type: "void_orb", homing: true });
  }
  return true;
};

exports.fireSingularity = (game, boss, char, phase, speed, cfg, now) => {
  if (boss.circleFired) return false;
  boss.circleFired = true;
  const count = 10 + phase * 4;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    spawnProjectile(game, { x: boss.x, y: boss.y, vx: Math.cos(a) * speed * 0.65, vy: Math.sin(a) * speed * 0.65, type: "singularity", homing: true });
  }
  return true;
};

// ── Special attacks (ultimates) ───────────────────────────────────────────────

/** Watcher: Third Eye — circle bursts from 3 positions simultaneously. */
exports.fireThirdEye = (game, boss, char, phase, speed, cfg, now) => {
  const offsets = [{ x: -150, y: 0 }, { x: 0, y: 0 }, { x: 150, y: 0 }];
  offsets.forEach((off) => {
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      spawnProjectile(game, { x: boss.x + off.x, y: boss.y + off.y, vx: Math.cos(a) * speed * 0.82, vy: Math.sin(a) * speed * 0.82, type: "circle" });
    }
  });
};

/** Storm Drake: Thunderstrike — 5 fast chain shots at spread positions. */
exports.fireThunderstrike = (game, boss, char, phase, speed, cfg, now) => {
  const xs = [160, 290, 480, 670, 800];
  xs.forEach((tx) => {
    spawnProjectile(game, { x: boss.x, y: boss.y, vx: (tx - boss.x) / Math.max(1, Math.abs(tx - boss.x)) * speed, vy: speed * 0.6, type: "chain_lightning" });
  });
  for (let i = 0; i < 8; i++) {
    const rx = Math.max(60, Math.min(900, boss.x + (Math.random() * 400 - 200)));
    spawnProjectile(game, { x: rx, y: 30, vx: 0, vy: speed * 1.6, type: "thunder_rain" });
  }
};

/** Void Crawler: Void Collapse — 4 homing orbs + eruption at char. */
exports.fireVoidCollapse = (game, boss, char, phase, speed, cfg, now) => {
  const orbSpeed = cfg.orbConfig?.speed?.[2] ?? speed * 0.55;
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    spawnProjectile(game, { x: boss.x, y: boss.y, vx: Math.cos(a) * orbSpeed, vy: Math.sin(a) * orbSpeed, type: "void_orb", homing: true });
  }
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    spawnProjectile(game, { x: char.x, y: char.y, vx: Math.cos(a) * speed * 0.9, vy: Math.sin(a) * speed * 0.9, type: "eruption" });
  }
};

// ── Dispatch map ──────────────────────────────────────────────────────────────
exports.PATTERN_MAP = {
  normal:          exports.fireNormal,
  spread:          exports.fireSpread,
  rain:            exports.fireRain,
  circle:          exports.fireCircle,
  spiral:          exports.fireSpiral,
  hell:            exports.fireHell,
  thunder_rain:    exports.fireThunderRain,
  sweep:           exports.fireSweep,
  chain_lightning: exports.fireChainLightning,
  tempest:         exports.fireTempest,
  void_orb:        exports.fireVoidOrb,
  tendrils:        exports.fireTendrils,
  eruption:        exports.fireEruption,
  dark_pulse:      exports.fireDarkPulse,
  singularity:     exports.fireSingularity,
};

exports.SPECIAL_MAP = {
  third_eye:    exports.fireThirdEye,
  thunderstrike: exports.fireThunderstrike,
  void_collapse: exports.fireVoidCollapse,
};
