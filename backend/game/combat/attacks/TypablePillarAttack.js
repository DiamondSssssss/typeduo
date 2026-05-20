const { BaseAttack } = require("../BaseAttack");
const { spawnTypablePillars } = require("../../typingChallenges");

class TypablePillarAttack extends BaseAttack {
  constructor(id = "ruin_pillars", opts = {}) {
    super(id, {
      category: "aoe",
      cooldownMs: opts.cooldownMs ?? 11000,
      windUpMs: opts.windUpMs ?? 500,
      durationMs: opts.durationMs ?? 600,
      weight: opts.weight ?? 14,
      ...opts,
    });
    this.pillarCount = opts.pillarCount ?? 2;
    this.warnMs = opts.warnMs ?? 5000;
  }

  onStart(ctx) {
    ctx.lockBossMovement(true);
    return "windup";
  }

  onTick(ctx, elapsed) {
    if (elapsed < this.windUpMs) return "windup";
    if (!ctx.combat.data.spawned) {
      ctx.combat.data.spawned = true;
      spawnTypablePillars(ctx.io, ctx.room, ctx.game, {
        count: this.pillarCount,
        warnMs: this.warnMs,
      });
    }
    return "done";
  }

  onEnd(ctx) {
    ctx.lockBossMovement(false);
    super.onEnd(ctx);
  }
}

module.exports = { TypablePillarAttack };
