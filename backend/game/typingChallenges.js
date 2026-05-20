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

/** Start typable wind-up cancel (type word before expiresAt or boss fires). */
const startWindupCancel = (io, room, g, { attackId, windUpMs, blastDamage, word }) => {
  const w = word || pickChallengeWord(5, 8);
  setChallengeWord(io, room, g, "windup_cancel", w, {
    attackId,
    expiresAt: Date.now() + windUpMs,
    blastDamage: blastDamage || 35,
  });
  io.to(room.code).emit("overcharge_start", {
    word: w,
    durationMs: windUpMs,
    attackId,
  });
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

/** Chain cancel — 2–3 short words in one wind-up window. */
const startChainCancel = (io, room, g, { words, windUpMs, blastDamage, attackId }) => {
  const chain = words || [
    pickChallengeWord(3, 5),
    pickChallengeWord(3, 5),
    pickChallengeWord(3, 5),
  ];
  saveWeaponWord(g);
  g._challenge = {
    kind: "chain_cancel",
    words: chain,
    wordIndex: 0,
    word: chain[0],
    progress: 0,
    attackId,
    expiresAt: Date.now() + windUpMs,
    blastDamage: blastDamage || 42,
  };
  g.currentWord = chain[0];
  g.typedProgress = 0;
  emitChallenge(io, room, {
    active: true,
    kind: "chain_cancel",
    word: chain[0],
    progress: 0,
    chainIndex: 0,
    chainTotal: chain.length,
  });
  io.to(room.code).emit("chain_cancel_start", {
    words: chain,
    durationMs: windUpMs,
    attackId,
  });
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

/** Cancel active combat attack (overcharge interrupted). */
const resolveWindupCancel = (io, room, g) => {
  const c = g._challenge;
  if (!c || (c.kind !== "windup_cancel" && c.kind !== "chain_cancel")) return false;
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
  clearChallenge(io, room, g, "cancelled");
  io.to(room.code).emit("overcharge_cancelled", { attackId: c.attackId });
  io.to(room.code).emit("boss_windup_cancel");
  return true;
};

const fireOvercharge = (io, room, g) => {
  const c = g._challenge;
  if (!c || (c.kind !== "windup_cancel" && c.kind !== "chain_cancel")) return;
  const dmg = c.blastDamage || 35;
  clearChallenge(io, room, g, "fired");
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

/** Typable minions — weapon word targets active minion until killed. */
const spawnTypableMinions = (io, room, g, { count = 3, wordLen = [4, 6] }) => {
  g._typableMinions = [];
  const char = g.character;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
    const dist = 120 + Math.random() * 80;
    g._typableMinions.push({
      id: `m_${Date.now()}_${i}`,
      x: Math.max(80, Math.min(1200, char.x + Math.cos(angle) * dist)),
      y: Math.max(120, Math.min(650, char.y + Math.sin(angle) * dist * 0.5)),
      word: pickChallengeWord(wordLen[0], wordLen[1]),
      hp: 1,
    });
  }
  g._activeMinionId = g._typableMinions[0]?.id || null;
  syncMinionWord(io, room, g);
  io.to(room.code).emit("typable_minions_spawn", {
    minions: g._typableMinions.map(({ id, x, y, word }) => ({ id, x, y, word })),
  });
};

const syncMinionWord = (io, room, g) => {
  const m = g._typableMinions?.find((x) => x.id === g._activeMinionId);
  if (!m) {
    g._activeMinionId = null;
    if (g._challenge?.kind === "minion") clearChallenge(io, room, g, "cleared");
    else restoreWeaponWord(g);
    return;
  }
  saveWeaponWord(g);
  g._challenge = { kind: "minion", minionId: m.id, word: m.word, progress: 0 };
  g.currentWord = m.word;
  g.typedProgress = 0;
  g.currentWordPhase = "minion";
  emitChallenge(io, room, {
    active: true,
    kind: "minion",
    word: m.word,
    progress: 0,
    minionId: m.id,
  });
};

const killActiveMinion = (io, room, g) => {
  const id = g._activeMinionId;
  if (!id) return false;
  g._typableMinions = (g._typableMinions || []).filter((m) => m.id !== id);
  io.to(room.code).emit("typable_minion_killed", { id });
  g._activeMinionId = g._typableMinions[0]?.id || null;
  if (g._activeMinionId) syncMinionWord(io, room, g);
  else {
    g._challenge = null;
    restoreWeaponWord(g);
    emitChallenge(io, room, { active: false, reason: "minions_cleared" });
  }
  return true;
};

/** Pillars that must be typed before they fire. */
const spawnTypablePillars = (io, room, g, { count = 2, warnMs = 4500 }) => {
  const now = Date.now();
  g._typablePillars = [];
  for (let i = 0; i < count; i++) {
    g._typablePillars.push({
      id: `p_${now}_${i}`,
      x: 180 + Math.random() * 920,
      word: pickChallengeWord(4, 7),
      progress: 0,
      warnUntil: now + warnMs,
      fired: false,
    });
  }
  const active = g._typablePillars[0];
  if (active) {
    setChallengeWord(io, room, g, "pillar", active.word, { pillarId: active.id });
  }
  io.to(room.code).emit("typable_pillars_spawn", {
    pillars: g._typablePillars.map(({ id, x, word, warnUntil }) => ({
      id, x, word, warnMs: warnUntil - now,
    })),
  });
};

const destroyPillar = (io, room, g, pillarId) => {
  const p = g._typablePillars?.find((x) => x.id === pillarId);
  if (!p) return false;
  p.destroyed = true;
  io.to(room.code).emit("typable_pillar_destroyed", { id: pillarId, x: p.x });
  g._typablePillars = g._typablePillars.filter((x) => !x.destroyed);
  const next = g._typablePillars[0];
  if (next) setChallengeWord(io, room, g, "pillar", next.word, { pillarId: next.id });
  else clearChallenge(io, room, g, "pillars_cleared");
  return true;
};

/** Player must type escape word to move again. */
const startPlayerStun = (io, room, g, { durationMs = 3500, word }) => {
  const w = word || pickChallengeWord(4, 6);
  g._playerStun = { active: true, word: w, progress: 0, until: Date.now() + durationMs };
  g.moveSpeedMult = 0;
  setChallengeWord(io, room, g, "player_stun", w, { until: g._playerStun.until });
  io.to(room.code).emit("player_stun_start", { word: w, durationMs });
};

const clearPlayerStun = (io, room, g) => {
  g._playerStun = null;
  g.moveSpeedMult = 1;
  clearChallenge(io, room, g, "stun_cleared");
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
    case "chain_cancel": {
      if (c.wordIndex < c.words.length - 1) {
        c.wordIndex += 1;
        c.word = c.words[c.wordIndex];
        c.progress = 0;
        g.currentWord = c.word;
        g.typedProgress = 0;
        emitChallenge(io, room, {
          active: true,
          kind: "chain_cancel",
          word: c.word,
          progress: 0,
          chainIndex: c.wordIndex,
          chainTotal: c.words.length,
        });
        io.to(room.code).emit("chain_cancel_step", {
          chainIndex: c.wordIndex,
          word: c.word,
        });
        break;
      }
      resolveWindupCancel(io, room, g);
      break;
    }
    case "mirror_word":
      clearChallenge(io, room, g, "mirror_done");
      io.to(room.code).emit("mirror_word_cleared");
      break;
    case "safe_zone":
      resolveSafeZoneSuccess(io, room, g);
      break;
    case "windup_cancel":
      resolveWindupCancel(io, room, g);
      break;
    case "shield_break":
      g.bossShield = 0;
      g._shieldWordMode = false;
      clearChallenge(io, room, g, "shield_broken");
      io.to(room.code).emit("shield_word_broken");
      break;
    case "minion":
      killActiveMinion(io, room, g);
      break;
    case "pillar":
      destroyPillar(io, room, g, c.pillarId);
      break;
    case "player_stun":
      clearPlayerStun(io, room, g);
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
  if ((c?.kind === "windup_cancel" || c?.kind === "chain_cancel") && c.expiresAt && now >= c.expiresAt) {
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
  startChainCancel,
  startMirrorWord,
  startSafeZoneEvent,
  resolveWindupCancel,
  fireOvercharge,
  fireMapBlast,
  startShieldWord,
  spawnTypableMinions,
  killActiveMinion,
  spawnTypablePillars,
  startPlayerStun,
  applyTypoBossEffect,
  trackTypoBomb,
  resetTypoStreak,
  processChallengeInput,
  tickTypingChallenges,
  clearChallenge,
};
