/** Boss channels a devastating blast — type the word during wind-up to cancel. */
const { BaseAttack } = require("../BaseAttack");
const { startWindupCancel } = require("../../typingChallenges");

class OverchargeAttack extends BaseAttack {
  constructor(id = "overcharge_blast", opts = {}) {
    super(id, {
      category: "special",
      cooldownMs: opts.cooldownMs ?? 14000,
      windUpMs: opts.windUpMs ?? 3800,
      durationMs: opts.durationMs ?? 3800,
      weight: opts.weight ?? 14,
      ...opts,
    });
    this.blastDamage = opts.blastDamage ?? 38;
    this.challengeWord = opts.challengeWord || null;
  }

  onStart(ctx) {
    ctx.lockBossMovement(true);
    ctx.setBossInvulnerable(ctx.now + this.windUpMs);
    startWindupCancel(ctx.io, ctx.room, ctx.game, {
      attackId: this.id,
      windUpMs: this.windUpMs,
      blastDamage: this.blastDamage,
    });
    ctx.emit("boss_windup_start", {
      attackType: this.id,
      durationMs: this.windUpMs,
      label: "OVERCHARGE",
    });
    return "windup";
  }

  onTick(ctx, elapsed) {
    if (!ctx.game._windupCancel) return "done";
    if (elapsed < this.windUpMs) return "windup";
    return "done";
  }

  onEnd(ctx) {
    ctx.lockBossMovement(false);
    ctx.setBossInvulnerable(0);
    super.onEnd(ctx);
  }
}

module.exports = { OverchargeAttack };
