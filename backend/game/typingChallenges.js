/**
 * Typing-driven boss mechanics: cancel wind-ups, minions, shield words, pillars, player stun.
 */
const { SHORT_WORDS, MED_WORDS } = require("./words");
const { takeDamage } = require("./helpers");

const _challengePool = [...new Set([...SHORT_WORDS, ...MED_WORDS])].filter(
  (w) => w.length >= 4 && w.length <= 9
);

const pickChallengeWord = (minLen = 4, maxLen = 8) => {
  const pool = _challengePool.filter((w) => w.length >= minLen && w.length <= maxLen);
  const src = pool.length ? pool : _challengePool;
  return src[Math.floor(Math.random() * src.length)];
};

const saveWeaponWord = (g) => {
  if (g._savedWeaponWord) return;
  g._savedWeaponWord = {
    currentWord: g.currentWord,
    typedProgress: g.typedProgress,
    currentWordPhase: g.currentWordPhase,
    wordExpiresAt: g.wordExpiresAt,
  };
};

const restoreWeaponWord = (g) => {
  if (!g._savedWeaponWord) {
    const { refreshWeaponWord } = require("./weaponCombat");
    refreshWeaponWord(g);
    return;
  }
  const s = g._savedWeaponWord;
  g.currentWord = s.currentWord;
  g.typedProgress = s.typedProgress;
  g.currentWordPhase = s.currentWordPhase;
  g.wordExpiresAt = s.wordExpiresAt;
  g._savedWeaponWord = null;
};

const emitChallenge = (io, room, payload) => {
  io.to(room.code).emit("typing_challenge", payload);
};

const setChallengeWord = (io, room, g, kind, word, extra = {}) => {
  saveWeaponWord(g);
  g._challenge = { kind, word, progress: 0, ...extra };
  g.currentWord = word;
  g.typedProgress = 0;
  g.currentWordPhase = "challenge";
  emitChallenge(io, room, {
    active: true,
    kind,
    word,
    progress: 0,
    ...extra,
  });
};

const clearChallenge = (io, room, g, reason) => {
  g._challenge = null;
  restoreWeaponWord(g);
  emitChallenge(io, room, { active: false, reason });
};

/** Overcharge — complete one weapon word before timer ends to cancel (no extra words). */
const startWindupCancel = (io, room, g, { attackId, windUpMs, blastDamage }) => {
  g._windupCancel = {
    attackId,
    expiresAt: Date.now() + windUpMs,
    blastDamage: blastDamage || 35,
  };
  io.to(room.code).emit("overcharge_start", {
    durationMs: windUpMs,
    attackId,
  });
};

const hasActiveWindupCancel = (g) => Boolean(g._windupCancel);

const tryCancelWindupOnWord = (io, room, g) => {
  if (!g._windupCancel) return false;
  return resolveWindupCancel(io, room, g);
};

const reverseStr = (s) => String(s || "").split("").reverse().join("");

/** Mirror — type the reversed copy of your current weapon word. */
const startMirrorWord = (io, room, g) => {
  const source = g.currentWord || pickChallengeWord(4, 7);
  const reversed = reverseStr(source);
  setChallengeWord(io, room, g, "mirror_word", reversed, {
    mirrorSource: source,
  });
  io.to(room.code).emit("mirror_word_start", { source, reversed });
};

/** Chain cancel — complete N weapon words before timer ends (no extra words). */
const startChainCancel = (io, room, g, { chainLength, windUpMs, blastDamage, attackId }) => {
  const required = Math.min(Math.max(chainLength ?? 3, 2), 3);
  g._chainCancel = {
    attackId,
    expiresAt: Date.now() + windUpMs,
    blastDamage: blastDamage || 42,
    required,
    completed: 0,
  };
  io.to(room.code).emit("chain_cancel_start", {
    durationMs: windUpMs,
    attackId,
    chainTotal: required,
  });
};

const hasActiveChainCancel = (g) => Boolean(g._chainCancel);

const tryAdvanceChainOnWord = (io, room, g) => {
  const cc = g._chainCancel;
  if (!cc) return { advanced: false };
  cc.completed += 1;
  io.to(room.code).emit("chain_cancel_progress", {
    completed: cc.completed,
    total: cc.required,
  });
  if (cc.completed >= cc.required) {
    resolveWindupCancel(io, room, g);
    return { advanced: true, completed: true };
  }
  return { advanced: true, completed: false };
};

/** Safe zone — stand in blue zone and type word; success shields zone for map blast. */
const startSafeZoneEvent = (io, room, g, { mapDamage = 45, radius = 95, durationMs = 5000 }) => {
  const char = g.character;
  const x = Math.max(120, Math.min(1160, char.x));
  const y = Math.max(280, Math.min(520, char.y));
  const word = pickChallengeWord(4, 7);
  g._safeZoneEvent = {
    x, y, radius,
    word,
    mapDamage,
    expiresAt: Date.now() + durationMs,
    phase: "typing",
    shieldUntil: 0,
  };
  setChallengeWord(io, room, g, "safe_zone", word, { zoneX: x, zoneY: y, radius });
  io.to(room.code).emit("safe_zone_start", { x, y, radius, word, durationMs });
};

const charInZone = (g, zone) => {
  const dx = g.character.x - zone.x;
  const dy = g.character.y - zone.y;
  return dx * dx + dy * dy <= zone.radius * zone.radius;
};

const fireMapBlast = (io, room, g, damage) => {
  const ev = g._safeZoneEvent;
  const safe = ev && ev.phase === "shielded" && charInZone(g, ev);
  if (!safe) {
    takeDamage(io, room, damage, g.character.x, g.character.y);
  }
  io.to(room.code).emit("map_blast", { damage: safe ? 0 : damage, safe });
  if (ev) g._safeZoneEvent = null;
};

const resolveSafeZoneSuccess = (io, room, g) => {
  const ev = g._safeZoneEvent;
  if (!ev || !charInZone(g, ev)) {
    fireMapBlast(io, room, g, ev?.mapDamage || 45);
    clearChallenge(io, room, g, "safe_zone_failed");
    return;
  }
  ev.phase = "shielded";
  ev.shieldUntil = Date.now() + 2800;
  ev.blastAt = Date.now() + 1600;
  restoreWeaponWord(g);
  g._challenge = null;
  emitChallenge(io, room, { active: false, reason: "safe_zone_shielded" });
  io.to(room.code).emit("safe_zone_shield", {
    x: ev.x, y: ev.y, radius: ev.radius, blastInMs: 1600,
  });
};

/** Typo streak → AoE (Feedback Leech enrage, etc.). */
const trackTypoBomb = (io, room, bossConfig, g) => {
  const cfg = bossConfig.typoBomb;
  if (!cfg) return;
  g.consecutiveTypos = (g.consecutiveTypos || 0) + 1;
  if (g.consecutiveTypos >= (cfg.threshold || 4)) {
    g.consecutiveTypos = 0;
    const dmg = cfg.damage || 28;
    takeDamage(io, room, dmg, g.character.x, g.character.y);
    io.to(room.code).emit("typo_bomb", { damage: dmg, threshold: cfg.threshold });
  }
};

const resetTypoStreak = (g) => {
  g.consecutiveTypos = 0;
};

/** Cancel active combat attack (overcharge / chain interrupted). */
const resolveWindupCancel = (io, room, g) => {
  const wc = g._windupCancel;
  const cc = g._chainCancel;
  if (!wc && !cc) return false;
  const attackId = wc?.attackId || cc?.attackId;
  g._windupCancel = null;
  g._chainCancel = null;
  const combat = g._combat;
  if (combat) {
    combat.state = "idle";
    combat.currentId = null;
    combat.data = {};
  }
  g.boss.windingUp = false;
  g.boss.windUpAttack = null;
  g.boss.windUpUntil = 0;
  g.bossInvulnUntil = 0;
  g.boss.combatLockMove = false;
  g.boss.nextMoveAt = Date.now();
  io.to(room.code).emit("overcharge_cancelled", { attackId });
  io.to(room.code).emit("boss_windup_cancel");
  return true;
};

const fireOvercharge = (io, room, g) => {
  const wc = g._windupCancel;
  const cc = g._chainCancel;
  if (!wc && !cc) return;
  const dmg = wc?.blastDamage || cc?.blastDamage || 35;
  g._windupCancel = null;
  g._chainCancel = null;
  takeDamage(io, room, dmg, g.character.x, g.character.y);
  io.to(room.code).emit("overcharge_hit", { damage: dmg });
  io.to(room.code).emit("boss_windup_cancel");
};

/** Shield-only typing: words chip shield until broken. */
const startShieldWord = (io, room, g, { shieldAmount, word }) => {
  g.bossShield = shieldAmount;
  g.bossShieldMax = shieldAmount;
  g.shieldInitialized = true;
  g._shieldWordMode = true;
  const w = word || pickChallengeWord(6, 9);
  setChallengeWord(io, room, g, "shield_break", w, { shieldPerChar: Math.ceil(shieldAmount / w.length) });
  io.to(room.code).emit("shield_word_start", { word: w, shield: shieldAmount });
};

const chipShieldFromChallenge = (g, amount) => {
  if (!g._shieldWordMode) return;
  g.bossShield = Math.max(0, (g.bossShield || 0) - amount);
  if (g.bossShield <= 0) {
    g._shieldWordMode = false;
  }
};

const rollSpawnCount = (max = 2) => 1 + Math.floor(Math.random() * Math.min(max, 2));

const hasActiveMinions = (g) => (g._typableMinions || []).some((m) => !m.killed);
const hasActivePillars = (g) =>
  (g._typablePillars || []).some((p) => !p.destroyed && !p.fired);

/** Minions on field — each completed weapon word kills one (no separate minion words). */
const spawnTypableMinions = (io, room, g, { count } = {}) => {
  const n = Math.min(count ?? rollSpawnCount(2), 2);
  g._typableMinions = [];
  const char = g.character;
  for (let i = 0; i < n; i++) {
    const angle = (i / Math.max(1, n)) * Math.PI * 2 + Math.random() * 0.4;
    const dist = 100 + Math.random() * 70;
    g._typableMinions.push({
      id: `m_${Date.now()}_${i}`,
      x: Math.max(80, Math.min(1200, char.x + Math.cos(angle) * dist)),
      y: Math.max(120, Math.min(650, char.y + Math.sin(angle) * dist * 0.5)),
    });
  }
  io.to(room.code).emit("typable_minions_spawn", {
    minions: g._typableMinions.map(({ id, x, y }) => ({ id, x, y })),
    count: n,
  });
};

/** Kill one minion when player completes their weapon word. Returns true if a minion was killed. */
const tryKillMinionOnWord = (io, room, g) => {
  const alive = (g._typableMinions || []).filter((m) => !m.killed);
  if (!alive.length) return false;

  let target = alive[0];
  let bestDist = Infinity;
  for (const m of alive) {
    const dx = g.character.x - m.x;
    const dy = g.character.y - m.y;
    const d = dx * dx + dy * dy;
    if (d < bestDist) {
      bestDist = d;
      target = m;
    }
  }
  target.killed = true;
  g._typableMinions = g._typableMinions.filter((m) => !m.killed);
  io.to(room.code).emit("typable_minion_killed", { id: target.id, x: target.x, y: target.y });
  if (!g._typableMinions.length) {
    io.to(room.code).emit("typable_minions_cleared");
  }
  return true;
};

/** Pillars on field — each completed weapon word destroys one (no separate pillar words). */
const spawnTypablePillars = (io, room, g, { count, warnMs = 5500 } = {}) => {
  const now = Date.now();
  const n = Math.min(count ?? rollSpawnCount(2), 2);
  g._typablePillars = [];
  for (let i = 0; i < n; i++) {
    g._typablePillars.push({
      id: `p_${now}_${i}`,
      x: 160 + Math.random() * 920,
      warnUntil: now + warnMs,
      fired: false,
      destroyed: false,
    });
  }
  io.to(room.code).emit("typable_pillars_spawn", {
    pillars: g._typablePillars.map(({ id, x, warnUntil }) => ({
      id,
      x,
      warnMs: warnUntil - now,
    })),
    count: n,
  });
};

/** Destroy one pillar when player completes their weapon word. */
const tryDestroyPillarOnWord = (io, room, g) => {
  const p = (g._typablePillars || []).find((x) => !x.destroyed && !x.fired);
  if (!p) return false;
  p.destroyed = true;
  io.to(room.code).emit("typable_pillar_destroyed", { id: p.id, x: p.x });
  g._typablePillars = g._typablePillars.filter((x) => !x.destroyed);
  if (!g._typablePillars.length) {
    io.to(room.code).emit("typable_pillars_cleared");
  }
  return true;
};

/** Paralyze — runner frozen; typer breaks free by completing their weapon word. */
const startPlayerStun = (io, room, g, { durationMs = 9000 }) => {
  const until = Date.now() + durationMs;
  g._playerStun = { active: true, until };
  g.moveSpeedMult = 0;
  io.to(room.code).emit("player_stun_start", { durationMs, until });
};

const isPlayerStunned = (g) => Boolean(g._playerStun?.active);

const tryClearParalyzeOnWord = (io, room, g) => {
  if (!isPlayerStunned(g)) return false;
  clearPlayerStun(io, room, g);
  return true;
};

const clearPlayerStun = (io, room, g) => {
  g._playerStun = null;
  g.moveSpeedMult = 1;
  io.to(room.code).emit("player_stun_cleared");
};

/** Feedback Leech typo → heal boss; enrage also damages player. */
const applyTypoBossEffect = (io, room, bossConfig, g) => {
  const hpPct = g.bossHP / Math.max(1, g.bossMaxHP);
  const enragePct = bossConfig.typoEnrage?.hpPct ?? 0.25;
  const enraged = bossConfig.typoEnrage && hpPct <= enragePct;

  trackTypoBomb(io, room, bossConfig, g);

  if (bossConfig.typoFeed) {
    const heal = enraged
      ? (bossConfig.typoEnrage.heal ?? bossConfig.typoFeed.heal)
      : bossConfig.typoFeed.heal;
    const before = g.bossHP;
    g.bossHP = Math.min(g.bossMaxHP, g.bossHP + heal);
    io.to(room.code).emit("typo_feed", {
      heal: g.bossHP - before,
      bossHP: g.bossHP,
      enraged,
    });
  }

  if (enraged && bossConfig.typoEnrage?.damage) {
    const dmg = bossConfig.typoEnrage.damage;
    takeDamage(io, room, dmg, g.character.x, g.character.y);
    io.to(room.code).emit("typo_backlash", { damage: dmg });
  }
};

/**
 * Process one keystroke when a typing challenge is active.
 * @returns {{ handled: boolean, completed?: boolean }}
 */
const processChallengeInput = (io, room, player, input) => {
  const g = room.game;
  const c = g._challenge;
  if (!c) return { handled: false };

  const expected = c.word[c.progress];
  if (input !== expected) {
    c.progress = input === c.word[0] ? 1 : 0;
    emitChallenge(io, room, {
      active: true,
      kind: c.kind,
      word: c.word,
      progress: c.progress,
      typo: true,
    });
    return { handled: true };
  }

  c.progress += 1;
  g.typedProgress = c.progress;

  if (c.progress < c.word.length) {
    emitChallenge(io, room, {
      active: true,
      kind: c.kind,
      word: c.word,
      progress: c.progress,
    });
    return { handled: true };
  }

  // Challenge word completed
  switch (c.kind) {
    case "mirror_word":
      clearChallenge(io, room, g, "mirror_done");
      io.to(room.code).emit("mirror_word_cleared");
      break;
    case "safe_zone":
      resolveSafeZoneSuccess(io, room, g);
      break;
    case "shield_break":
      g.bossShield = 0;
      g._shieldWordMode = false;
      clearChallenge(io, room, g, "shield_broken");
      io.to(room.code).emit("shield_word_broken");
      break;
    default:
      clearChallenge(io, room, g, "done");
  }

  io.to(room.code).emit("typing_progress", {
    currentWord: g.currentWord,
    typedProgress: g.typedProgress,
    weaponStreak: g.weaponStreak || 0,
    wordExpiresAt: g.wordExpiresAt || 0,
    weaponTypeId: g.weapon?.typeId,
    challengeKind: g._challenge?.kind || null,
  });

  return { handled: true, completed: true };
};

/** Tick expiring challenges (overcharge, pillars, player stun). */
const tickTypingChallenges = (io, room, now) => {
  const g = room.game;
  if (!g) return;
  const c = g._challenge;

  if (g._windupCancel?.expiresAt && now >= g._windupCancel.expiresAt) {
    fireOvercharge(io, room, g);
  }
  if (g._chainCancel?.expiresAt && now >= g._chainCancel.expiresAt) {
    fireOvercharge(io, room, g);
  }

  if (c?.kind === "safe_zone" && g._safeZoneEvent?.expiresAt && now >= g._safeZoneEvent.expiresAt) {
    fireMapBlast(io, room, g, g._safeZoneEvent.mapDamage || 45);
    clearChallenge(io, room, g, "safe_zone_timeout");
  }

  const ev = g._safeZoneEvent;
  if (ev?.phase === "shielded" && ev.blastAt && now >= ev.blastAt) {
    fireMapBlast(io, room, g, ev.mapDamage || 45);
  }

  if (g._playerStun?.active && now >= g._playerStun.until) {
    clearPlayerStun(io, room, g);
  }

  (g._typablePillars || []).forEach((p) => {
    if (p.destroyed || p.fired || now < p.warnUntil) return;
    p.fired = true;
    const halfW = 70;
    if (Math.abs(g.character.x - p.x) < halfW) {
      takeDamage(io, room, 22, p.x, g.character.y);
    }
    io.to(room.code).emit("typable_pillar_fire", { id: p.id, x: p.x });
  });
};

/** Skip boss HP damage while breaking shield via challenge mode. */
module.exports = {
  pickChallengeWord,
  startWindupCancel,
  hasActiveWindupCancel,
  tryCancelWindupOnWord,
  startChainCancel,
  hasActiveChainCancel,
  tryAdvanceChainOnWord,
  startMirrorWord,
  startSafeZoneEvent,
  resolveWindupCancel,
  fireOvercharge,
  fireMapBlast,
  startShieldWord,
  spawnTypableMinions,
  tryKillMinionOnWord,
  hasActiveMinions,
  spawnTypablePillars,
  tryDestroyPillarOnWord,
  hasActivePillars,
  startPlayerStun,
  isPlayerStunned,
  tryClearParalyzeOnWord,
  clearPlayerStun,
  applyTypoBossEffect,
  trackTypoBomb,
  resetTypoStreak,
  processChallengeInput,
  tickTypingChallenges,
  clearChallenge,
};
