/**
 * MELEE — telegraphed swipe/slam in front of the boss.
 *
 * TWEAK: warnMs, damage, arcRadius, arcAngleDeg in constructor opts.
 */
const { BaseAttack } = require("../BaseAttack");
const { TelegraphSystem } = require("../TelegraphSystem");
const { takeDamage } = require("../../helpers");

class MeleeSwipeAttack extends BaseAttack {
  constructor(id = "melee_swipe", opts = {}) {
    super(id, {
      category: "melee",
      cooldownMs: opts.cooldownMs ?? 4500,
      windUpMs:   opts.windUpMs   ?? 900,   // TWEAK: telegraph duration
      durationMs: opts.durationMs ?? 400,
      weight:     opts.weight     ?? 20,
      maxRange:   opts.maxRange   ?? 220,
      ...opts,
    });
    this.damage       = opts.damage       ?? 18;  // TWEAK: hit damage
    this.arcRadius    = opts.arcRadius    ?? 130; // TWEAK: reach of swipe
    this.arcAngleDeg  = opts.arcAngleDeg  ?? 100;
    this.color        = opts.color        ?? 0xff6b6b;
  }

  onStart(ctx) {
    super.onStart(ctx);
    const dx = ctx.char.x - ctx.boss.x;
    const dy = ctx.char.y - ctx.boss.y;
    const angle = Math.atan2(dy, dx);
    ctx.combat.data.meleeAngle = angle;
    ctx.emit("melee_telegraph", {
      x: ctx.boss.x, y: ctx.boss.y,
      angle, radius: this.arcRadius,
      arcDeg: this.arcAngleDeg, color: this.color,
      durationMs: this.windUpMs,
    });
    return "windup";
  }

  onTick(ctx, elapsed) {
    if (elapsed < this.windUpMs) return "windup";
    if (!ctx.combat.data.meleeFired && elapsed >= this.windUpMs) {
      ctx.combat.data.meleeFired = true;
      const angle = ctx.combat.data.meleeAngle;
      const halfArc = (this.arcAngleDeg * Math.PI) / 180 / 2;
      const dx = ctx.char.x - ctx.boss.x;
      const dy = ctx.char.y - ctx.boss.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const aToChar = Math.atan2(dy, dx);
      let diff = aToChar - angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      if (dist <= this.arcRadius && Math.abs(diff) <= halfArc) {
        takeDamage(ctx.io, ctx.room, this.damage, ctx.boss.x, ctx.boss.y);
      }
      ctx.emit("melee_slam", { x: ctx.boss.x, y: ctx.boss.y, angle, radius: this.arcRadius, color: this.color });
    }
    if (elapsed < this.windUpMs + this.durationMs) return "active";
    return "done";
  }

  onEnd(ctx) {
    ctx.combat.data.meleeFired = false;
    ctx.combat.data.meleeAngle = 0;
    super.onEnd(ctx);
  }
}

module.exports = { MeleeSwipeAttack };
