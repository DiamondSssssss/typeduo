const { BaseAttack } = require("../BaseAttack");
const { startChainCancel } = require("../../typingChallenges");

class ChainCancelAttack extends BaseAttack {
  constructor(id = "chain_cancel", opts = {}) {
    super(id, {
      category: "special",
      cooldownMs: opts.cooldownMs ?? 13000,
      windUpMs: opts.windUpMs ?? 4500,
      durationMs: opts.durationMs ?? 4500,
      weight: opts.weight ?? 15,
      ...opts,
    });
    this.blastDamage = opts.blastDamage ?? 44;
    this.chainLength = opts.chainLength ?? 3;
  }

  onStart(ctx) {
    ctx.lockBossMovement(true);
    ctx.setBossInvulnerable(ctx.now + this.windUpMs);
    const words = [];
    const { pickChallengeWord } = require("../../typingChallenges");
    for (let i = 0; i < this.chainLength; i++) {
      words.push(pickChallengeWord(3, 5));
    }
    startChainCancel(ctx.io, ctx.room, ctx.game, {
      words,
      windUpMs: this.windUpMs,
      blastDamage: this.blastDamage,
      attackId: this.id,
    });
    ctx.emit("boss_windup_start", { attackType: this.id, durationMs: this.windUpMs, label: "CHAIN" });
    return "windup";
  }

  onTick(ctx, elapsed) {
    if (!ctx.game._challenge || ctx.game._challenge.kind !== "chain_cancel") return "done";
    if (elapsed < this.windUpMs) return "windup";
    return "done";
  }

  onEnd(ctx) {
    ctx.lockBossMovement(false);
    ctx.setBossInvulnerable(0);
    super.onEnd(ctx);
  }
}

module.exports = { ChainCancelAttack };
