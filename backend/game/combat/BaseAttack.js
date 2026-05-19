/**
 * Base class for all boss attacks (Command/Strategy pattern).
 *
 * Subclass and override onStart / onTick / onEnd.
 * Register instances in AttackRegistry.js.
 *
 * TWEAK GUIDE (per attack instance in AttackRegistry):
 *   cooldownMs  — minimum ms before this attack can be chosen again
 *   windUpMs    — telegraph duration before active phase (0 = instant active)
 *   durationMs  — how long onTick runs after wind-up
 *   weight      — relative pick chance (higher = more common)
 *   minRange    — only selectable if player is at least this far (px)
 *   maxRange    — only selectable if player is within this far (px)
 *   phases      — HP phases [0,1,2] where attack is allowed
 */
class BaseAttack {
  constructor(id, opts = {}) {
    this.id          = id;
    this.category    = opts.category || "generic";
    this.cooldownMs  = opts.cooldownMs  ?? 5000;
    this.windUpMs    = opts.windUpMs    ?? 0;
    this.durationMs  = opts.durationMs  ?? 3000;
    this.weight      = opts.weight      ?? 10;
    this.minRange    = opts.minRange    ?? 0;
    this.maxRange    = opts.maxRange    ?? 9999;
    this.phases      = opts.phases      ?? [0, 1, 2];
    this.patternId   = opts.patternId   || null; // for PatternBridgeAttack
  }

  /** Can this attack be selected right now? */
  canSelect(ctx, entry) {
    if (!this.phases.includes(ctx.phase)) return false;
    const dist = ctx.distToPlayer();
    const minR = entry?.minRange ?? this.minRange;
    const maxR = entry?.maxRange ?? this.maxRange;
    if (dist < minR || dist > maxR) return false;
    const readyAt = ctx.combat.cooldowns[this.id] || 0;
    return ctx.now >= readyAt;
  }

  /** @returns {'windup'|'active'|'done'} */
  onStart(ctx) {
    ctx.lockBossMovement(true);
    if (this.windUpMs > 0) return "windup";
    return "active";
  }

  /**
   * Called each tick while attack is running.
   * @returns {'windup'|'active'|'done'}
   */
  onTick(ctx, elapsed) {
    if (elapsed < this.windUpMs) return "windup";
    if (elapsed < this.windUpMs + this.durationMs) return "active";
    return "done";
  }

  onEnd(ctx) {
    ctx.combat.cooldowns[this.id] = ctx.now + this.cooldownMs;
    ctx.lockBossMovement(false);
    ctx.boss.attackType = this.id;
    ctx.emit("boss_attack_changed", { attackType: this.id });
  }
}

module.exports = { BaseAttack };
