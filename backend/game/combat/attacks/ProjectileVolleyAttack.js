/**
 * Light projectile volley — not full bullet hell; 3–5 aimed shots per interval.
 * TWEAK: shotCount, intervalMs, shotDamage via projectile collision (default)
 */
const { BaseAttack } = require("../BaseAttack");
const { spawnProjectile, aimAtChar } = require("../../helpers");

class ProjectileVolleyAttack extends BaseAttack {
  constructor(id = "phantom_volley", opts = {}) {
    super(id, {
      category: "projectile",
      cooldownMs: opts.cooldownMs ?? 4000,
      windUpMs:   opts.windUpMs   ?? 500,
      durationMs: opts.durationMs ?? 2400,
      weight:     opts.weight     ?? 10,
      minRange:   opts.minRange   ?? 80,
      ...opts,
    });
    this.shotCount   = opts.shotCount   ?? 3;
    this.intervalMs = opts.intervalMs ?? 700;
    this.projType   = opts.projType   ?? "aimed";
    this.projSpeed  = opts.projSpeed  ?? null;
  }

  onStart(ctx) {
    super.onStart(ctx);
    ctx.combat.data.volleyShots = 0;
    ctx.combat.data.volleyNext = ctx.now + this.windUpMs;
    return this.windUpMs > 0 ? "windup" : "active";
  }

  onTick(ctx, elapsed) {
    if (elapsed < this.windUpMs) return "windup";
    if (ctx.now >= ctx.combat.data.volleyNext && ctx.combat.data.volleyShots < this.shotCount) {
      const spd = this.projSpeed || ctx.speed;
      spawnProjectile(ctx.game, aimAtChar(ctx.boss, ctx.char, spd, this.projType));
      ctx.combat.data.volleyShots++;
      ctx.combat.data.volleyNext = ctx.now + this.intervalMs;
    }
    if (elapsed < this.windUpMs + this.durationMs) return "active";
    return "done";
  }

  onEnd(ctx) {
    ctx.combat.data.volleyShots = 0;
    super.onEnd(ctx);
  }
}

module.exports = { ProjectileVolleyAttack };
