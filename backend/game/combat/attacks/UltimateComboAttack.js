/**
 * ULTIMATE — triggered at HP threshold by AttackManager.
 * Phases: invuln wind-up → pull player → AoE blast → spawn minion projectiles.
 *
 * TWEAK: windUpMs, pullMs, blastRadius, blastDamage, minionCount
 */
const { BaseAttack } = require("../BaseAttack");
const { TelegraphSystem } = require("../TelegraphSystem");
const { spawnProjectile, takeDamage } = require("../../helpers");

class UltimateComboAttack extends BaseAttack {
  constructor(id = "boss_ultimate", opts = {}) {
    super(id, {
      category: "ultimate",
      cooldownMs: opts.cooldownMs ?? 999999,
      windUpMs:   opts.windUpMs   ?? 2800,  // TWEAK: invuln + telegraph time
      durationMs: opts.durationMs ?? 3500,
      weight:     0,
      phases:     [0, 1, 2],
      ...opts,
    });
    this.name          = opts.name          ?? "Ultimate";
    this.pullMs        = opts.pullMs        ?? 1200;
    this.blastRadius   = opts.blastRadius   ?? 160;
    this.blastDamage   = opts.blastDamage   ?? 28;
    this.minionCount   = opts.minionCount   ?? 6;
    this.centerX       = opts.centerX       ?? 640;
    this.centerY       = opts.centerY       ?? 400;
    this.color         = opts.color         ?? 0xff3d9f;
  }

  onStart(ctx) {
    ctx.lockBossMovement(true);
    ctx.setBossInvulnerable(ctx.now + this.windUpMs);
    ctx.combat.data.ultPhase = "windup";
    ctx.combat.data.ultPullDone = false;
    ctx.combat.data.ultBlastDone = false;
    ctx.combat.data.ultMinionsDone = false;
    ctx.emit("ultimate_windup", {
      name: this.name, durationMs: this.windUpMs,
      centerX: this.centerX, centerY: this.centerY, color: this.color,
    });
    ctx.emit("boss_ultimate_start", { specialId: this.id, specialName: this.name, windUpMs: this.windUpMs });
    return "windup";
  }

  onTick(ctx, elapsed) {
    // Phase 1: wind-up (boss invulnerable)
    if (elapsed < this.windUpMs) return "windup";

    // Phase 2: pull player toward center
    if (!ctx.combat.data.ultPullDone) {
      ctx.combat.data.ultPullDone = true;
      ctx.combat.data.ultPullAt = ctx.now;
      ctx.game._magnetActive = true;
      ctx.game._magnetTarget = { x: this.centerX, y: this.centerY };
      ctx.emit("ultimate_pull", { centerX: this.centerX, centerY: this.centerY, durationMs: this.pullMs, color: this.color });
    }

    if (ctx.game._magnetActive && ctx.game._magnetTarget) {
      const t = ctx.game._magnetTarget;
      const dx = t.x - ctx.char.x;
      const dy = t.y - ctx.char.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 20) {
        const pull = 120 * (ctx.deltaMs / 1000);
        ctx.char.x += (dx / dist) * pull;
        ctx.char.y += (dy / dist) * pull;
        ctx.char.x = Math.max(30, Math.min(1250, ctx.char.x));
        ctx.char.y = Math.max(200, Math.min(590, ctx.char.y));
      }
    }

    const afterPull = elapsed - this.windUpMs;
    if (afterPull >= this.pullMs) {
      ctx.game._magnetActive = false;
      ctx.game._magnetTarget = null;
    }

    // Phase 3: AoE blast
    if (afterPull >= this.pullMs && !ctx.combat.data.ultBlastDone) {
      ctx.combat.data.ultBlastDone = true;
      TelegraphSystem.circleAoE(ctx, {
        x: this.centerX, y: this.centerY,
        radius: this.blastRadius,
        warnMs: 400,
        damage: this.blastDamage,
        event: "ultimate_blast_telegraph",
        color: this.color,
      });
      ctx.emit("ultimate_blast", { x: this.centerX, y: this.centerY, radius: this.blastRadius, color: this.color });
    }

    // Phase 4: minion orbs
    if (afterPull >= this.pullMs + 500 && !ctx.combat.data.ultMinionsDone) {
      ctx.combat.data.ultMinionsDone = true;
      for (let i = 0; i < this.minionCount; i++) {
        const a = (i / this.minionCount) * Math.PI * 2;
        const dist = 100;
        spawnProjectile(ctx.game, {
          x: this.centerX + Math.cos(a) * dist,
          y: this.centerY + Math.sin(a) * dist,
          vx: Math.cos(a) * 80,
          vy: Math.sin(a) * 80,
          type: "minion_orb",
          homing: true,
        });
      }
      ctx.emit("ultimate_minions", { count: this.minionCount, centerX: this.centerX, centerY: this.centerY });
    }

    if (elapsed >= this.windUpMs + this.durationMs) return "done";
    return "active";
  }

  onEnd(ctx) {
    ctx.game._magnetActive = false;
    ctx.game._magnetTarget = null;
    ctx.setBossInvulnerable(0);
    ctx.combat.data.ultPhase = null;
    super.onEnd(ctx);
  }
}

module.exports = { UltimateComboAttack };
