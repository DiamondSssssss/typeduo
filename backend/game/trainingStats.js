/** Live training metrics (DPS, WPM) — excludes paused time. */
const getBattleElapsedMs = (g) => {
  const anchor = g.battleStartedAt || g.startedAt || Date.now();
  let paused = g.totalPausedMs || 0;
  if (g.paused && g.pauseStartedAt) paused += Date.now() - g.pauseStartedAt;
  return Math.max(0, Date.now() - anchor - paused);
};

const buildTrainingStats = (g, room) => {
  const elapsedMs = getBattleElapsedMs(g);
  const elapsedSec = elapsedMs / 1000;
  const minutes = elapsedMs / 60000;
  const typer = room.players.find((p) => p.role === "typer" || p.role === "solo") || room.players[0];
  const totalDamage = g.trainingDamageTotal ?? typer?.damageDealt ?? 0;
  const wordsTyped = typer?.wordsTyped ?? g.totalWordsTyped ?? 0;
  return {
    elapsedMs,
    totalDamage,
    wordsTyped,
    dps: elapsedSec >= 0.5 ? Math.round((totalDamage / elapsedSec) * 10) / 10 : 0,
    wpm: minutes >= 1 / 120 ? Math.round(wordsTyped / minutes) : 0,
  };
};

module.exports = { getBattleElapsedMs, buildTrainingStats };
