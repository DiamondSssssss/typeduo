/**
 * Smoke-test every boss: combat profile + legacy attack queue patterns.
 * Run: node scripts/test-all-bosses.js
 */
const { BOSSES } = require("../game/bosses");
const { createInitialGameState } = require("../game/gameState");
const { getAttackManager } = require("../game/combat/AttackManager");
const { getAttack } = require("../game/combat/AttackRegistry");
const { PATTERN_MAP } = require("../game/attackPatterns");
const { tickBossAttacks } = require("../game/bossAI");
const { ensurePatternConfig } = require("../game/combat/patternConfigDefaults");

const io = { to: () => ({ emit: () => {} }) };
const errors = [];

const testPattern = (boss, patternId, g) => {
  const fn = PATTERN_MAP[patternId];
  if (!fn) return { skip: true, reason: "column/special only" };
  ensurePatternConfig(boss, patternId);
  boss._io = io;
  boss._roomCode = "TEST";
  try {
    fn(g, g.boss, g.character, 0, boss.projSpeed[0], boss, Date.now());
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  } finally {
    boss._io = null;
    boss._roomCode = null;
  }
};

const testCombatBoss = (boss) => {
  const g = createInitialGameState(boss, { gameMode: "solo" });
  g.bossState = "attack";
  g.bossHP = Math.floor(g.bossMaxHP * 0.6); // allow ultimate test range
  const room = {
    code: "TST",
    status: "in_game",
    gameMode: "solo",
    selectedBoss: boss.id,
    players: [{ socketId: "s1", username: "t", role: "solo" }],
    game: g,
  };
  const mgr = getAttackManager();
  const attackIds = (boss.combatProfile?.attacks || []).map((a) => a.id);
  if (boss.combatProfile?.ultimate?.id) attackIds.push(boss.combatProfile.ultimate.id);

  for (const id of attackIds) {
    if (!getAttack(id)) {
      errors.push({ boss: boss.id, attack: id, error: "not registered in AttackRegistry" });
      continue;
    }
  }

  for (let tick = 0; tick < 400; tick++) {
    try {
      mgr.tick(io, room, boss, 0, Date.now() + tick * 50, 50);
    } catch (e) {
      errors.push({ boss: boss.id, phase: "combat_tick", tick, error: e.message });
      return;
    }
  }
};

const testLegacyBoss = (boss) => {
  const g = createInitialGameState(boss, { gameMode: "solo" });
  g.bossState = "attack";
  const room = {
    code: "TST",
    status: "in_game",
    selectedBoss: boss.id,
    players: [{ socketId: "s1", username: "t", role: "solo" }],
    game: g,
  };

  const patterns = new Set();
  for (const q of boss.attackQueues || []) {
    for (const p of q) patterns.add(p);
  }

  for (const patternId of patterns) {
    const r = testPattern(boss, patternId, g);
    if (r.skip) continue;
    if (!r.ok) errors.push({ boss: boss.id, attack: patternId, error: r.error });
  }

  for (let tick = 0; tick < 200; tick++) {
    try {
      tickBossAttacks(io, room, boss, 0, Date.now() + tick * 50, 50);
    } catch (e) {
      errors.push({ boss: boss.id, phase: "legacy_tick", tick, error: e.message });
      return;
    }
  }
};

console.log("Testing", Object.keys(BOSSES).length, "bosses...\n");

for (const boss of Object.values(BOSSES)) {
  process.stdout.write(`  ${boss.id} ... `);
  try {
    if (boss.combatProfile) testCombatBoss(boss);
    else testLegacyBoss(boss);
    // Legacy bosses with combat also? rust has both - combatProfile takes precedence in tickBossAttacks
    if (boss.combatProfile && boss.attackQueues?.length) {
      // still test patterns referenced only in legacy queues if any missing from combat
    }
    console.log("ok");
  } catch (e) {
    console.log("FAIL");
    errors.push({ boss: boss.id, phase: "init", error: e.message });
  }
}

if (errors.length) {
  console.log("\n=== ERRORS ===");
  errors.forEach((e) => console.log(JSON.stringify(e)));
  process.exit(1);
}
console.log("\nAll bosses passed.");
