import Phaser from "phaser";

export const phaserConfig = {
  type: Phaser.AUTO,
  width: 960,
  height: 540,
  backgroundColor: "#0f172a",
  parent: "game-root",
  physics: {
    default: "arcade",
    arcade: {
      debug: false,
    },
  },
};
