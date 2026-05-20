const { BaseAttack } = require("../BaseAttack");
const { startShieldWord } = require("../../typingChallenges");

class ShieldWordAttack extends BaseAttack {
  constructor(id = "shield_word", opts = {}) {
    super(id, {
      category: "special",
      cooldownMs: opts.cooldownMs ?? 16000,
      windUpMs: opts.windUpMs ?? 700,
      durationMs: opts.durationMs ?? 800,
      weight: opts.weight ?? 15,
      ...opts,
    });
    this.shieldAmount = opts.shieldAmount ?? 55;
  }

  onStart(ctx) {
    ctx.lockBossMovement(true);
    return "windup";
  }

  onTick(ctx, elapsed) {
    if (elapsed < this.windUpMs) return "windup";
    if (!ctx.combat.data.applied) {
      ctx.combat.data.applied = true;
      startShieldWord(ctx.io, ctx.room, ctx.game, { shieldAmount: this.shieldAmount });
    }
    return "done";
  }

  onEnd(ctx) {
    ctx.lockBossMovement(false);
    super.onEnd(ctx);
  }
}

module.exports = { ShieldWordAttack };
