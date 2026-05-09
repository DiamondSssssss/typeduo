import Phaser from "phaser";

export default class MainScene extends Phaser.Scene {
  constructor() {
    super("MainScene");
    this.playerSprites = new Map();
    this.playerTargets = new Map();
    this.projectileSprites = new Map();
    this.lastSentAt = 0;
    this.roarCountdownTimer = null;
  }

  init(data) {
    this.socket = data.socket;
    this.gamePayload = data.gamePayload;
  }

  create() {
    this.add.text(16, 12, "Step 4: Typing + Boss Attacks", {
      fontSize: "20px",
      color: "#ffffff",
    });

    this.add.rectangle(480, 60, 140, 60, 0x8b1e3f).setStrokeStyle(2, 0xffffff);
    this.add.text(450, 50, "BOSS", { fontSize: "18px", color: "#ffffff" });

    const players = this.gamePayload?.players || [];
    this.localSocketId = this.socket?.id;
    this.localPlayer = players.find((p) => p.socketId === this.localSocketId);
    this.roomCode = this.gamePayload?.roomCode;
    this.isRunner = this.localPlayer?.role === "runner";

    players.forEach((player) => {
      const color = player.role === "runner" ? 0x22c55e : 0x3b82f6;
      const sprite = this.add.rectangle(player.x || 480, player.y || 430, 32, 32, color);
      const label = this.add
        .text((player.x || 480) - 35, (player.y || 430) - 28, player.username, {
          fontSize: "12px",
          color: "#ffffff",
        })
        .setData("socketId", player.socketId);

      this.playerSprites.set(player.socketId, { sprite, label, role: player.role });
      this.playerTargets.set(player.socketId, {
        x: sprite.x,
        y: sprite.y,
      });
    });

    this.roleText = this.add.text(
      16,
      40,
      this.isRunner ? "Role: Runner (WASD)" : "Role: Typer (movement disabled)",
      { fontSize: "16px", color: "#e2e8f0" }
    );
    this.hpText = this.add.text(16, 64, "Shared HP: 100 | Boss HP: 100", {
      fontSize: "16px",
      color: "#fde68a",
    });
    this.wordText = this.add.text(16, 88, "Word: -", {
      fontSize: "16px",
      color: "#c4b5fd",
    });
    this.stateText = this.add.text(16, 112, "Boss State: attack", {
      fontSize: "16px",
      color: "#fca5a5",
    });
    this.overlayText = this.add
      .text(480, 270, "", {
        fontSize: "48px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(50)
      .setVisible(false);

    this.keys = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    });

    this.handlePlayerMoved = ({ socketId, x, y }) => {
      this.playerTargets.set(socketId, { x, y });
    };
    this.handleGameState = (state) => {
      this.hpText.setText(`Shared HP: ${state.sharedHP} | Boss HP: ${state.bossHP}`);
      this.stateText.setText(`Boss State: ${state.bossState}`);

      const typed = state.currentWord.slice(0, state.typedProgress);
      const rest = state.currentWord.slice(state.typedProgress);
      this.wordText.setText(`Word: [${typed}]${rest}`);

      state.players.forEach((player) => {
        this.playerTargets.set(player.socketId, { x: player.x, y: player.y });
        if (player.socketId === this.localSocketId) {
          this.isRunner = player.role === "runner";
          this.roleText.setText(
            this.isRunner ? "Role: Runner (WASD)" : "Role: Typer (movement disabled)"
          );
        }
      });

      const activeIds = new Set();
      state.projectiles.forEach((projectile) => {
        activeIds.add(projectile.id);
        let sprite = this.projectileSprites.get(projectile.id);
        if (!sprite) {
          sprite = this.add.circle(projectile.x, projectile.y, 6, 0xf97316);
          this.projectileSprites.set(projectile.id, sprite);
        }
        sprite.x = projectile.x;
        sprite.y = projectile.y;
      });

      this.projectileSprites.forEach((sprite, id) => {
        if (!activeIds.has(id)) {
          sprite.destroy();
          this.projectileSprites.delete(id);
        }
      });
    };

    this.handleTypingProgress = ({ currentWord, typedProgress }) => {
      const typed = currentWord.slice(0, typedProgress);
      const rest = currentWord.slice(typedProgress);
      this.wordText.setText(`Word: [${typed}]${rest}`);
    };

    this.handleWordCompleted = ({ by, word, damage }) => {
      const flash = this.add.text(420, 120, `${by} typed "${word}" (-${damage})`, {
        fontSize: "16px",
        color: "#86efac",
      });
      this.time.delayedCall(600, () => flash.destroy());
    };

    this.handleRoarStart = ({ countdownMs }) => {
      this.cameras.main.shake(600, 0.01);

      const totalSeconds = Math.max(1, Math.ceil((countdownMs || 3000) / 1000));
      let remaining = totalSeconds;
      this.overlayText.setVisible(true);
      this.overlayText.setText(`ROAR!\nSWAP IN ${remaining}`);

      if (this.roarCountdownTimer) {
        this.roarCountdownTimer.remove(false);
      }
      this.roarCountdownTimer = this.time.addEvent({
        delay: 1000,
        repeat: totalSeconds - 1,
        callback: () => {
          remaining -= 1;
          if (remaining > 0) {
            this.overlayText.setText(`ROAR!\nSWAP IN ${remaining}`);
          } else {
            this.overlayText.setText("SWAP!");
            this.time.delayedCall(400, () => this.overlayText.setVisible(false));
          }
        },
      });
    };

    this.handleRolesSwapped = ({ players }) => {
      players.forEach((player) => {
        const entry = this.playerSprites.get(player.socketId);
        if (entry) {
          entry.role = player.role;
          entry.sprite.fillColor = player.role === "runner" ? 0x22c55e : 0x3b82f6;
        }
        if (player.socketId === this.localSocketId) {
          this.isRunner = player.role === "runner";
          this.roleText.setText(
            this.isRunner ? "Role: Runner (WASD)" : "Role: Typer (movement disabled)"
          );
        }
      });
    };

    this.handleKeydown = (event) => {
      if (this.isRunner) return;
      const key = String(event.key || "").toLowerCase();
      if (key.length !== 1 || !/[a-z]/.test(key)) return;
      this.socket?.emit("typer_input", {
        roomCode: this.roomCode,
        char: key,
      });
    };

    this.socket?.on("player_moved", this.handlePlayerMoved);
    this.socket?.on("game_state", this.handleGameState);
    this.socket?.on("typing_progress", this.handleTypingProgress);
    this.socket?.on("word_completed", this.handleWordCompleted);
    this.socket?.on("boss_roar_start", this.handleRoarStart);
    this.socket?.on("roles_swapped", this.handleRolesSwapped);
    this.input.keyboard.on("keydown", this.handleKeydown);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
  }

  update(time, delta) {
    this.playerSprites.forEach(({ sprite, label }, socketId) => {
      const target = this.playerTargets.get(socketId);
      if (!target) return;
      const lerpValue = socketId === this.localSocketId ? 0.35 : 0.2;
      sprite.x = Phaser.Math.Linear(sprite.x, target.x, lerpValue);
      sprite.y = Phaser.Math.Linear(sprite.y, target.y, lerpValue);
      label.x = sprite.x - 35;
      label.y = sprite.y - 28;
    });

    if (!this.isRunner) {
      return;
    }

    const local = this.playerSprites.get(this.localSocketId);
    if (!local) return;

    const velocity = 260 * (delta / 1000);
    let nextX = local.sprite.x;
    let nextY = local.sprite.y;

    if (this.keys.left.isDown) nextX -= velocity;
    if (this.keys.right.isDown) nextX += velocity;
    if (this.keys.up.isDown) nextY -= velocity;
    if (this.keys.down.isDown) nextY += velocity;

    nextX = Phaser.Math.Clamp(nextX, 20, 940);
    nextY = Phaser.Math.Clamp(nextY, 100, 520);

    this.playerTargets.set(this.localSocketId, { x: nextX, y: nextY });

    if (time - this.lastSentAt > 50) {
      this.lastSentAt = time;
      this.socket?.emit("player_move", {
        roomCode: this.roomCode,
        x: nextX,
        y: nextY,
      });
    }
  }

  shutdown() {
    if (this.socket && this.handlePlayerMoved) {
      this.socket.off("player_moved", this.handlePlayerMoved);
    }
    if (this.socket && this.handleGameState) {
      this.socket.off("game_state", this.handleGameState);
    }
    if (this.socket && this.handleTypingProgress) {
      this.socket.off("typing_progress", this.handleTypingProgress);
    }
    if (this.socket && this.handleWordCompleted) {
      this.socket.off("word_completed", this.handleWordCompleted);
    }
    if (this.socket && this.handleRoarStart) {
      this.socket.off("boss_roar_start", this.handleRoarStart);
    }
    if (this.socket && this.handleRolesSwapped) {
      this.socket.off("roles_swapped", this.handleRolesSwapped);
    }
    if (this.input?.keyboard && this.handleKeydown) {
      this.input.keyboard.off("keydown", this.handleKeydown);
    }
    this.projectileSprites.forEach((sprite) => sprite.destroy());
    this.projectileSprites.clear();
    if (this.roarCountdownTimer) {
      this.roarCountdownTimer.remove(false);
      this.roarCountdownTimer = null;
    }
  }
}
