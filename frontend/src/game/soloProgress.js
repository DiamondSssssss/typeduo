import { BOSS_LIST } from "./bosses/bossConfigs";

/** Real solo bosses in unlock order (training dummy excluded). */
export const SOLO_BOSS_PROGRESSION = BOSS_LIST.filter(
  (b) => !b.trainingMode && !b.comingSoon,
).map((b) => b.id);

const TRAINING_DUMMY_ID = "training_dummy";
const STORAGE_PREFIX = "typeduo_solo_defeated_";

function storageKey(username) {
  const key = (username || "guest").trim().toLowerCase();
  return `${STORAGE_PREFIX}${key}`;
}

export function readSoloDefeatedBossIds(username) {
  try {
    const raw = localStorage.getItem(storageKey(username));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id) => typeof id === "string" && SOLO_BOSS_PROGRESSION.includes(id));
  } catch {
    return [];
  }
}

export function writeSoloDefeatedBossIds(username, defeatedIds) {
  const unique = [...new Set(defeatedIds.filter((id) => SOLO_BOSS_PROGRESSION.includes(id)))];
  try {
    localStorage.setItem(storageKey(username), JSON.stringify(unique));
  } catch {
    /* ignore quota / private mode */
  }
  return unique;
}

export function isSoloBossUnlocked(bossId, defeatedIds) {
  if (bossId === TRAINING_DUMMY_ID) return true;
  const idx = SOLO_BOSS_PROGRESSION.indexOf(bossId);
  if (idx < 0) return false;
  if (idx === 0) return true;
  return defeatedIds.includes(SOLO_BOSS_PROGRESSION[idx - 1]);
}

export function getSoloUnlockedBossIds(defeatedIds) {
  const unlocked = new Set([TRAINING_DUMMY_ID]);
  SOLO_BOSS_PROGRESSION.forEach((id, idx) => {
    if (idx === 0 || defeatedIds.includes(SOLO_BOSS_PROGRESSION[idx - 1])) {
      unlocked.add(id);
    }
  });
  return unlocked;
}

export function getSoloLockedBossIds(defeatedIds) {
  const unlocked = getSoloUnlockedBossIds(defeatedIds);
  return BOSS_LIST.filter((b) => !b.comingSoon && !unlocked.has(b.id)).map((b) => b.id);
}

/** Record a solo victory and unlock the next boss in the chain. */
export function recordSoloBossDefeat(bossId, username) {
  if (!SOLO_BOSS_PROGRESSION.includes(bossId)) return readSoloDefeatedBossIds(username);
  const defeated = readSoloDefeatedBossIds(username);
  if (defeated.includes(bossId)) return defeated;
  return writeSoloDefeatedBossIds(username, [...defeated, bossId]);
}

export function getNextSoloBossId(bossId) {
  const idx = SOLO_BOSS_PROGRESSION.indexOf(bossId);
  if (idx < 0 || idx >= SOLO_BOSS_PROGRESSION.length - 1) return null;
  return SOLO_BOSS_PROGRESSION[idx + 1];
}
