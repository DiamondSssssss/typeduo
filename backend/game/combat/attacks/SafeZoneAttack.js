const { BaseAttack } = require("../BaseAttack");
const { startSafeZoneEvent } = require("../../typingChallenges");

class SafeZoneAttack extends BaseAttack {
  constructor(id = "safe_zone", opts = {}) {
    super(id, {
      category: "aoe",
      cooldownMs: opts.cooldownMs ?? 15000,
      windUpMs: opts.windUpMs ?? 400,
      durationMs: opts.durationMs ?? 5200,
      weight: opts.weight ?? 16,
      ...opts,
    });
    this.mapDamage = opts.mapDamage ?? 48;
    this.zoneRadius = opts.zoneRadius ?? 100;
  }

  onStart(ctx) {
    ctx.lockBossMovement(true);
    startSafeZoneEvent(ctx.io, ctx.room, ctx.game, {
      mapDamage: this.mapDamage,
      radius: this.zoneRadius,
      durationMs: this.durationMs,
    });
    return "windup";
  }

  onTick(ctx, elapsed) {
    if (!ctx.game._safeZoneEvent && !ctx.game._challenge) return "done";
    if (elapsed < this.durationMs + 2000) return "active";
    return "done";
  }

  onEnd(ctx) {
    ctx.lockBossMovement(false);
    super.onEnd(ctx);
  }
}

module.exports = { SafeZoneAttack };
