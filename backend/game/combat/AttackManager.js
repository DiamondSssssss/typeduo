/**
 * Attack Manager + lightweight FSM for bosses with combatProfile.
 *
 * States: idle → windup → active → (cooldown via per-attack cooldowns map)
 *
 * Decision logic:
 *   - Ultimate at HP threshold (once per fight)
 *   - Otherwise weighted random from attacks passing range/cooldown/phase checks
 *   - Melee favored when close, dash when far (via minRange/maxRange on entries)
 */
const { AttackContext } = require("./AttackContext");
const { TelegraphSystem } = require("./TelegraphSystem");
const { getAttack } = require("./AttackRegistry");
const { SPECIAL_MAP } = require("../attackPatterns");

class AttackManager {
  tick(io, room, bossConfig, phase, now, deltaMs) {
    const game = room.game;
    if (!game || !bossConfig.combatProfile) return false;

    const ctx = new AttackContext({ game, bossConfig, phase, io, room, now, deltaMs });
    TelegraphSystem.tick(ctx);

    // Tick void-zone detonations (Void Crawler patterns via bridge)
    this._tickVoidZones(ctx);

    const profile = bossConfig.combatProfile;
    const combat  = ctx.combat;

    // ── Legacy low-HP special burst (e.g. Meltdown at 10%) ────────────────────
    this._maybeFireLowHpSpecial(ctx, phase);

    // ── Ultimate at HP threshold (e.g. 50%) ───────────────────────────────────
    if (profile.ultimate && !game.ultimateTriggered) {
      const pct = game.bossHP / Math.max(1, game.bossMaxHP);
      if (pct <= (profile.ultimate.triggerHpPct ?? 0.5)) {
        game.ultimateTriggered = true;
        this._startAttack(ctx, profile.ultimate.id || "boss_ultimate");
        return true;
      }
    }

    // ── Active attack FSM ─────────────────────────────────────────────────────
    if (combat.state === "active" || combat.state === "windup") {
      const atk = getAttack(combat.currentId);
      if (!atk) {
        combat.state = "idle";
        return true;
      }
      const elapsed = now - combat.startedAt;
      const phaseState = atk.onTick(ctx, elapsed);
      if (phaseState === "done") {
        atk.onEnd(ctx);
        combat.state = "idle";
        combat.currentId = null;
      } else {
        combat.state = phaseState === "windup" ? "windup" : "active";
      }
      return true;
    }

    // ── Pick next attack (idle) ─────────────────────────────────────────────
    if (combat.state !== "idle") return true;

    const picked = this._pickAttack(ctx, profile);
    if (picked) this._startAttack(ctx, picked);
    return true;
  }

  _startAttack(ctx, attackId) {
    const atk = getAttack(attackId);
    if (!atk) return;
    const combat = ctx.combat;
    combat.currentId = attackId;
    combat.startedAt = ctx.now;
    combat.data = {};
    const startState = atk.onStart(ctx);
    combat.state = startState === "windup" ? "windup" : "active";
    ctx.boss.attackType = attackId;
  }

  /**
   * Weighted RNG selection with distance-aware filtering.
   * TWEAK: adjust entry.weight per boss combatProfile.attacks[]
   */
  /** Fire bossConfig.special once (rust meltdown, etc.) for combat-profile bosses. */
  _maybeFireLowHpSpecial(ctx, phase) {
    const special = ctx.bossConfig.special;
    if (!special || ctx.game.lowHpSpecialTriggered) return;
    if (ctx.game.bossState !== "attack") return;
    const pct = ctx.game.bossHP / Math.max(1, ctx.game.bossMaxHP);
    if (pct > (special.triggerHpPct ?? 0.1)) return;

    ctx.game.lowHpSpecialTriggered = true;
    const fn = SPECIAL_MAP[special.id];
    if (fn) {
      ctx.bossConfig._io       = ctx.io;
      ctx.bossConfig._roomCode = ctx.room.code;
      fn(ctx.game, ctx.boss, ctx.char, phase, ctx.speed, ctx.bossConfig, ctx.now);
      ctx.bossConfig._io = null;
      ctx.bossConfig._roomCode = null;
    }
    ctx.emit("boss_ultimate_start", {
      specialId: special.id,
      specialName: special.name,
      windUpMs: special.windUpMs || 0,
    });
  }

  _pickAttack(ctx, profile) {
    const entries = profile.attacks || [];
    const candidates = [];

    for (const entry of entries) {
      const atk = getAttack(entry.id);
      if (!atk || !atk.canSelect(ctx, entry)) continue;
      candidates.push({ entry, atk, weight: entry.weight ?? atk.weight ?? 10 });
    }

    if (!candidates.length) return null;

    const total = candidates.reduce((s, c) => s + c.weight, 0);
    let roll = Math.random() * total;
    for (const c of candidates) {
      roll -= c.weight;
      if (roll <= 0) return c.entry.id;
    }
    return candidates[candidates.length - 1].entry.id;
  }

  _tickVoidZones(ctx) {
    const list = ctx.game._voidZoneDetonates;
    if (!list?.length) return;
    const { spawnProjectile } = require("../helpers");
    ctx.game._voidZoneDetonates = list.filter((vz) => {
      if (ctx.now < vz.detonateAt) return true;
      const count = 12 + (vz.phase || 0) * 4;
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2;
        spawnProjectile(ctx.game, {
          x: vz.x, y: vz.y,
          vx: Math.cos(a) * vz.speed, vy: Math.sin(a) * vz.speed,
          type: "void_orb", homing: true,
        });
      }
      ctx.emit("void_zone_explode", { x: vz.x, y: vz.y });
      return false;
    });
  }
}

let _instance = null;
const getAttackManager = () => {
  if (!_instance) _instance = new AttackManager();
  return _instance;
};

module.exports = { AttackManager, getAttackManager };
