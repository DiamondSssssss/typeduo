/** Solo boss unlock order — keep in sync with frontend BOSS_LIST progression. */
const SOLO_BOSS_PROGRESSION = [
  "iron_matron",
  "rust_golem",
  "watcher",
  "storm_drake",
  "inferno",
  "plague_herald",
  "phantom_reaper",
  "void_crawler",
  "glacier",
  "chronarch",
  "leviathan",
  "cinder_maw",
  "sovereign",
  "void_serpent",
  "the_glitch",
  "feedback_leech",
  "abyss_warden",
  "cataclysm_engine",
  "oblivion_herald",
  "omega_null",
];

const TRAINING_DUMMY_ID = "training_dummy";

const normalizeDefeated = (defeatedBossIds) => {
  if (!Array.isArray(defeatedBossIds)) return [];
  return [...new Set(
    defeatedBossIds.filter((id) => typeof id === "string" && SOLO_BOSS_PROGRESSION.includes(id)),
  )];
};

const isSoloBossUnlocked = (bossId, defeatedBossIds) => {
  if (bossId === TRAINING_DUMMY_ID) return true;
  const idx = SOLO_BOSS_PROGRESSION.indexOf(bossId);
  if (idx < 0) return false;
  if (idx === 0) return true;
  return defeatedBossIds.includes(SOLO_BOSS_PROGRESSION[idx - 1]);
};

const assertSoloBossAllowed = (bossId, defeatedBossIds) => {
  const defeated = normalizeDefeated(defeatedBossIds);
  if (isSoloBossUnlocked(bossId, defeated)) return { ok: true, defeatedBossIds: defeated };
  const idx = SOLO_BOSS_PROGRESSION.indexOf(bossId);
  const required = idx > 0 ? SOLO_BOSS_PROGRESSION[idx - 1] : null;
  return {
    ok: false,
    message: required
      ? `Defeat the previous boss first to unlock this fight.`
      : "This boss is not available in solo mode.",
  };
};

module.exports = {
  SOLO_BOSS_PROGRESSION,
  TRAINING_DUMMY_ID,
  normalizeDefeated,
  isSoloBossUnlocked,
  assertSoloBossAllowed,
};
