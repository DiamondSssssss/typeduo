const { BaseAttack } = require("../BaseAttack");
const { startPlayerStun } = require("../../typingChallenges");

class ParalyzeTyperAttack extends BaseAttack {
  constructor(id = "paralyze_typer", opts = {}) {
    super(id, {
      category: "special",
      cooldownMs: opts.cooldownMs ?? 13000,
      windUpMs: opts.windUpMs ?? 2200,
      durationMs: opts.durationMs ?? 2200,
      weight: opts.weight ?? 12,
      maxRange: opts.maxRange ?? 9999,
      ...opts,
    });
    this.stunMs = opts.stunMs ?? 9000;
  }

  onStart(ctx) {
    ctx.emit("paralyze_windup", { durationMs: this.windUpMs });
    return "windup";
  }

  onTick(ctx, elapsed) {
    if (elapsed < this.windUpMs) return "windup";
    if (!ctx.combat.data.applied) {
      ctx.combat.data.applied = true;
      startPlayerStun(ctx.io, ctx.room, ctx.game, { durationMs: this.stunMs });
    }
    return "done";
  }

  onEnd(ctx) {
    super.onEnd(ctx);
  }
}

module.exports = { ParalyzeTyperAttack };
