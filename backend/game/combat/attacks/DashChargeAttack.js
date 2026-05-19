/**
 * MOBILITY — boss locks onto player, winds up, then dashes across the arena.
 *
 * TWEAK: windUpMs, dashMs, dashSpeed, impactRadius, impactDamage
 */
const { BaseAttack } = require("../BaseAttack");
const { TelegraphSystem } = require("../TelegraphSystem");
const { takeDamage } = require("../../helpers");
const { BOSS_X_MIN, BOSS_X_MAX } = require("../../constants");

class DashChargeAttack extends BaseAttack {
  constructor(id = "boss_dash", opts = {}) {
    super(id, {
      category: "mobility",
      cooldownMs: opts.cooldownMs ?? 6000,
      windUpMs:   opts.windUpMs   ?? 1100,
      durationMs: opts.durationMs ?? 1200,
      weight:     opts.weight     ?? 18,
      minRange:   opts.minRange   ?? 140,
      ...opts,
    });
    this.dashSpeed      = opts.dashSpeed      ?? 520;  // TWEAK: px/s during dash
    this.impactRadius   = opts.impactRadius   ?? 70;
    this.impactDamage   = opts.impactDamage   ?? 16;
    this.color          = opts.color          ?? 0x38bdf8;
  }

  onStart(ctx) {
    super.onStart(ctx);
    const tx = Math.max(BOSS_X_MIN, Math.min(BOSS_X_MAX, ctx.char.x));
    const ty = Math.max(100, Math.min(520, ctx.char.y));
    ctx.combat.data.dashTarget = { x: tx, y: ty };
    ctx.combat.data.dashStarted = false;
    ctx.emit("dash_telegraph", {
      fromX: ctx.boss.x, fromY: ctx.boss.y,
      toX: tx, toY: ty, color: this.color,
      durationMs: this.windUpMs,
    });
    return "windup";
  }

  onTick(ctx, elapsed) {
    if (elapsed < this.windUpMs) return "windup";

    if (!ctx.combat.data.dashStarted) {
      ctx.combat.data.dashStarted = true;
      ctx.combat.data.dashStartAt = ctx.now;
      ctx.emit("boss_dash", { fromX: ctx.boss.x, fromY: ctx.boss.y, ...ctx.combat.data.dashTarget, color: this.color });
    }

    const target = ctx.combat.data.dashTarget;
    const dashElapsed = (ctx.now - ctx.combat.data.dashStartAt) / 1000;
    const dx = target.x - ctx.boss.x;
    const dy = target.y - ctx.boss.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const step = this.dashSpeed * (ctx.deltaMs / 1000);

    if (dist > step) {
      ctx.boss.x += (dx / dist) * step;
      ctx.boss.y += (dy / dist) * step;
    } else {
      ctx.boss.x = target.x;
      ctx.boss.y = target.y;
    }

    const toChar = Math.hypot(ctx.char.x - ctx.boss.x, ctx.char.y - ctx.boss.y);
    if (toChar < this.impactRadius && !ctx.combat.data.dashHit) {
      ctx.combat.data.dashHit = true;
      takeDamage(ctx.io, ctx.room, this.impactDamage, ctx.boss.x, ctx.boss.y);
    }

    if (dashElapsed * 1000 >= this.durationMs - this.windUpMs) return "done";
    return "active";
  }

  onEnd(ctx) {
    ctx.combat.data.dashStarted = false;
    ctx.combat.data.dashHit = false;
    super.onEnd(ctx);
  }
}

module.exports = { DashChargeAttack };
