/**
 * Attack patterns for bosses 6–10.
 */
const { spawnProjectile, aimAtChar } = require("./helpers");

// ── Rust Golem ────────────────────────────────────────────────────────────────
const fireRustShot = (game, boss, char, phase, speed, cfg, now) => {
  if (now - boss.lastFireAt < (cfg.fireIntervals.rust_shot?.[phase] ?? 1000)) return false;
  boss.lastFireAt = now;
  spawnProjectile(game, aimAtChar(boss, char, speed * 0.85, "rust_shot"));
  return true;
};

const fireGearSpread = (game, boss, char, phase, speed, cfg, now) => {
  if (now - boss.lastFireAt < (cfg.fireIntervals.gear_spread?.[phase] ?? 2500)) return false;
  boss.lastFireAt = now;
  const sc = cfg.spreadConfig || { counts: [4, 5, 7], halfSpread: [0.3, 0.45, 0.55] };
  const count = sc.counts[phase];
  const aimA = Math.atan2(char.y - boss.y, char.x - boss.x);
  for (let i = 0; i < count; i++) {
    const a = aimA - sc.halfSpread[phase] + (2 * sc.halfSpread[phase] * i) / Math.max(1, count - 1);
    spawnProjectile(game, { x: boss.x, y: boss.y, vx: Math.cos(a) * speed * 0.8, vy: Math.sin(a) * speed * 0.8, type: "gear_spread" });
  }
  return true;
};

const fireShockwave = (game, boss, char, phase, speed, cfg, now) => {
  if (boss.circleFired) return false;
  boss.circleFired = true;
  game._magnetActive = false;
  const count = 10 + phase * 3;
  if (cfg._io && cfg._roomCode) cfg._io.to(cfg._roomCode).emit("shockwave_burst", { x: boss.x, y: boss.y });
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    spawnProjectile(game, { x: boss.x, y: boss.y, vx: Math.cos(a) * speed * 0.55, vy: Math.sin(a) * speed * 0.55, type: "shockwave" });
  }
  return true;
};

const fireMagnetPull = (game, boss, char, phase, speed, cfg, now) => {
  if (boss.circleFired) return false;
  boss.circleFired = true;
  game._magnetActive = true;
  if (cfg._io && cfg._roomCode) cfg._io.to(cfg._roomCode).emit("magnet_pull_start", { x: boss.x, y: boss.y, durationMs: 3500 });
  for (let i = 0; i < 6 + phase * 2; i++) {
    const a = (i / (6 + phase * 2)) * Math.PI * 2;
    spawnProjectile(game, { x: boss.x, y: boss.y, vx: Math.cos(a) * speed * 0.45, vy: Math.sin(a) * speed * 0.45, type: "rust_shot", homing: true });
  }
  return true;
};

const fireMeltdown = (game, boss, char, phase, speed, cfg, now) => {
  fireShockwave(game, boss, char, 2, speed, cfg, now);
  for (let i = 0; i < 8; i++) {
    const rx = 120 + Math.random() * 880;
    spawnProjectile(game, { x: rx, y: 30, vx: 0, vy: speed * 1.1, type: "gear_spread" });
  }
};

// ── Plague Herald ─────────────────────────────────────────────────────────────
const fireSporeBurst = (game, boss, char, phase, speed, cfg, now) => {
  if (now - boss.lastFireAt < (cfg.fireIntervals.spore_burst?.[phase] ?? 900)) return false;
  boss.lastFireAt = now;
  const sc = cfg.spreadConfig;
  const count = sc?.counts?.[phase] ?? 5;
  const aimA = Math.atan2(char.y - boss.y, char.x - boss.x);
  for (let i = 0; i < count; i++) {
    const a = aimA + (Math.random() - 0.5) * 1.2;
    spawnProjectile(game, { x: boss.x, y: boss.y, vx: Math.cos(a) * speed * 0.75, vy: Math.sin(a) * speed * 0.75, type: "spore_burst" });
  }
  return true;
};

const fireSickRain = (game, boss, char, phase, speed, cfg, now) => {
  if (now - boss.lastFireAt < (cfg.fireIntervals.sick_rain?.[phase] ?? 400)) return false;
  boss.lastFireAt = now;
  const rx = Math.max(60, Math.min(900, 80 + Math.random() * 880));
  spawnProjectile(game, { x: rx, y: 25, vx: (Math.random() - 0.5) * 40, vy: speed * 0.9, type: "sick_rain" });
  return true;
};

const fireToxicPool = (game, boss, char, phase, speed, cfg, now) => {
  if (boss.circleFired) return false;
  boss.circleFired = true;
  const r = 85;
  game._toxicPools = game._toxicPools || [];
  game._toxicPools.push({ x: char.x, y: char.y, r, expiresAt: now + 4000 });
  if (cfg._io && cfg._roomCode) {
    cfg._io.to(cfg._roomCode).emit("toxic_pool_placed", { x: char.x, y: char.y, radius: r, durationMs: 4000 });
  }
  return true;
};

const firePlagueWave = (game, boss, char, phase, speed, cfg, now) => {
  if (boss.circleFired) return false;
  boss.circleFired = true;
  const count = 12 + phase * 4;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    spawnProjectile(game, { x: boss.x, y: boss.y, vx: Math.cos(a) * speed * 0.7, vy: Math.sin(a) * speed * 0.7, type: "plague_wave" });
  }
  return true;
};

const firePandemic = (game, boss, char, phase, speed, cfg, now) => {
  for (let p = 0; p < 4; p++) {
    const px = 200 + p * 220;
    game._toxicPools.push({ x: px, y: char.y, r: 75, expiresAt: Date.now() + 5000 });
  }
  if (cfg._io && cfg._roomCode) cfg._io.to(cfg._roomCode).emit("pandemic_burst", { x: boss.x, y: boss.y });
  firePlagueWave(game, boss, char, 2, speed, cfg, now);
};

// ── Chronarch ─────────────────────────────────────────────────────────────────
const fireClockBolt = (game, boss, char, phase, speed, cfg, now) => {
  if (now - boss.lastFireAt < (cfg.fireIntervals.clock_bolt?.[phase] ?? 800)) return false;
  boss.lastFireAt = now;
  spawnProjectile(game, aimAtChar(boss, char, speed, "clock_bolt"));
  if (phase >= 1) spawnProjectile(game, aimAtChar(boss, char, speed * 0.85, "clock_bolt"));
  return true;
};

const fireDelayedOrb = (game, boss, char, phase, speed, cfg, now) => {
  if (boss.circleFired) return false;
  boss.circleFired = true;
  const delay = 1500;
  const tx = char.x; const ty = char.y;
  if (cfg._io && cfg._roomCode) {
    cfg._io.to(cfg._roomCode).emit("delayed_marker", { x: tx, y: ty, detonateMs: delay });
  }
  game._delayedSpawns = game._delayedSpawns || [];
  const count = 8 + phase * 3;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    game._delayedSpawns.push({
      at: now + delay,
      proj: { x: tx, y: ty, vx: Math.cos(a) * speed * 0.85, vy: Math.sin(a) * speed * 0.85, type: "delayed_orb", homing: true },
    });
  }
  return true;
};

const fireSlowField = (game, boss, char, phase, speed, cfg, now) => {
  if (boss.circleFired) return false;
  boss.circleFired = true;
  game._slowFields = game._slowFields || [];
  game._slowFields.push({ x: char.x, y: char.y, r: 100, expiresAt: now + 3500 });
  if (cfg._io && cfg._roomCode) {
    cfg._io.to(cfg._roomCode).emit("slow_field_placed", { x: char.x, y: char.y, radius: 100, durationMs: 3500 });
  }
  return true;
};

const fireRewindBurst = (game, boss, char, phase, speed, cfg, now) => {
  if (boss.circleFired) return false;
  boss.circleFired = true;
  if (cfg._io && cfg._roomCode) cfg._io.to(cfg._roomCode).emit("rewind_burst", { x: boss.x, y: boss.y });
  const count = 14 + phase * 4;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    spawnProjectile(game, { x: boss.x, y: boss.y, vx: Math.cos(a) * speed * 0.6, vy: Math.sin(a) * speed * 0.6, type: "rewind_burst", homing: true });
  }
  return true;
};

const fireTimeStop = (game, boss, char, phase, speed, cfg, now) => {
  fireSlowField(game, boss, char, 2, speed, cfg, now);
  game._slowFields.push({ x: 640, y: 400, r: 200, expiresAt: Date.now() + 4000 });
  fireDelayedOrb(game, { ...boss, circleFired: false }, char, 2, speed, cfg, now);
};

// ── Leviathan ─────────────────────────────────────────────────────────────────
const fireSpray = (game, boss, char, phase, speed, cfg, now) => {
  if (now - boss.lastFireAt < (cfg.fireIntervals.spray?.[phase] ?? 700)) return false;
  boss.lastFireAt = now;
  const aimA = Math.atan2(char.y - boss.y, char.x - boss.x);
  for (let i = -1; i <= 1; i++) {
    const a = aimA + i * 0.25;
    spawnProjectile(game, { x: boss.x, y: boss.y, vx: Math.cos(a) * speed * 0.9, vy: Math.sin(a) * speed * 0.9, type: "spray" });
  }
  return true;
};

const fireTidalSweep = (game, boss, char, phase, speed, cfg, now) => {
  if (boss.circleFired) return false;
  boss.circleFired = true;
  const lanes = [220, 400, 560, 720];
  if (cfg._io && cfg._roomCode) cfg._io.to(cfg._roomCode).emit("tidal_sweep", { lanes });
  lanes.forEach((ly) => {
    for (let i = 0; i < 5; i++) {
      spawnProjectile(game, { x: 40, y: ly, vx: speed * 1.1, vy: 0, type: "tidal_wave" });
      spawnProjectile(game, { x: 1240, y: ly, vx: -speed * 1.1, vy: 0, type: "tidal_wave" });
    }
  });
  return true;
};

const fireDepthCharge = (game, boss, char, phase, speed, cfg, now) => {
  if (now - boss.lastFireAt < (cfg.fireIntervals.depth_charge?.[phase] ?? 500)) return false;
  boss.lastFireAt = now;
  const rx = Math.max(80, Math.min(880, char.x + (Math.random() - 0.5) * 200));
  // Emit warning FIRST, then delay the actual projectile spawn by 900ms
  // so the player has time to read and react to the warning indicator.
  const warnMs = 900;
  if (cfg._io && cfg._roomCode) {
    cfg._io.to(cfg._roomCode).emit("depth_charge_warn", { x: rx, y: 580, warnMs });
  }
  game._depthChargeQueue = game._depthChargeQueue || [];
  game._depthChargeQueue.push({ x: rx, y: 620, fireAt: now + warnMs, speed: speed * 1.2 });
  return true;
};

const fireWhirlpool = (game, boss, char, phase, speed, cfg, now) => {
  if (boss.circleFired) return false;
  boss.circleFired = true;
  const cx = char.x;
  const cy = char.y;
  const pullMs = 3500;
  if (cfg._io && cfg._roomCode) {
    cfg._io.to(cfg._roomCode).emit("whirlpool_start", { x: cx, y: cy, durationMs: pullMs });
  }
  game._magnetActive = true;
  game._magnetTarget = { x: cx, y: cy };
  game._magnetUntil = now + pullMs;
  game._whirlpoolHitUntil = now + 800;
  const count = 10 + phase * 3;
  const spawnR = 100;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const px = cx + Math.cos(a) * spawnR;
    const py = cy + Math.sin(a) * spawnR;
    spawnProjectile(game, {
      x: px,
      y: py,
      vx: Math.cos(a) * speed * 0.45,
      vy: Math.sin(a) * speed * 0.45,
      type: "whirlpool",
      homing: true,
    });
  }
  return true;
};

const fireMaelstrom = (game, boss, char, phase, speed, cfg, now) => {
  fireWhirlpool(game, { ...boss, circleFired: false }, char, 2, speed, cfg, now);
  fireTidalSweep(game, { ...boss, circleFired: false }, char, 2, speed, cfg, now);
};

// ── Sovereign ─────────────────────────────────────────────────────────────────
const fireCrownVolley = (game, boss, char, phase, speed, cfg, now) => {
  if (now - boss.lastFireAt < (cfg.fireIntervals.crown_volley?.[phase] ?? 750)) return false;
  boss.lastFireAt = now;
  spawnProjectile(game, aimAtChar(boss, char, speed, "crown_volley"));
  if (phase >= 1) {
    const aimA = Math.atan2(char.y - boss.y, char.x - boss.x);
    spawnProjectile(game, { x: boss.x, y: boss.y, vx: Math.cos(aimA + 0.2) * speed * 0.9, vy: Math.sin(aimA + 0.2) * speed * 0.9, type: "crown_volley" });
    spawnProjectile(game, { x: boss.x, y: boss.y, vx: Math.cos(aimA - 0.2) * speed * 0.9, vy: Math.sin(aimA - 0.2) * speed * 0.9, type: "crown_volley" });
  }
  return true;
};

const fireKnightCharge = (game, boss, char, phase, speed, cfg, now) => {
  if (now - boss.lastFireAt < (cfg.fireIntervals.knight_charge?.[phase] ?? 1200)) return false;
  boss.lastFireAt = now;
  spawnProjectile(game, aimAtChar(boss, char, speed * 1.15, "knight_charge"));
  return true;
};

const fireEdictZone = (game, boss, char, phase, speed, cfg, now) => {
  if (boss.circleFired) return false;
  boss.circleFired = true;
  const detonateMs = 2000;
  if (cfg._io && cfg._roomCode) {
    cfg._io.to(cfg._roomCode).emit("void_zone_placed", { x: char.x, y: char.y, radius: 95, detonateMs });
  }
  game._voidZoneDetonates = game._voidZoneDetonates || [];
  game._voidZoneDetonates.push({ x: char.x, y: char.y, detonateAt: Date.now() + detonateMs, speed: speed * 0.75, phase });
  return true;
};

const fireJudgmentBeam = (game, boss, char, phase, speed, cfg, now) => {
  if (boss.circleFired) return false;
  boss.circleFired = true;
  const count = 10 + phase * 4;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    spawnProjectile(game, { x: boss.x, y: boss.y, vx: Math.cos(a) * speed * 0.8, vy: Math.sin(a) * speed * 0.8, type: "judgment_beam" });
  }
  return true;
};

const fireRoyalDecree = (game, boss, char, phase, speed, cfg, now) => {
  fireEdictZone(game, { ...boss, circleFired: false }, char, 2, speed, cfg, now);
  fireJudgmentBeam(game, { ...boss, circleFired: false }, char, 2, speed, cfg, now);
  for (let i = 0; i < 5; i++) spawnProjectile(game, aimAtChar(boss, char, speed, "crown_volley"));
};

const PATTERNS = {
  rust_shot: fireRustShot, gear_spread: fireGearSpread, shockwave: fireShockwave, magnet_pull: fireMagnetPull,
  spore_burst: fireSporeBurst, sick_rain: fireSickRain, toxic_pool: fireToxicPool, plague_wave: firePlagueWave,
  clock_bolt: fireClockBolt, delayed_orb: fireDelayedOrb, slow_field: fireSlowField, rewind_burst: fireRewindBurst,
  spray: fireSpray, tidal_sweep: fireTidalSweep, depth_charge: fireDepthCharge, whirlpool: fireWhirlpool,
  crown_volley: fireCrownVolley, knight_charge: fireKnightCharge, edict_zone: fireEdictZone, judgment_beam: fireJudgmentBeam,
};

const SPECIALS = {
  meltdown: fireMeltdown, pandemic: firePandemic, time_stop: fireTimeStop,
  maelstrom: fireMaelstrom, royal_decree: fireRoyalDecree,
};

module.exports = { PATTERNS, SPECIALS };
