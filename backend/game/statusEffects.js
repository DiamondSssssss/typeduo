const { POISON_TICK_DAMAGE, POISON_TICK_MS, SLOW_MOVE_MULT } = require("./constants");
const { takeDamage } = require("./helpers");

/** Tick poison/slow and ground hazards. */
const tickStatusAndHazards = (io, room, now, deltaSeconds) => {
  const g = room.game;
  if (!g) return;

  // Poison DoT
  if (g.poisonUntil && now < g.poisonUntil) {
    if (!g.lastPoisonTick || now - g.lastPoisonTick >= POISON_TICK_MS) {
      g.lastPoisonTick = now;
      takeDamage(io, room, POISON_TICK_DAMAGE, g.character.x, g.character.y, { skipStreakReset: true, skipWeaponDrop: true });
      io.to(room.code).emit("status_tick", { type: "poison", damage: POISON_TICK_DAMAGE });
    }
  } else if (g.poisonUntil) {
    g.poisonUntil = 0;
    io.to(room.code).emit("status_cleared", { type: "poison" });
  }

  // Toxic pools on ground
  if (g._toxicPools?.length) {
    const char = g.character;
    g._toxicPools = g._toxicPools.filter((pool) => {
      if (now >= pool.expiresAt) return false;
      const dx = char.x - pool.x;
      const dy = char.y - pool.y;
      if (dx * dx + dy * dy < pool.r * pool.r) {
        g.poisonUntil = Math.max(g.poisonUntil || 0, now + 3500);
        if (!g.lastPoisonTick || now - g.lastPoisonTick >= POISON_TICK_MS) {
          g.lastPoisonTick = now;
          takeDamage(io, room, POISON_TICK_DAMAGE, pool.x, pool.y, { skipStreakReset: true, skipWeaponDrop: true });
        }
      }
      return true;
    });
  }

  // Slow fields
  if (g._slowFields?.length) {
    const char = g.character;
    let slowed = false;
    g._slowFields = g._slowFields.filter((f) => {
      if (now >= f.expiresAt) return false;
      const dx = char.x - f.x;
      const dy = char.y - f.y;
      if (dx * dx + dy * dy < f.r * f.r) slowed = true;
      return true;
    });
    g.slowed = slowed;
    g.moveSpeedMult = slowed ? SLOW_MOVE_MULT : 1;
  } else {
    g.slowed = false;
    g.moveSpeedMult = 1;
  }

  // Delayed projectile spawns (Chronarch)
  if (g._delayedSpawns?.length) {
    const { spawnProjectile } = require("./helpers");
    g._delayedSpawns = g._delayedSpawns.filter((d) => {
      if (now < d.at) return true;
      spawnProjectile(g, d.proj);
      if (d.emit) io.to(room.code).emit(d.emit, d.emitData);
      return false;
    });
  }

  // Magnet pull (Rust Golem) — gentle pull toward boss during attack
  if (g._magnetActive && g.boss) {
    const char = g.character;
    const dx = g.boss.x - char.x;
    const dy = g.boss.y - char.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 40 && dist < 200) {
      const pull = 45 * deltaSeconds;
      char.x += (dx / dist) * pull;
      char.y += (dy / dist) * pull * 0.3;
      char.x = Math.max(30, Math.min(1250, char.x));
      char.y = Math.max(200, Math.min(590, char.y));
    }
  }
};

const applyPoison = (g, durationMs, now) => {
  g.poisonUntil = Math.max(g.poisonUntil || 0, now + durationMs);
};

module.exports = { tickStatusAndHazards, applyPoison };
