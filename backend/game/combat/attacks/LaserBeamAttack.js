/** Sustained vertical laser — dodge by leaving the column (no typing). */
const { BaseAttack } = require("../BaseAttack");
const { takeDamage } = require("../../helpers");

class LaserBeamAttack extends BaseAttack {
  constructor(id = "laser_beam", opts = {}) {
    super(id, {
      category: "column",
      cooldownMs: opts.cooldownMs ?? 10000,
      windUpMs: opts.windUpMs ?? 1100,
      durationMs: opts.durationMs ?? 2200,
      weight: opts.weight ?? 16,
      ...opts,
    });
    this.width = opts.width ?? 72;
    this.dps = opts.dps ?? 28;
    this.color = opts.color ?? 0xff2244;
  }

  onStart(ctx) {
    ctx.lockBossMovement(true);
    const x = ctx.char.x;
    ctx.combat.data.beamX = x;
    ctx.combat.data.lastTick = ctx.now;
    ctx.emit("laser_beam_start", {
      x,
      width: this.width,
      warnMs: this.windUpMs,
      activeMs: this.durationMs,
      color: this.color,
    });
    return "windup";
  }

  onTick(ctx, elapsed) {
    const x = ctx.combat.data.beamX;
    if (elapsed < this.windUpMs) {
      ctx.emit("laser_beam_warn", { x, width: this.width, color: this.color });
      return "windup";
    }
    if (!ctx.combat.data.firing) {
      ctx.combat.data.firing = true;
      ctx.combat.data.fireAt = ctx.now;
      ctx.emit("laser_beam_fire", { x, width: this.width, durationMs: this.durationMs, color: this.color });
    }
    const fireElapsed = ctx.now - ctx.combat.data.fireAt;
    const dt = (ctx.now - (ctx.combat.data.lastTick || ctx.combat.data.fireAt)) / 1000;
    ctx.combat.data.lastTick = ctx.now;
    if (Math.abs(ctx.char.x - x) < this.width / 2) {
      const dmg = Math.max(1, Math.round(this.dps * dt));
      takeDamage(ctx.io, ctx.room, dmg, x, ctx.char.y);
    }
    if (fireElapsed < this.durationMs) return "active";
    return "done";
  }

  onEnd(ctx) {
    ctx.emit("laser_beam_end", { x: ctx.combat.data.beamX });
    ctx.lockBossMovement(false);
    super.onEnd(ctx);
  }
}

module.exports = { LaserBeamAttack };
