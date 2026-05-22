/**
 * Boss AI: movement, wind-up system, attack queue advancement,
 * column attacks, and homing projectile steering.
 */
const { PATTERN_MAP, SPECIAL_MAP } = require("./attackPatterns");
const { takeDamage } = require("./helpers");
const { BOSS_X_MIN, BOSS_X_MAX } = require("./constants");
const { getAttackManager } = require("./combat/AttackManager");

// ── Movement ──────────────────────────────────────────────────────────────────
exports.moveBoss = (game, bossConfig, now, deltaSeconds, phase) => {
  const b = game.boss;
  const speed = bossConfig.moveSpeed[phase];

  const dx = b.targetX - b.x;
  const dy = b.targetY - b.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist > 1) {
    const move = Math.min(dist, speed * deltaSeconds);
    b.x += (dx / dist) * move;
    b.y += (dy / dist) * move;
  }

  if (b.combatLockMove) return;

  if (now >= b.nextMoveAt) {
    // Hold position during column attack wind-up
    if (b.columnState === "warning") {
      b.nextMoveAt = now + 1500;
      return;
    }
    b.nextMoveAt = now + 2500 + Math.random() * 3000;
    b.targetX = BOSS_X_MIN + Math.random() * (BOSS_X_MAX - BOSS_X_MIN);
    b.targetY = (bossConfig.yBase || 100) + Math.random() * (bossConfig.yRange || 40);
  }
};

// ── Wind-up system ────────────────────────────────────────────────────────────
/**
 * Start a wind-up before transitioning to nextAttack.
 * Emits boss_windup_start and stores state on boss.
 */
exports.beginWindUp = (io, room, nextAttack, windUpMs) => {
  const b = room.game.boss;
  const mult = room.game.windUpMult ?? 1;
  const ms = Math.round(windUpMs * mult);
  b.windingUp     = true;
  b.windUpAttack  = nextAttack;
  b.windUpUntil   = Date.now() + ms;
  io.to(room.code).emit("boss_windup_start", { attackType: nextAttack, durationMs: ms });
};

/**
 * Called each tick when boss.windingUp === true.
 * Returns true when still winding up (caller should skip firing).
 */
exports.tickWindUp = (io, room, bossConfig, now) => {
  const b = room.game.boss;
  if (!b.windingUp) return false;
  if (now < b.windUpUntil) return true; // still counting down

  // Wind-up complete — launch the attack
  const nextAttack = b.windUpAttack;
  b.windingUp    = false;
  b.windUpAttack = null;
  b.windUpUntil  = 0;

  exports.applyAttack(io, room, bossConfig, nextAttack, now);
  return false;
};

/** Apply (start) a new attack type on the boss, resetting per-attack state. */
exports.applyAttack = (io, room, bossConfig, attackType, now) => {
  const b = room.game.boss;
  b.attackType    = attackType;
  b.lastFireAt    = now;
  b.circleFired   = false;

  // Reset all per-attack sub-timers
  b.hellSpiralAt     = 0;
  b.hellRainAt       = 0;
  b.tempestSweepAt   = 0;
  b.tempestRainAt    = 0;
  b.tempestChainAt   = 0;
  b.wildfireSpreadAt = 0;
  b.wildfireRainAt   = 0;
  b.avalancheFromLeft = Math.random() < 0.5; // randomise starting side for variety

  // ── Always reset column state ─────────────────────────────────────────────
  // If we're transitioning AWAY from a column attack and columnState is still
  // "warning" or "active", moveBoss would see b.columnState === "warning" and
  // keep extending b.nextMoveAt by 1500ms every tick — permanent freeze.
  // Resetting here is safe: tickColumnAttack will re-initialise in the same
  // tick if the new attackType IS the column attack type.
  b.columnState   = null;
  b.columnStateAt = 0;
  // Clear pending hazards when switching attack types
  if (room.game) {
    room.game._voidZoneDetonates = [];
    room.game._magnetActive = false;
  }
  if (bossConfig.columnAttack?.type === attackType) {
    b.columnX = 480; // tickColumnAttack will override with the real target
  }

  // ── Unfreeze movement ─────────────────────────────────────────────────────
  // Column attacks set b.targetX = b.x and b.nextMoveAt = far future so the
  // boss holds still.  Reset nextMoveAt so moveBoss picks a new destination on
  // the very next tick.  tickColumnAttack will re-lock movement in the same
  // tick if the new attack is a column attack, so this is always safe.
  b.nextMoveAt = 0;

  io.to(room.code).emit("boss_attack_changed", { attackType });
};

// ── Attack queue advancement ──────────────────────────────────────────────────
exports.advanceBossAttackQueue = (io, room, bossConfig, phase, deltaMs, now) => {
  const b = room.game.boss;
  if (b.windingUp) return; // already in wind-up
  b.attackTimer -= deltaMs;
  if (b.attackTimer > 0) return;

  const queue = bossConfig.attackQueues[phase];
  b.attackQueueIdx = (b.attackQueueIdx + 1) % queue.length;
  const nextAttack  = queue[b.attackQueueIdx];
  const windUpMs    = bossConfig.windUps?.[nextAttack] || 0;
  const duration    = bossConfig.attackDurations?.[nextAttack] ?? 4000;

  b.attackTimer = duration;

  if (windUpMs > 0) {
    exports.beginWindUp(io, room, nextAttack, windUpMs);

    // If boss config marks this wind-up as cancellable, start a cancel window.
    // The player completes their current weapon word to cancel the attack.
    const cancelCfg = bossConfig.cancellableWindUps?.[nextAttack];
    if (cancelCfg) {
      const { startWindupCancel } = require('./typingChallenges');
      const scaledMs = Math.round(windUpMs * (room.game.windUpMult ?? 1));
      startWindupCancel(io, room, room.game, {
        attackId:    nextAttack,
        windUpMs:    scaledMs,
        blastDamage: cancelCfg.blastDamage ?? 28,
      });
    }
  } else {
    exports.applyAttack(io, room, bossConfig, nextAttack, now);
  }
};

// ── Column attack (laser / lightning bolt) ────────────────────────────────────
exports.tickColumnAttack = (io, room, bossConfig, now) => {
  const colCfg = bossConfig.columnAttack;
  if (!colCfg) return;
  const b = room.game.boss;

  if (b.columnState === null) {
    b.columnState   = "warning";
    b.columnX = colCfg.targetMode === "char"   ? room.game.character.x
              : colCfg.targetMode === "random" ? (BOSS_X_MIN + Math.random() * (BOSS_X_MAX - BOSS_X_MIN))
              : b.x;
    b.columnStateAt = now;
    b.nextMoveAt    = now + colCfg.warnMs + colCfg.activeMs + 800; // hold still
    b.targetX       = b.x;
    io.to(room.code).emit("column_warning", {
      x: b.columnX, width: colCfg.width, color: colCfg.color, durationMs: colCfg.warnMs,
    });

  } else if (b.columnState === "warning" && now - b.columnStateAt >= colCfg.warnMs) {
    b.columnState   = "active";
    b.columnStateAt = now;
    io.to(room.code).emit("column_fire", {
      x: b.columnX, width: colCfg.width, color: colCfg.color, durationMs: colCfg.activeMs,
    });
    if (Math.abs(room.game.character.x - b.columnX) < colCfg.width / 2) {
      takeDamage(io, room, colCfg.damage, b.columnX, 300, { source: 'column' });
    }

  } else if (b.columnState === "active" && now - b.columnStateAt >= colCfg.activeMs) {
    b.columnState   = null;
    b.columnStateAt = 0;
  }
};

// ── Main attack tick ──────────────────────────────────────────────────────────
exports.tickBossAttacks = (io, room, bossConfig, phase, now, deltaMs) => {
  // Modern combat profile (FSM + Attack Manager)
  if (bossConfig.combatProfile) {
    getAttackManager().tick(io, room, bossConfig, phase, now, deltaMs);
    return;
  }

  const b    = room.game.boss;
  const char = room.game.character;
  const speed = bossConfig.projSpeed[phase];

  // Handle wind-up
  if (exports.tickWindUp(io, room, bossConfig, now)) return;

  // Advance queue if timer expired
  exports.advanceBossAttackQueue(io, room, bossConfig, phase, deltaMs, now);

  // Column attacks get special handling
  if (bossConfig.columnAttack?.type === b.attackType) {
    exports.tickColumnAttack(io, room, bossConfig, now);
    return;
  }

  // Thread io/roomCode via cfg so pattern functions can emit events (e.g. eruption_fire)
  bossConfig._io       = io;
  bossConfig._roomCode = room.code;

  // Dispatch to pattern function
  const patternFn = PATTERN_MAP[b.attackType];
  if (patternFn) patternFn(room.game, b, char, phase, speed, bossConfig, now);

  bossConfig._io       = null;
  bossConfig._roomCode = null;

  // Tick void-zone detonations (Void Crawler)
  if (room.game._voidZoneDetonates && room.game._voidZoneDetonates.length > 0) {
    const { spawnProjectile } = require("./helpers");
    room.game._voidZoneDetonates = room.game._voidZoneDetonates.filter((vz) => {
      if (now < vz.detonateAt) return true;
      const count = 12 + vz.phase * 4;
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2;
        spawnProjectile(room.game, { x: vz.x, y: vz.y, vx: Math.cos(a) * vz.speed, vy: Math.sin(a) * vz.speed, type: "void_orb", homing: true });
      }
      io.to(room.code).emit("void_zone_explode", { x: vz.x, y: vz.y });
      return false;
    });
  }
};

// ── Homing steering ───────────────────────────────────────────────────────────
exports.steerHomingProjectiles = (game, bossConfig, deltaSeconds) => {
  const turn = bossConfig.orbConfig?.homingTurn ?? 0.035;
  game.projectiles.forEach((p) => {
    if (!p.homing) return;
    const dx = game.character.x - p.x;
    const dy = game.character.y - p.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 5) return;
    const spd = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
    if (spd < 0.01) return;
    p.vx += ((dx / dist) * spd - p.vx) * turn;
    p.vy += ((dy / dist) * spd - p.vy) * turn;
  });
};

// ── Ultimate / special trigger ────────────────────────────────────────────────
exports.maybeFireSpecial = (io, room, bossConfig, phase, now) => {
  const g = room.game;
  if (bossConfig.combatProfile) return; // Ultimate handled by AttackManager at HP threshold
  const special = bossConfig.special;
  if (!special) return;
  if (g.ultimateTriggered) return;
  if (g.bossState !== "attack") return;
  if (g.bossHP > g.bossMaxHP * special.triggerHpPct) return;

  g.ultimateTriggered = true;

  // Fire the special burst immediately (no timer check — one-shot)
  const specialFn = SPECIAL_MAP[special.id];
  if (specialFn) {
    bossConfig._io       = io;
    bossConfig._roomCode = room.code;
    specialFn(g, g.boss, g.character, phase, bossConfig.projSpeed[phase], bossConfig, now);
    bossConfig._io       = null;
    bossConfig._roomCode = null;
  }

  // Then enter the special attack type for its duration
  g.boss.attackTimer = special.durationMs;
  if (special.windUpMs > 0) {
    exports.beginWindUp(io, room, special.attackType, special.windUpMs);
  } else {
    exports.applyAttack(io, room, bossConfig, special.attackType, now);
  }

  io.to(room.code).emit("boss_ultimate_start", {
    specialId: special.id,
    specialName: special.name,
    windUpMs: special.windUpMs,
  });
};
