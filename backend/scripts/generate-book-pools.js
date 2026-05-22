/**
 * Regenerate curated book word pools (optional — pools are hand-tuned in bookWords/).
 * Run: node scripts/generate-book-pools.js
 */
const fs = require("fs");
const path = require("path");

const outDir = path.join(__dirname, "../game/bookWords");
const { NEUTRAL_GOOD_10, NEUTRAL_EVIL_10 } = require("../game/bookWords/neutralPairs");

console.log("Animous Codex neutral pairs (fixed 10+10):");
NEUTRAL_GOOD_10.forEach((g, i) => console.log(`  ${i + 1}. ${g}  |  ${NEUTRAL_EVIL_10[i]}`));
console.log("\nEdit neutralPairs.js, holyVerses.js, demonVerses.js directly to tune content.");
