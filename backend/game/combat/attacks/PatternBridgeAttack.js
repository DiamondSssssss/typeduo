/**
 * Bridges legacy PATTERN_MAP projectile attacks into the new Attack Manager.
 * Use patternId to reference existing pattern functions.
 */
const { BaseAttack } = require("../BaseAttack");
const { PATTERN_MAP } = require("../../attackPatterns");

class PatternBridgeAttack extends BaseAttack {
  constructor(id, opts = {}) {
    super(id, {
      category: "projectile",
      cooldownMs: opts.cooldownMs ?? 4000,
      windUpMs:   opts.windUpMs   ?? 0,
      durationMs: opts.durationMs ?? 3500,
      weight:     opts.weight     ?? 12,
      patternId:  opts.patternId || id,
      ...opts,
    });
    this.patternId = opts.patternId || id;
  }

  onStart(ctx) {
    if (this.windUpMs > 0) {
      ctx.lockBossMovement(true);
      ctx.emit("boss_windup_start", { attackType: this.patternId, durationMs: this.windUpMs });
      return "windup";
    }
    this._firePattern(ctx);
    ctx.lockBossMovement(false);
    return "active";
  }

  _firePattern(ctx) {
    const fn = PATTERN_MAP[this.patternId];
    if (!fn) return;
    ctx.bossConfig._io       = ctx.io;
    ctx.bossConfig._roomCode = ctx.room.code;
    ctx.boss.attackType = this.patternId;
    ctx.boss.lastFireAt = ctx.now;
    fn(ctx.game, ctx.boss, ctx.char, ctx.phase, ctx.speed, ctx.bossConfig, ctx.now);
    ctx.bossConfig._io = null;
    ctx.bossConfig._roomCode = null;
    ctx.emit("boss_attack_changed", { attackType: this.patternId });
  }

  onTick(ctx, elapsed) {
    if (elapsed < this.windUpMs) return "windup";
    if (!ctx.combat.data.patternFiring) {
      ctx.combat.data.patternFiring = true;
      this._firePattern(ctx);
    }
    const fn = PATTERN_MAP[this.patternId];
    if (fn) {
      ctx.bossConfig._io       = ctx.io;
      ctx.bossConfig._roomCode = ctx.room.code;
      fn(ctx.game, ctx.boss, ctx.char, ctx.phase, ctx.speed, ctx.bossConfig, ctx.now);
      ctx.bossConfig._io = null;
      ctx.bossConfig._roomCode = null;
    }
    if (elapsed < this.windUpMs + this.durationMs) return "active";
    return "done";
  }

  onEnd(ctx) {
    ctx.combat.data.patternFiring = false;
    super.onEnd(ctx);
  }
}

module.exports = { PatternBridgeAttack };
