const { BaseAttack } = require("../BaseAttack");
const { startMirrorWord } = require("../../typingChallenges");

class MirrorWordAttack extends BaseAttack {
  constructor(id = "mirror_word", opts = {}) {
    super(id, {
      category: "special",
      cooldownMs: opts.cooldownMs ?? 11000,
      windUpMs: opts.windUpMs ?? 600,
      durationMs: opts.durationMs ?? 800,
      weight: opts.weight ?? 14,
      ...opts,
    });
  }

  onStart(ctx) {
    ctx.lockBossMovement(true);
    startMirrorWord(ctx.io, ctx.room, ctx.game);
    ctx.emit("boss_windup_start", { attackType: this.id, durationMs: this.windUpMs, label: "MIRROR" });
    return "windup";
  }

  onTick(ctx, elapsed) {
    if (!ctx.game._challenge || ctx.game._challenge.kind !== "mirror_word") return "done";
    if (elapsed < this.windUpMs + this.durationMs) return "active";
    return "done";
  }

  onEnd(ctx) {
    ctx.lockBossMovement(false);
    super.onEnd(ctx);
  }
}

module.exports = { MirrorWordAttack };
