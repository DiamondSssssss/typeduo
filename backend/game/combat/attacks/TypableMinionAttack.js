const { BaseAttack } = require("../BaseAttack");
const { spawnTypableMinions } = require("../../typingChallenges");

class TypableMinionAttack extends BaseAttack {
  constructor(id = "summon_typable_minions", opts = {}) {
    super(id, {
      category: "special",
      cooldownMs: opts.cooldownMs ?? 12000,
      windUpMs: opts.windUpMs ?? 900,
      durationMs: opts.durationMs ?? 1200,
      weight: opts.weight ?? 16,
      ...opts,
    });
    this.minionCount = opts.minionCount ?? 4;
  }

  onStart(ctx) {
    ctx.lockBossMovement(true);
    ctx.emit("boss_windup_start", { attackType: this.id, durationMs: this.windUpMs, label: "SUMMON" });
    return "windup";
  }

  onTick(ctx, elapsed) {
    if (elapsed < this.windUpMs) return "windup";
    if (!ctx.combat.data.spawned) {
      ctx.combat.data.spawned = true;
      spawnTypableMinions(ctx.io, ctx.room, ctx.game, { count: this.minionCount });
    }
    if (elapsed < this.windUpMs + this.durationMs) return "active";
    return "done";
  }

  onEnd(ctx) {
    ctx.lockBossMovement(false);
    super.onEnd(ctx);
  }
}

module.exports = { TypableMinionAttack };
