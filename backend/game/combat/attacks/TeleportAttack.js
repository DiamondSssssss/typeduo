/**
 * MOBILITY — instant reposition when cornered or between attack chains.
 *
 * TWEAK: windUpMs, offsetMin/Max, afterTeleportDamage (optional chip)
 */
const { BaseAttack } = require("../BaseAttack");
const { BOSS_X_MIN, BOSS_X_MAX } = require("../../constants");

class TeleportAttack extends BaseAttack {
  constructor(id = "boss_teleport", opts = {}) {
    super(id, {
      category: "mobility",
      cooldownMs: opts.cooldownMs ?? 7000,
      windUpMs:   opts.windUpMs   ?? 600,
      durationMs: opts.durationMs ?? 300,
      weight:     opts.weight     ?? 12,
      ...opts,
    });
    this.offsetMin = opts.offsetMin ?? 80;
    this.offsetMax = opts.offsetMax ?? 160;
    this.color      = opts.color      ?? 0xa855f7;
  }

  onStart(ctx) {
    super.onStart(ctx);
    ctx.emit("teleport_telegraph", {
      x: ctx.boss.x, y: ctx.boss.y, color: this.color, durationMs: this.windUpMs,
    });
    return "windup";
  }

  onTick(ctx, elapsed) {
    if (elapsed < this.windUpMs) return "windup";
    if (!ctx.combat.data.teleported) {
      ctx.combat.data.teleported = true;
      const fromX = ctx.boss.x;
      const fromY = ctx.boss.y;
      const angle = Math.random() * Math.PI * 2;
      const dist  = this.offsetMin + Math.random() * (this.offsetMax - this.offsetMin);
      let nx = ctx.char.x + Math.cos(angle) * dist;
      let ny = ctx.char.y + Math.sin(angle) * dist * 0.5;
      nx = Math.max(BOSS_X_MIN, Math.min(BOSS_X_MAX, nx));
      ny = Math.max(80, Math.min(200, ny));
      ctx.boss.x = nx;
      ctx.boss.y = ny;
      ctx.boss.targetX = nx;
      ctx.boss.targetY = ny;
      ctx.emit("boss_teleport", { fromX, fromY, toX: nx, toY: ny, color: this.color });
    }
    if (elapsed < this.windUpMs + this.durationMs) return "active";
    return "done";
  }

  onEnd(ctx) {
    ctx.combat.data.teleported = false;
    super.onEnd(ctx);
  }
}

module.exports = { TeleportAttack };
