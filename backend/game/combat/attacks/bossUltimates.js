/**
 * Unique boss ultimates (Watcher keeps legacy Third Eye only).
 */
const { BaseAttack } = require("../BaseAttack");
const { TelegraphSystem } = require("../TelegraphSystem");
const { spawnProjectile } = require("../../helpers");

const ultimateStart = (ctx, atk) => {
  ctx.lockBossMovement(true);
  ctx.setBossInvulnerable(ctx.now + atk.windUpMs);
  ctx.combat.data.u = {};
  ctx.emit("boss_ultimate_start", {
    specialId: atk.id,
    specialName: atk.name,
    windUpMs: atk.windUpMs,
    color: atk.color,
    vfxKey: atk.vfxKey,
  });
  ctx.emit(atk.vfxStart || "boss_ult_generic_start", {
    name: atk.name,
    windUpMs: atk.windUpMs,
    color: atk.color,
    vfxKey: atk.vfxKey,
    centerX: ctx.boss.x,
    centerY: ctx.boss.y,
  });
};

class ReaperUltimate extends BaseAttack {
  constructor() {
    super("reaper_ultimate", { category: "ultimate", windUpMs: 2400, durationMs: 3200 });
    this.name = "Harvest Moon";
    this.color = 0xa855f7;
    this.vfxKey = "reaper";
    this.vfxStart = "boss_ult_reaper_start";
  }
  onStart(ctx) { ultimateStart(ctx, this); return "windup"; }
  onTick(ctx, elapsed) {
    if (elapsed < this.windUpMs) return "windup";
    const u = ctx.combat.data.u;
    const t = elapsed - this.windUpMs;
    const lanes = [320, 400, 480];
    lanes.forEach((ly, i) => {
      if (!u[`s${i}`] && t >= i * 750) {
        u[`s${i}`] = true;
        const x = ctx.char.x;
        ctx.emit("boss_ult_reaper_sweep", { y: ly, x, color: this.color });
        TelegraphSystem.circleAoE(ctx, {
          x, y: ly, radius: 100, warnMs: 500, damage: 20,
          color: this.color, event: "boss_ult_reaper_telegraph",
        });
      }
    });
    if (elapsed >= this.windUpMs + this.durationMs) return "done";
    return "active";
  }
  onEnd(ctx) { ctx.setBossInvulnerable(0); super.onEnd(ctx); }
}

class MatronUltimate extends BaseAttack {
  constructor() {
    super("matron_ultimate", { category: "ultimate", windUpMs: 2000, durationMs: 3800 });
    this.name = "Anvil Descent";
    this.color = 0xb45309;
    this.vfxKey = "matron";
    this.vfxStart = "boss_ult_matron_start";
  }
  onStart(ctx) { ultimateStart(ctx, this); return "windup"; }
  onTick(ctx, elapsed) {
    if (elapsed < this.windUpMs) return "windup";
    const u = ctx.combat.data.u;
    const t = elapsed - this.windUpMs;
    [0, 1, 2].forEach((i) => {
      if (!u[`a${i}`] && t >= i * 900) {
        u[`a${i}`] = true;
        const x = 280 + i * 200;
        ctx.emit("boss_ult_matron_anvil", { x, y: 420, color: this.color });
        TelegraphSystem.circleAoE(ctx, {
          x, y: 420, radius: 75, warnMs: 700, damage: 22,
          color: this.color, event: "boss_ult_matron_telegraph",
        });
      }
    });
    return elapsed >= this.windUpMs + this.durationMs ? "done" : "active";
  }
  onEnd(ctx) { ctx.setBossInvulnerable(0); super.onEnd(ctx); }
}

class SerpentUltimate extends BaseAttack {
  constructor() {
    super("serpent_ultimate", { category: "ultimate", windUpMs: 2800, durationMs: 4000 });
    this.name = "Serpent Coil";
    this.color = 0x6366f1;
    this.vfxKey = "serpent";
    this.vfxStart = "boss_ult_serpent_start";
  }
  onStart(ctx) { ultimateStart(ctx, this); return "windup"; }
  onTick(ctx, elapsed) {
    if (elapsed < this.windUpMs) return "windup";
    if (!ctx.combat.data.u.spawned) {
      ctx.combat.data.u.spawned = true;
      ctx.emit("boss_ult_serpent_coil", { color: this.color });
      const cx = ctx.char.x, cy = ctx.char.y;
      const count = 16;
      for (let i = 0; i < count; i++) {
        const edge = i % 4;
        let x, y;
        if (edge === 0) { x = 60; y = 200 + (i / 4) * 80; }
        else if (edge === 1) { x = 1220; y = 200 + (i / 4) * 80; }
        else if (edge === 2) { x = 200 + (i / 4) * 200; y = 220; }
        else { x = 200 + (i / 4) * 200; y = 560; }
        const dx = cx - x, dy = cy - y;
        const d = Math.max(1, Math.hypot(dx, dy));
        spawnProjectile(ctx.game, {
          x, y, vx: (dx / d) * ctx.speed * 0.7, vy: (dy / d) * ctx.speed * 0.7,
          type: "tendrils", homing: true,
        });
      }
    }
    return elapsed >= this.windUpMs + this.durationMs ? "done" : "active";
  }
  onEnd(ctx) { ctx.setBossInvulnerable(0); super.onEnd(ctx); }
}

class CinderUltimate extends BaseAttack {
  constructor() {
    super("cinder_ultimate", { category: "ultimate", windUpMs: 2200, durationMs: 4500 });
    this.name = "Crown of Cinders";
    this.color = 0xff6600;
    this.vfxKey = "cinder";
    this.vfxStart = "boss_ult_cinder_start";
  }
  onStart(ctx) { ultimateStart(ctx, this); return "windup"; }
  onTick(ctx, elapsed) {
    if (elapsed < this.windUpMs) return "windup";
    if (!ctx.combat.data.u.started) {
      ctx.combat.data.u.started = true;
      ctx.combat.data.u.safeR = 200;
      ctx.emit("boss_ult_cinder_crown", {
        x: 640, y: 400, radius: 200, color: this.color, shrinkMs: 4000,
      });
    }
    const t = elapsed - this.windUpMs;
    if (t > 3500 && !ctx.combat.data.u.blast) {
      ctx.combat.data.u.blast = true;
      const cx = 640, cy = 400;
      const dx = ctx.char.x - cx, dy = ctx.char.y - cy;
      if (dx * dx + dy * dy > 120 * 120) {
        TelegraphSystem.circleAoE(ctx, {
          x: cx, y: cy, radius: 220, warnMs: 400, damage: 28,
          color: this.color, event: "boss_ult_cinder_telegraph",
        });
      }
    }
    return elapsed >= this.windUpMs + this.durationMs ? "done" : "active";
  }
  onEnd(ctx) { ctx.setBossInvulnerable(0); super.onEnd(ctx); }
}

class GlitchUltimate extends BaseAttack {
  constructor() {
    super("glitch_ultimate", { category: "ultimate", windUpMs: 2600, durationMs: 3600 });
    this.name = "Kernel Panic";
    this.color = 0xe879f9;
    this.vfxKey = "glitch";
    this.vfxStart = "boss_ult_glitch_start";
  }
  onStart(ctx) { ultimateStart(ctx, this); return "windup"; }
  onTick(ctx, elapsed) {
    if (elapsed < this.windUpMs) return "windup";
    if (!ctx.combat.data.u.bars) {
      ctx.combat.data.u.bars = true;
      ctx.emit("boss_ult_glitch_bars", { color: this.color, durationMs: 2800 });
      for (let i = 0; i < 5; i++) {
        const x = 180 + i * 160;
        TelegraphSystem.schedule(ctx, {
          event: "boss_ult_glitch_column_warn",
          payload: { x, width: 70, color: this.color },
          warnMs: 600 + i * 120,
          onDamage: (c) => {
            if (Math.abs(c.char.x - x) < 55) {
              const { takeDamage } = require("../../helpers");
              takeDamage(c.io, c.room, 18, x, c.char.y, { source: "column", isColumn: true });
            }
            c.emit("boss_ult_glitch_column_fire", { x, color: this.color });
          },
        });
      }
    }
    return elapsed >= this.windUpMs + this.durationMs ? "done" : "active";
  }
  onEnd(ctx) { ctx.setBossInvulnerable(0); super.onEnd(ctx); }
}

class EntityUltimate extends BaseAttack {
  constructor() {
    super("entity_ultimate", { category: "ultimate", windUpMs: 3000, durationMs: 3800 });
    this.name = "Reality Tear";
    this.color = 0x22d3ee;
    this.vfxKey = "entity";
    this.vfxStart = "boss_ult_entity_start";
  }
  onStart(ctx) { ultimateStart(ctx, this); return "windup"; }
  onTick(ctx, elapsed) {
    if (elapsed < this.windUpMs) return "windup";
    const u = ctx.combat.data.u;
    const t = elapsed - this.windUpMs;
    [0, 1, 2].forEach((i) => {
      if (!u[`t${i}`] && t >= i * 700) {
        u[`t${i}`] = true;
        const ox = (i - 1) * 140;
        ctx.emit("boss_ult_entity_tear", {
          fromX: ctx.boss.x + ox, fromY: ctx.boss.y,
          toX: ctx.char.x, toY: ctx.char.y,
          color: this.color, real: i === 1,
        });
        if (i === 1) {
          TelegraphSystem.circleAoE(ctx, {
            x: ctx.char.x, y: ctx.char.y, radius: 90, warnMs: 450, damage: 30,
            color: this.color, event: "boss_ult_entity_telegraph",
          });
        }
      }
    });
    return elapsed >= this.windUpMs + this.durationMs ? "done" : "active";
  }
  onEnd(ctx) { ctx.setBossInvulnerable(0); super.onEnd(ctx); }
}

class LeechUltimate extends BaseAttack {
  constructor() {
    super("leech_ultimate", { category: "ultimate", windUpMs: 2400, durationMs: 3500 });
    this.name = "Blood Tithe";
    this.color = 0x84cc16;
    this.vfxKey = "leech";
    this.vfxStart = "boss_ult_leech_start";
  }
  onStart(ctx) { ultimateStart(ctx, this); return "windup"; }
  onTick(ctx, elapsed) {
    if (elapsed < this.windUpMs) return "windup";
    if (!ctx.combat.data.u.drain) {
      ctx.combat.data.u.drain = true;
      ctx.combat.data.u.drainUntil = ctx.now + 2800;
      ctx.emit("boss_ult_leech_drain", {
        bossX: ctx.boss.x, bossY: ctx.boss.y,
        charX: ctx.char.x, charY: ctx.char.y,
        color: this.color, durationMs: 2800,
      });
    }
    const u = ctx.combat.data.u;
    if (ctx.now < u.drainUntil) {
      if (!u.lastDrain || ctx.now - u.lastDrain >= 500) {
        u.lastDrain = ctx.now;
        const { takeDamage } = require("../../helpers");
        takeDamage(ctx.io, ctx.room, 4, ctx.char.x, ctx.char.y, {
          source: "typo_backlash", skipWeaponDrop: true,
        });
        ctx.game.bossHP = Math.min(ctx.game.bossMaxHP, ctx.game.bossHP + 6);
      }
    }
    return elapsed >= this.windUpMs + this.durationMs ? "done" : "active";
  }
  onEnd(ctx) { ctx.setBossInvulnerable(0); super.onEnd(ctx); }
}

class WardenUltimate extends BaseAttack {
  constructor() {
    super("warden_ultimate", { category: "ultimate", windUpMs: 2800, durationMs: 4200 });
    this.name = "Ward Collapse";
    this.color = 0x0ea5e9;
    this.vfxKey = "warden";
    this.vfxStart = "boss_ult_warden_start";
  }
  onStart(ctx) { ultimateStart(ctx, this); return "windup"; }
  onTick(ctx, elapsed) {
    if (elapsed < this.windUpMs) return "windup";
    if (!ctx.combat.data.u.laser) {
      ctx.combat.data.u.laser = true;
      ctx.emit("boss_ult_warden_laser", { color: this.color, durationMs: 2000 });
      TelegraphSystem.schedule(ctx, {
        event: "boss_ult_warden_cross_warn",
        payload: { x: ctx.char.x, y: ctx.char.y, color: this.color },
        warnMs: 900,
        onDamage: (c) => {
          const { takeDamage } = require("../../helpers");
          if (Math.abs(c.char.x - 640) < 90) takeDamage(c.io, c.room, 24, 640, c.char.y, { source: "column", isColumn: true });
          if (Math.abs(c.char.y - 400) < 70) takeDamage(c.io, c.room, 24, c.char.x, 400, { source: "column", isColumn: true });
          c.emit("boss_ult_warden_cross_fire", { color: this.color });
        },
      });
    }
    return elapsed >= this.windUpMs + this.durationMs ? "done" : "active";
  }
  onEnd(ctx) { ctx.setBossInvulnerable(0); super.onEnd(ctx); }
}

class CataclysmUltimate extends BaseAttack {
  constructor() {
    super("cataclysm_ultimate", { category: "ultimate", windUpMs: 2600, durationMs: 4500 });
    this.name = "Sequential Siege";
    this.color = 0xf97316;
    this.vfxKey = "cataclysm";
    this.vfxStart = "boss_ult_cataclysm_start";
  }
  onStart(ctx) { ultimateStart(ctx, this); return "windup"; }
  onTick(ctx, elapsed) {
    if (elapsed < this.windUpMs) return "windup";
    const u = ctx.combat.data.u;
    const lanes = [240, 400, 560];
    const t = elapsed - this.windUpMs;
    lanes.forEach((ly, i) => {
      if (!u[`n${i}`] && t >= i * 850) {
        u[`n${i}`] = true;
        ctx.emit("boss_ult_cataclysm_lane", { y: ly, index: i, color: this.color });
        for (let x = 120; x <= 1160; x += 180) {
          TelegraphSystem.circleAoE(ctx, {
            x, y: ly, radius: 55, warnMs: 550, damage: 16,
            color: this.color, event: "boss_ult_cataclysm_telegraph",
          });
        }
      }
    });
    return elapsed >= this.windUpMs + this.durationMs ? "done" : "active";
  }
  onEnd(ctx) { ctx.setBossInvulnerable(0); super.onEnd(ctx); }
}

class OblivionUltimate extends BaseAttack {
  constructor() {
    super("oblivion_ultimate", { category: "ultimate", windUpMs: 3000, durationMs: 3800 });
    this.name = "Echo Fall";
    this.color = 0x6366f1;
    this.vfxKey = "oblivion";
    this.vfxStart = "boss_ult_oblivion_start";
  }
  onStart(ctx) { ultimateStart(ctx, this); return "windup"; }
  onTick(ctx, elapsed) {
    if (elapsed < this.windUpMs) return "windup";
    if (!ctx.combat.data.u.echo) {
      ctx.combat.data.u.echo = true;
      ctx.emit("boss_ult_oblivion_echo", {
        x: ctx.char.x, y: ctx.char.y, color: this.color,
      });
      TelegraphSystem.circleAoE(ctx, {
        x: ctx.char.x, y: ctx.char.y, radius: 130, warnMs: 1100, damage: 32,
        color: this.color, event: "boss_ult_oblivion_telegraph",
      });
    }
    return elapsed >= this.windUpMs + this.durationMs ? "done" : "active";
  }
  onEnd(ctx) { ctx.setBossInvulnerable(0); super.onEnd(ctx); }
}

class OmegaUltimate extends BaseAttack {
  constructor() {
    super("omega_ultimate", { category: "ultimate", windUpMs: 3200, durationMs: 5000 });
    this.name = "Null Genesis";
    this.color = 0xf8fafc;
    this.vfxKey = "omega";
    this.vfxStart = "boss_ult_omega_start";
  }
  onStart(ctx) { ultimateStart(ctx, this); return "windup"; }
  onTick(ctx, elapsed) {
    if (elapsed < this.windUpMs) return "windup";
    const u = ctx.combat.data.u;
    const t = elapsed - this.windUpMs;
    if (!u.safe && t >= 0) {
      u.safe = true;
      const sx = 320 + Math.random() * 400, sy = 320 + Math.random() * 120;
      ctx.emit("boss_ult_omega_safe", { x: sx, y: sy, radius: 90, color: this.color });
      ctx.game._omegaSafe = { x: sx, y: sy, r: 90 };
    }
    if (!u.blast && t >= 3200) {
      u.blast = true;
      const safe = ctx.game._omegaSafe;
      const inSafe = safe && (ctx.char.x - safe.x) ** 2 + (ctx.char.y - safe.y) ** 2 <= safe.r * safe.r;
      ctx.emit("boss_ult_omega_genesis", { color: this.color, safe: inSafe });
      if (!inSafe) {
        const { takeDamage } = require("../../helpers");
        takeDamage(ctx.io, ctx.room, 42, ctx.char.x, ctx.char.y, { source: "aoe" });
      }
    }
    return elapsed >= this.windUpMs + this.durationMs ? "done" : "active";
  }
  onEnd(ctx) {
    ctx.game._omegaSafe = null;
    ctx.setBossInvulnerable(0);
    super.onEnd(ctx);
  }
}

module.exports = {
  ReaperUltimate,
  MatronUltimate,
  SerpentUltimate,
  CinderUltimate,
  GlitchUltimate,
  EntityUltimate,
  LeechUltimate,
  WardenUltimate,
  CataclysmUltimate,
  OblivionUltimate,
  OmegaUltimate,
};
