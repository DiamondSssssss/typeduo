/**
 * Static validation of boss configs.
 * Run: node scripts/validate-boss-configs.js
 */
const { BOSSES } = require("../game/bosses");
const { PATTERN_MAP, SPECIAL_MAP } = require("../game/attackPatterns");
const { PATTERNS: NEW_PATTERNS, SPECIALS: NEW_SPECIALS } = require("../game/newBossPatterns");
const { getAttack } = require("../game/combat/AttackRegistry");

const ALL_PATTERNS = { ...PATTERN_MAP, ...NEW_PATTERNS };
const ALL_SPECIALS = { ...SPECIAL_MAP, ...NEW_SPECIALS };
const COLUMN_TYPES = new Set([
  "laser", "lightning_bolt", "fire_pillar", "freeze_ray",
  "scrap_beam", "royal_lance", "time_slice",
]);

const issues = [];

for (const boss of Object.values(BOSSES)) {
  const attacks = new Set();
  for (const q of boss.attackQueues || []) {
    for (const a of q) attacks.add(a);
  }

  for (const id of attacks) {
    if (COLUMN_TYPES.has(id)) {
      if (boss.columnAttack?.type !== id) {
        issues.push(`${boss.id}: queue has column "${id}" but columnAttack.type is "${boss.columnAttack?.type}"`);
      }
      if (!boss.columnAttack?.warnMs) {
        issues.push(`${boss.id}: column "${id}" missing columnAttack config`);
      }
    } else if (!ALL_PATTERNS[id] && !getAttack(id)) {
      issues.push(`${boss.id}: unknown attack "${id}" (not in PATTERN_MAP or AttackRegistry)`);
    }
    if (!boss.combatProfile && boss.attackDurations && boss.attackDurations[id] == null) {
      issues.push(`${boss.id}: missing attackDurations for "${id}"`);
    }
    const ONE_SHOT = new Set(["circle", "shockwave", "magnet_pull", "void_zone", "eruption", "slow_field", "toxic_pool"]);
    if (!boss.combatProfile && boss.fireIntervals) {
      const fi = boss.fireIntervals[id];
      if (fi == null && !COLUMN_TYPES.has(id) && !ONE_SHOT.has(id)) {
        const prefix = id.split("_")[0];
        const hasRelated = Object.keys(boss.fireIntervals).some((k) => k.startsWith(id) || k.startsWith(prefix));
        if (!hasRelated) issues.push(`${boss.id}: missing fireIntervals for "${id}"`);
      }
    }
  }

  if (boss.combatProfile?.attacks) {
    for (const entry of boss.combatProfile.attacks) {
      if (!getAttack(entry.id)) {
        issues.push(`${boss.id}: combatProfile attack "${entry.id}" not registered`);
      }
    }
    const ult = boss.combatProfile.ultimate;
    if (ult?.id && !getAttack(ult.id)) {
      issues.push(`${boss.id}: ultimate "${ult.id}" not registered`);
    }
  }

  if (boss.special?.id && !ALL_SPECIALS[boss.special.id]) {
    issues.push(`${boss.id}: special "${boss.special.id}" not in SPECIAL_MAP`);
  }

  if (!boss.maxHP || boss.maxHP < 1) issues.push(`${boss.id}: invalid maxHP`);
  if (!boss.moveSpeed?.length) issues.push(`${boss.id}: missing moveSpeed`);
  if (!boss.projSpeed?.length) issues.push(`${boss.id}: missing projSpeed`);
}

if (issues.length) {
  console.log("CONFIG ISSUES:\n");
  issues.forEach((i) => console.log(" -", i));
  process.exit(1);
}
console.log("All boss configs valid (" + Object.keys(BOSSES).length + " bosses).");
