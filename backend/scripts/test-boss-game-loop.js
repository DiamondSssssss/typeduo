/**
 * Full game-loop tick test per boss (~1.2s simulated each).
 * Run: node scripts/test-boss-game-loop.js
 */
const { BOSSES } = require("../game/bosses");
const { createInitialGameState } = require("../game/gameState");
const { startGameLoop, stopLoop } = require("../game/gameLoop");

const io = { to: () => ({ emit: () => {} }) };
const bosses = Object.values(BOSSES);
const errors = [];
let i = 0;

const runNext = () => {
  if (i >= bosses.length) {
    if (errors.length) {
      console.error("LOOP ERRORS:\n" + errors.join("\n"));
      process.exit(1);
    }
    console.log("Game loop OK for", bosses.length, "bosses");
    process.exit(0);
  }

  const boss = bosses[i++];
  const g = createInitialGameState(boss, { gameMode: "solo", difficulty: "normal" });
  const code = `T_${boss.id}`;
  const room = {
    code,
    status: "in_game",
    gameMode: "solo",
    selectedBoss: boss.id,
    difficulty: "normal",
    players: [{ socketId: "sock1", username: "tester", role: "solo" }],
    game: g,
  };
  g.bossState = "attack";
  g.bossHP = Math.floor(g.bossMaxHP * 0.55);
  g.lastTickAt = Date.now() - 50;

  startGameLoop(io, room);

  setTimeout(() => {
    stopLoop(code);
    const recent = Date.now() - g.lastTickAt < 200;
    if (!recent) errors.push(`${boss.id}: lastTickAt stale — loop may have crashed`);
    process.stdout.write(recent ? "." : "X");
    runNext();
  }, 1200);
};

console.log("Testing game loops:");
runNext();
