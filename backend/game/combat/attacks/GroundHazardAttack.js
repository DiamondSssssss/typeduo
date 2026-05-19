/**
 * AoE / ENVIRONMENTAL — spawns lingering ground hazards (runes/pools).
 *
 * TWEAK: hazardCount, hazardRadius, hazardDurationMs, tickDamage
 */
const { BaseAttack } = require("../BaseAttack");

class GroundHazardAttack extends BaseAttack {
  constructor(id = "shadow_runes", opts = {}) {
    super(id, {
      category: "aoe",
      cooldownMs: opts.cooldownMs ?? 5500,
      windUpMs:   opts.windUpMs   ?? 700,
      durationMs: opts.durationMs ?? 500,
      weight:     opts.weight     ?? 16,
      ...opts,
    });
    this.hazardCount    = opts.hazardCount    ?? 4;    // TWEAK: how many spots
    this.hazardRadius   = opts.hazardRadius   ?? 55;
    this.hazardDuration = opts.hazardDuration ?? 5000; // TWEAK: linger time
    this.tickDamage     = opts.tickDamage     ?? 5;
    this.color          = opts.color          ?? 0x84cc16;
    this.hazardType     = opts.hazardType     ?? "rune"; // rune | poison
  }

  onStart(ctx) {
    super.onStart(ctx);
    ctx.emit("hazard_windup", { durationMs: this.windUpMs, color: this.color });
    return "windup";
  }

  onTick(ctx, elapsed) {
    if (elapsed < this.windUpMs) return "windup";
    if (!ctx.combat.data.hazardsPlaced) {
      ctx.combat.data.hazardsPlaced = true;
      if (!ctx.game._groundHazards) ctx.game._groundHazards = [];
      for (let i = 0; i < this.hazardCount; i++) {
        const x = 200 + Math.random() * 880;
        const y = 280 + Math.random() * 260;
        const hazard = {
          x, y, r: this.hazardRadius,
          expiresAt: ctx.now + this.hazardDuration,
          damage: this.tickDamage,
          color: this.color,
          type: this.hazardType,
        };
        ctx.game._groundHazards.push(hazard);
        ctx.emit("ground_hazard_placed", hazard);
      }
    }
    if (elapsed < this.windUpMs + this.durationMs) return "active";
    return "done";
  }

  onEnd(ctx) {
    ctx.combat.data.hazardsPlaced = false;
    super.onEnd(ctx);
  }
}

module.exports = { GroundHazardAttack };
