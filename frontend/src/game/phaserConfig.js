import Phaser from "phaser";

export const phaserConfig = {
  type: Phaser.AUTO,
  width: 1280,
  height: 720,
  backgroundColor: "#0f172a",
  parent: "game-root",
  physics: {
    default: "arcade",
    arcade: {
      debug: false,
    },
  },
};
