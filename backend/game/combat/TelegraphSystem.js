/**
 * Central telegraph emitter — warns the client before damage frames.
 *
 * Tweak: change `durationMs` per call; client draws warning VFX from these events.
 */
const { takeDamage } = require("../helpers");

class TelegraphSystem {
  /**
   * Emit a warning and schedule damage when the telegraph expires.
   * @param {AttackContext} ctx
   * @param {object} opts
   * @param {string} opts.event       - Socket event name for the warning VFX
   * @param {object} opts.payload     - Data sent to clients (x, y, radius, color, etc.)
   * @param {number} opts.warnMs      - Wind-up before damage (TWEAK: higher = more reaction time)
   * @param {function} opts.onDamage  - Called when warnMs elapses; apply damage here
   */
  static schedule(ctx, { event, payload, warnMs, onDamage }) {
    const detonateAt = ctx.now + warnMs;
    if (!ctx.game._telegraphs) ctx.game._telegraphs = [];
    ctx.emit(event, { ...payload, durationMs: warnMs });
    ctx.game._telegraphs.push({ detonateAt, onDamage, payload });
  }

  /** Tick pending telegraphs — call from game loop each frame. */
  static tick(ctx) {
    const list = ctx.game._telegraphs;
    if (!list?.length) return;
    ctx.game._telegraphs = list.filter((t) => {
      if (ctx.now < t.detonateAt) return true;
      t.onDamage(ctx);
      return false;
    });
  }

  /**
   * Circular AoE at (x,y) after warnMs.
   * @param {number} damage - TWEAK: damage dealt if player inside radius
   * @param {number} radius - TWEAK: hit radius in pixels
   */
  static circleAoE(ctx, { x, y, radius, warnMs, damage, event = "aoe_telegraph", color = 0xff4444, skipWeaponDrop = false }) {
    TelegraphSystem.schedule(ctx, {
      event,
      payload: { x, y, radius, color },
      warnMs,
      onDamage: (c) => {
        const dx = c.char.x - x;
        const dy = c.char.y - y;
        if (dx * dx + dy * dy <= radius * radius) {
          takeDamage(c.io, c.room, damage, x, y, { skipWeaponDrop });
        }
        c.emit("aoe_detonate", { x, y, radius, color });
      },
    });
  }
}

module.exports = { TelegraphSystem };
