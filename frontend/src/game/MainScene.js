import Phaser from "phaser";

const ARENA_WIDTH = 960;
const ARENA_HEIGHT = 540;
const GRID_SPACING = 40;

const COLORS = {
  bgDeep: 0x04060f,
  gridLine: 0x1a2347,
  gridGlow: 0x2a3567,
  bossBody: 0x6b1a3a,
  bossBodyAlt: 0xa83263,
  bossBorder: 0xff6b9d,
  bossBodyRoar: 0xff3366,
  bossHpBack: 0x1f1230,
  bossHpFill: 0xff6b6b,
  runner: 0x4ef0d4,
  typer: 0x6fa3ff,
  glow: 0xffffff,
  projectile: 0xffb454,
  projectileGlow: 0xfff5d6,
  panel: 0x0a1124,
  panelStroke: 0x82aaff,
  textTyped: "#4ef0d4",
  textRemaining: "#e8ecff",
  textExpected: "#fbbf24",
  warn: "#ff6b6b",
  heal: "#4ade80",
  star: 0x6f8aff,
};

const ROLE_COLOR = {
  runner: COLORS.runner,
  typer: COLORS.typer,
};

const TYPING_FONT = '"Outfit", "Inter", "Segoe UI", system-ui, sans-serif';
const MONO_FONT = '"JetBrains Mono", "Fira Code", "SF Mono", Consolas, monospace';

export default class MainScene extends Phaser.Scene {
  constructor() {
    super("MainScene");
    this.playerSprites = new Map();
    this.playerTargets = new Map();
    this.playerFacing = new Map();
    this.projectileSprites = new Map();
    this.lastSentAt = 0;
    this.roarCountdownTimer = null;
    this.localTypedProgress = 0;
    this.expectedWord = "";
    this.bossHP = 100;
    this.bossMaxHP = 100;
    this.lastBossHP = 100;
    this.stars = [];
    this.streak = 0;
  }

  init(data) {
    this.socket = data.socket;
    this.gamePayload = data.gamePayload;
  }

  create() {
    this.cameras.main.setBackgroundColor(COLORS.bgDeep);

    this.drawArenaBackground();
    this.createStarfield();

    this.bossContainer = this.add.container(ARENA_WIDTH / 2, 80);
    this.bossBodyGfx = this.add.graphics();
    this.bossBorderGfx = this.add.graphics();
    this.bossLabel = this.add
      .text(0, 0, "BOSS", {
        fontFamily: TYPING_FONT,
        fontSize: "26px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    this.bossContainer.add([this.bossBorderGfx, this.bossBodyGfx, this.bossLabel]);
    this.drawBoss(false);

    this.bossPulse = this.tweens.add({
      targets: this.bossContainer,
      scale: { from: 1.0, to: 1.05 },
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: "sine.inOut",
    });

    this.bossDamageFlash = this.add
      .rectangle(ARENA_WIDTH / 2, 80, 240, 92, 0xffffff, 0)
      .setDepth(11);

    this.bossHpBack = this.add.graphics();
    this.bossHpFill = this.add.graphics();
    this.bossHpText = this.add
      .text(ARENA_WIDTH / 2, 138, "", {
        fontFamily: MONO_FONT,
        fontSize: "12px",
        color: "#cdd5ff",
      })
      .setOrigin(0.5);

    const players = this.gamePayload?.players || [];
    this.localSocketId = this.socket?.id;
    this.localPlayer = players.find((p) => p.socketId === this.localSocketId);
    this.roomCode = this.gamePayload?.roomCode;
    this.isRunner = this.localPlayer?.role === "runner";
    this.expectedWord = this.gamePayload?.currentWord || "";
    this.localTypedProgress = this.gamePayload?.typedProgress || 0;
    this.bossHP = this.gamePayload?.bossHP ?? 100;
    this.lastBossHP = this.bossHP;
    this.bossMaxHP = this.gamePayload?.bossMaxHP ?? 100;
    this.bossState = this.gamePayload?.bossState || "countdown";
    this.streak = this.gamePayload?.streak || 0;
    this.drawBossHpBar(this.bossHP, this.bossMaxHP);

    players.forEach((player) => this.addOrUpdatePlayer(player));

    this.roleBadge = this.add
      .text(
        16,
        16,
        this.isRunner ? "ROLE  RUNNER · WASD" : "ROLE  TYPER · KEYBOARD",
        {
          fontFamily: TYPING_FONT,
          fontSize: "14px",
          color: this.isRunner ? COLORS.textTyped : "#cdd5ff",
          backgroundColor: "rgba(13,18,32,0.65)",
          padding: { x: 10, y: 6 },
        }
      )
      .setOrigin(0, 0)
      .setDepth(10);

    this.bossStateText = this.add
      .text(ARENA_WIDTH - 16, 16, "BOSS  COUNTDOWN", {
        fontFamily: TYPING_FONT,
        fontSize: "14px",
        color: "#fca5a5",
        backgroundColor: "rgba(13,18,32,0.65)",
        padding: { x: 10, y: 6 },
      })
      .setOrigin(1, 0)
      .setDepth(10);

    this.streakText = this.add
      .text(ARENA_WIDTH / 2, 168, "", {
        fontFamily: TYPING_FONT,
        fontSize: "14px",
        color: COLORS.textTyped,
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(10)
      .setVisible(false);

    this.wordPanel = this.add.graphics();
    this.drawWordPanel();
    this.wordContainer = this.add.container(ARENA_WIDTH / 2, 490);
    this.wordContainer.setDepth(20);
    this.typedText = this.add.text(0, 0, "", {
      fontFamily: MONO_FONT,
      fontSize: "44px",
      color: COLORS.textTyped,
      fontStyle: "bold",
    });
    this.typedText.setOrigin(0, 0.5);
    this.remainingText = this.add.text(0, 0, "", {
      fontFamily: MONO_FONT,
      fontSize: "44px",
      color: COLORS.textRemaining,
    });
    this.remainingText.setOrigin(0, 0.5);
    this.wordContainer.add([this.typedText, this.remainingText]);
    this.renderWord(this.expectedWord, this.localTypedProgress);

    this.flashLayer = this.add.text(ARENA_WIDTH / 2, 200, "", {
      fontFamily: TYPING_FONT,
      fontSize: "20px",
      color: "#86efac",
      fontStyle: "bold",
    });
    this.flashLayer.setOrigin(0.5).setDepth(40).setAlpha(0);

    this.overlayText = this.add
      .text(ARENA_WIDTH / 2, 270, "", {
        fontFamily: TYPING_FONT,
        fontSize: "72px",
        color: "#ffffff",
        fontStyle: "bold",
        align: "center",
      })
      .setOrigin(0.5)
      .setDepth(50)
      .setVisible(false);

    this.subOverlayText = this.add
      .text(ARENA_WIDTH / 2, 350, "", {
        fontFamily: TYPING_FONT,
        fontSize: "20px",
        color: "#cdd5ff",
        align: "center",
      })
      .setOrigin(0.5)
      .setDepth(50)
      .setVisible(false);

    this.bindKeyboard();
    this.bindSocketHandlers();
    this.handleInitialCountdown();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.shutdown, this);
  }

  drawArenaBackground() {
    const grid = this.add.graphics();
    grid.fillStyle(COLORS.bgDeep, 1);
    grid.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

    grid.lineStyle(1, COLORS.gridLine, 0.55);
    for (let x = 0; x <= ARENA_WIDTH; x += GRID_SPACING) {
      grid.lineBetween(x, 0, x, ARENA_HEIGHT);
    }
    for (let y = 0; y <= ARENA_HEIGHT; y += GRID_SPACING) {
      grid.lineBetween(0, y, ARENA_WIDTH, y);
    }

    const accent = this.add.graphics();
    accent.lineStyle(2, COLORS.gridGlow, 0.45);
    accent.strokeRect(20, 60, ARENA_WIDTH - 40, ARENA_HEIGHT - 120);

    const vignette = this.add.graphics();
    vignette.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.55, 0.55, 0, 0);
    vignette.fillRect(0, 0, ARENA_WIDTH, 90);
  }

  createStarfield() {
    for (let i = 0; i < 36; i += 1) {
      const x = Math.random() * ARENA_WIDTH;
      const y = Math.random() * ARENA_HEIGHT;
      const radius = Math.random() < 0.7 ? 1 : 1.6;
      const sprite = this.add.circle(x, y, radius, COLORS.star, 0.55);
      sprite.setBlendMode(Phaser.BlendModes.ADD);
      sprite.setDepth(1);
      const speed = 8 + Math.random() * 18;
      const dir = Math.random() * Math.PI * 2;
      this.stars.push({
        sprite,
        vx: Math.cos(dir) * speed * 0.3,
        vy: Math.sin(dir) * speed * 0.3,
        baseAlpha: 0.4 + Math.random() * 0.5,
        twinklePhase: Math.random() * Math.PI * 2,
      });
    }
  }

  drawBoss(isRoar) {
    const w = 220;
    const h = 78;
    const r = 14;
    this.bossBodyGfx.clear();
    this.bossBodyGfx.fillStyle(isRoar ? COLORS.bossBodyRoar : COLORS.bossBody, 0.95);
    this.bossBodyGfx.fillRoundedRect(-w / 2, -h / 2, w, h, r);
    this.bossBodyGfx.fillStyle(isRoar ? 0xff85a8 : COLORS.bossBodyAlt, 0.45);
    this.bossBodyGfx.fillRoundedRect(-w / 2 + 4, -h / 2 + 4, w - 8, h - 8, r - 2);

    this.bossBorderGfx.clear();
    this.bossBorderGfx.lineStyle(3, COLORS.bossBorder, 0.95);
    this.bossBorderGfx.strokeRoundedRect(-w / 2, -h / 2, w, h, r);
    this.bossBorderGfx.lineStyle(1, COLORS.bossBorder, 0.4);
    this.bossBorderGfx.strokeRoundedRect(-w / 2 - 4, -h / 2 - 4, w + 8, h + 8, r + 2);
  }

  drawBossHpBar(hp, maxHP) {
    const width = 220;
    const height = 12;
    const x = ARENA_WIDTH / 2 - width / 2;
    const y = 124;
    const safeMax = Math.max(1, maxHP || 1);
    const pct = Math.max(0, Math.min(1, hp / safeMax));

    this.bossHpBack.clear();
    this.bossHpBack.fillStyle(COLORS.bossHpBack, 0.85);
    this.bossHpBack.fillRoundedRect(x, y, width, height, 5);
    this.bossHpBack.lineStyle(1, COLORS.bossBorder, 0.7);
    this.bossHpBack.strokeRoundedRect(x, y, width, height, 5);

    this.bossHpFill.clear();
    if (pct > 0) {
      this.bossHpFill.fillStyle(COLORS.bossHpFill, 0.95);
      this.bossHpFill.fillRoundedRect(x + 1, y + 1, (width - 2) * pct, height - 2, 4);
    }
    if (this.bossHpText) {
      this.bossHpText.setText(`${Math.round(hp)} / ${safeMax}`);
    }
  }

  drawWordPanel() {
    const panelWidth = 760;
    const panelHeight = 70;
    const x = ARENA_WIDTH / 2 - panelWidth / 2;
    const y = 490 - panelHeight / 2;
    this.wordPanel.clear();
    this.wordPanel.fillStyle(COLORS.panel, 0.65);
    this.wordPanel.fillRoundedRect(x, y, panelWidth, panelHeight, 14);
    this.wordPanel.lineStyle(1, COLORS.panelStroke, 0.35);
    this.wordPanel.strokeRoundedRect(x, y, panelWidth, panelHeight, 14);
  }

  renderWord(word, typedProgress) {
    const safeWord = word || "";
    const safeProgress = Math.max(0, Math.min(safeWord.length, typedProgress || 0));
    const typed = safeWord.slice(0, safeProgress);
    const rest = safeWord.slice(safeProgress);

    this.typedText.setText(typed);
    this.remainingText.setText(rest);

    const total = this.typedText.width + this.remainingText.width;
    const startX = -total / 2;
    this.typedText.setX(startX);
    this.remainingText.setX(startX + this.typedText.width);
  }

  drawRunnerArrow(entry, facing) {
    if (!entry?.arrowGfx) return;
    const fx = facing?.x || 0;
    const fy = facing?.y || 0;
    const mag = Math.sqrt(fx * fx + fy * fy);
    entry.arrowGfx.clear();
    if (mag < 0.05 || entry.role !== "runner") {
      return;
    }
    const angle = Math.atan2(fy, fx);
    const distance = 22;
    const tipX = Math.cos(angle) * distance;
    const tipY = Math.sin(angle) * distance;
    const leftAngle = angle + Math.PI * 0.85;
    const rightAngle = angle - Math.PI * 0.85;
    const baseDist = 14;
    const leftX = Math.cos(leftAngle) * baseDist;
    const leftY = Math.sin(leftAngle) * baseDist;
    const rightX = Math.cos(rightAngle) * baseDist;
    const rightY = Math.sin(rightAngle) * baseDist;
    entry.arrowGfx.fillStyle(0xffffff, 0.92);
    entry.arrowGfx.beginPath();
    entry.arrowGfx.moveTo(tipX, tipY);
    entry.arrowGfx.lineTo(leftX, leftY);
    entry.arrowGfx.lineTo(rightX, rightY);
    entry.arrowGfx.closePath();
    entry.arrowGfx.fillPath();
  }

  addOrUpdatePlayer(player) {
    let entry = this.playerSprites.get(player.socketId);
    const color = ROLE_COLOR[player.role] || COLORS.runner;
    if (!entry) {
      const glow = this.add.circle(player.x || 480, player.y || 380, 26, color, 0.18);
      glow.setBlendMode(Phaser.BlendModes.ADD);
      const ring = this.add.circle(player.x || 480, player.y || 380, 20, 0xffffff, 0.0);
      ring.setStrokeStyle(2, color, 0.85);
      const body = this.add.circle(player.x || 480, player.y || 380, 14, color, 1);
      body.setStrokeStyle(1.5, 0xffffff, 0.65);
      const arrowGfx = this.add.graphics().setDepth(8);
      const hitFlash = this.add.circle(player.x || 480, player.y || 380, 28, 0xff5577, 0);
      hitFlash.setBlendMode(Phaser.BlendModes.ADD);
      const label = this.add
        .text(player.x || 480, (player.y || 380) - 36, player.username || "", {
          fontFamily: TYPING_FONT,
          fontSize: "12px",
          color: "#e8ecff",
          backgroundColor: "rgba(13,18,32,0.7)",
          padding: { x: 6, y: 2 },
        })
        .setOrigin(0.5, 0.5);

      const tween = this.tweens.add({
        targets: glow,
        scale: { from: 1.0, to: 1.25 },
        alpha: { from: 0.4, to: 0.15 },
        duration: 1100,
        yoyo: true,
        repeat: -1,
        ease: "sine.inOut",
      });

      entry = { glow, ring, body, label, arrowGfx, hitFlash, role: player.role, tween, color };
      this.playerSprites.set(player.socketId, entry);
    } else {
      entry.glow.fillColor = color;
      entry.ring.setStrokeStyle(2, color, 0.85);
      entry.body.fillColor = color;
      entry.label.setText(player.username || "");
      entry.role = player.role;
      entry.color = color;
    }

    this.playerTargets.set(player.socketId, {
      x: player.x ?? entry.body.x,
      y: player.y ?? entry.body.y,
    });
    if (player.facing) this.playerFacing.set(player.socketId, player.facing);
    this.drawRunnerArrow(entry, this.playerFacing.get(player.socketId));
  }

  removePlayer(socketId) {
    const entry = this.playerSprites.get(socketId);
    if (!entry) return;
    if (entry.tween) entry.tween.stop();
    entry.glow?.destroy?.();
    entry.ring?.destroy?.();
    entry.body?.destroy?.();
    entry.label?.destroy?.();
    entry.arrowGfx?.destroy?.();
    entry.hitFlash?.destroy?.();
    this.playerSprites.delete(socketId);
    this.playerTargets.delete(socketId);
    this.playerFacing.delete(socketId);
  }

  applyRoleVisuals(role) {
    this.isRunner = role === "runner";
    if (this.roleBadge) {
      this.roleBadge.setText(
        this.isRunner ? "ROLE  RUNNER · WASD" : "ROLE  TYPER · KEYBOARD"
      );
      this.roleBadge.setColor(this.isRunner ? COLORS.textTyped : "#cdd5ff");
    }
    this.bindKeyboard();
  }

  bindKeyboard() {
    if (this.keys) {
      Object.values(this.keys).forEach((key) => {
        if (key && typeof key.destroy === "function") key.destroy();
      });
      this.keys = null;
    }
    if (this.handleKeydown && this.input?.keyboard) {
      this.input.keyboard.off("keydown", this.handleKeydown, this);
    }

    if (this.isRunner) {
      this.keys = this.input.keyboard.addKeys({
        up: Phaser.Input.Keyboard.KeyCodes.W,
        left: Phaser.Input.Keyboard.KeyCodes.A,
        down: Phaser.Input.Keyboard.KeyCodes.S,
        right: Phaser.Input.Keyboard.KeyCodes.D,
      });
    } else {
      this.handleKeydown = (event) => {
        const key = String(event?.key || "").toLowerCase();
        if (key.length !== 1 || !/[a-z]/.test(key)) return;
        if (this.bossState === "countdown" || this.bossState === "roar") return;

        if (this.expectedWord && this.localTypedProgress < this.expectedWord.length) {
          const expected = this.expectedWord[this.localTypedProgress];
          if (key === expected) {
            this.localTypedProgress += 1;
            this.renderWord(this.expectedWord, this.localTypedProgress);
          } else {
            this.flashWordTypo();
          }
        }

        this.socket?.emit("typer_input", {
          roomCode: this.roomCode,
          char: key,
        });
      };
      this.input.keyboard.on("keydown", this.handleKeydown, this);
    }
  }

  handleInitialCountdown() {
    const remainingMs =
      this.gamePayload?.countdownRemaining != null
        ? this.gamePayload.countdownRemaining
        : 0;
    if (this.gamePayload?.bossState === "countdown" || remainingMs > 0) {
      this.bossState = "countdown";
      this.startCountdownOverlay(remainingMs || 3000);
    }
  }

  startCountdownOverlay(remainingMs) {
    this.cancelCountdownTimer();
    let secondsLeft = Math.max(1, Math.ceil(remainingMs / 1000));
    this.overlayText.setColor("#ffffff");
    this.overlayText.setText(String(secondsLeft));
    this.overlayText.setVisible(true);
    this.overlayText.setScale(1.3);
    this.subOverlayText.setText(
      this.isRunner
        ? "Get ready · WASD to dodge"
        : "Get ready · type to attack"
    );
    this.subOverlayText.setVisible(true);

    const tickIn = () => {
      this.overlayText.setScale(1.4);
      this.tweens.add({
        targets: this.overlayText,
        scale: 1.0,
        duration: 500,
        ease: "back.out",
      });
    };
    tickIn();

    this.countdownTimer = this.time.addEvent({
      delay: 1000,
      repeat: secondsLeft - 1,
      callback: () => {
        secondsLeft -= 1;
        if (secondsLeft <= 0) {
          this.overlayText.setText("FIGHT!");
          this.overlayText.setColor("#ff6b9d");
          tickIn();
          this.cameras.main.flash(220, 255, 200, 220);
          this.time.delayedCall(700, () => {
            this.overlayText.setVisible(false);
            this.subOverlayText.setVisible(false);
          });
        } else {
          this.overlayText.setText(String(secondsLeft));
          tickIn();
        }
      },
    });
  }

  cancelCountdownTimer() {
    if (this.countdownTimer) {
      this.countdownTimer.remove(false);
      this.countdownTimer = null;
    }
  }

  flashBossDamage() {
    this.tweens.killTweensOf(this.bossDamageFlash);
    this.bossDamageFlash.setAlpha(0.7);
    this.tweens.add({
      targets: this.bossDamageFlash,
      alpha: 0,
      duration: 220,
      ease: "cubic.out",
    });
    this.tweens.add({
      targets: this.bossContainer,
      x: { from: ARENA_WIDTH / 2 - 6, to: ARENA_WIDTH / 2 },
      duration: 160,
      ease: "back.out",
    });
  }

  flashPlayerHit(socketId) {
    const entry = this.playerSprites.get(socketId);
    if (!entry) return;
    this.tweens.killTweensOf(entry.hitFlash);
    entry.hitFlash.setAlpha(0.85);
    this.tweens.add({
      targets: entry.hitFlash,
      alpha: 0,
      scale: { from: 1.0, to: 1.6 },
      duration: 360,
      ease: "cubic.out",
      onComplete: () => entry.hitFlash.setScale(1),
    });
    if (socketId === this.localSocketId) {
      this.cameras.main.shake(180, 0.008);
    }
  }

  flashWordTypo() {
    this.tweens.killTweensOf(this.wordContainer);
    this.wordContainer.x = ARENA_WIDTH / 2;
    const baseX = ARENA_WIDTH / 2;
    this.tweens.add({
      targets: this.wordContainer,
      x: { from: baseX - 14, to: baseX + 14 },
      yoyo: true,
      repeat: 2,
      duration: 60,
      ease: "sine.inOut",
      onComplete: () => {
        this.wordContainer.x = baseX;
      },
    });
    const original = this.remainingText.style.color;
    this.remainingText.setColor(COLORS.warn);
    this.time.delayedCall(220, () => this.remainingText.setColor(original));
  }

  spawnDamageBurst(damage, color, isCrit) {
    const text = this.add.text(ARENA_WIDTH / 2, 90, `−${damage}${isCrit ? "  CRIT" : ""}`, {
      fontFamily: TYPING_FONT,
      fontSize: isCrit ? "26px" : "22px",
      color: isCrit ? "#fbbf24" : "#ff6b9d",
      fontStyle: "bold",
    });
    text.setOrigin(0.5).setDepth(45);
    this.tweens.add({
      targets: text,
      y: 50,
      alpha: 0,
      scale: { from: 1.1, to: 1.4 },
      duration: 900,
      ease: "cubic.out",
      onComplete: () => text.destroy(),
    });

    const typer = this.findPlayerByRole("typer");
    if (!typer) return;
    const start = { x: typer.body.x, y: typer.body.y };
    const target = { x: ARENA_WIDTH / 2, y: 80 };
    const count = isCrit ? 14 : 9;
    for (let i = 0; i < count; i += 1) {
      const offset = (i - count / 2) * 4;
      const particle = this.add.circle(start.x + offset, start.y, 4, color, 0.95);
      particle.setBlendMode(Phaser.BlendModes.ADD);
      particle.setDepth(30);
      const peakY = (start.y + target.y) / 2 - 60 - Math.random() * 40;
      const peakX = (start.x + target.x) / 2 + (Math.random() * 80 - 40);
      this.tweens.add({
        targets: particle,
        x: target.x + (Math.random() * 30 - 15),
        y: target.y + (Math.random() * 20 - 10),
        scale: { from: 1, to: 0.2 },
        alpha: { from: 1, to: 0 },
        duration: 520 + Math.random() * 180,
        ease: "sine.in",
        delay: i * 18,
        onUpdate: (tween) => {
          const t = tween.progress;
          const arc = Math.sin(t * Math.PI) * (start.y - peakY);
          particle.y -= arc * 0.04;
          particle.x += (peakX - particle.x) * 0.04;
        },
        onComplete: () => particle.destroy(),
      });
    }
  }

  spawnHealBurst(amount) {
    const text = this.add.text(ARENA_WIDTH / 2, 200, `+${amount} HP`, {
      fontFamily: TYPING_FONT,
      fontSize: "22px",
      color: COLORS.heal,
      fontStyle: "bold",
    });
    text.setOrigin(0.5).setDepth(45);
    this.tweens.add({
      targets: text,
      y: 160,
      alpha: 0,
      duration: 900,
      ease: "cubic.out",
      onComplete: () => text.destroy(),
    });
  }

  triggerRoarShockwave() {
    const ring = this.add.circle(ARENA_WIDTH / 2, 80, 80, 0xff3366, 0);
    ring.setStrokeStyle(4, 0xff6b9d, 0.85);
    ring.setBlendMode(Phaser.BlendModes.ADD);
    ring.setDepth(12);
    this.tweens.add({
      targets: ring,
      scale: 6,
      alpha: 0,
      duration: 850,
      ease: "cubic.out",
      onComplete: () => ring.destroy(),
    });

    for (let i = 0; i < 22; i += 1) {
      const angle = (i / 22) * Math.PI * 2 + Math.random() * 0.2;
      const speed = 220 + Math.random() * 140;
      const particle = this.add.circle(ARENA_WIDTH / 2, 80, 3, 0xff85a8, 0.95);
      particle.setBlendMode(Phaser.BlendModes.ADD);
      particle.setDepth(13);
      const targetX = ARENA_WIDTH / 2 + Math.cos(angle) * speed;
      const targetY = 80 + Math.sin(angle) * speed;
      this.tweens.add({
        targets: particle,
        x: targetX,
        y: targetY,
        alpha: 0,
        duration: 700,
        ease: "cubic.out",
        onComplete: () => particle.destroy(),
      });
    }
  }

  findPlayerByRole(role) {
    for (const entry of this.playerSprites.values()) {
      if (entry.role === role) return entry;
    }
    return null;
  }

  bindSocketHandlers() {
    if (!this.socket) return;

    this.handlePlayerMoved = ({ socketId, x, y, facing }) => {
      this.playerTargets.set(socketId, { x, y });
      if (facing) {
        this.playerFacing.set(socketId, facing);
        const entry = this.playerSprites.get(socketId);
        if (entry) this.drawRunnerArrow(entry, facing);
      }
    };

    this.handleGameState = (state) => {
      const previousBossHP = this.bossHP;
      this.bossHP = state.bossHP;
      this.bossMaxHP = state.bossMaxHP ?? this.bossMaxHP;
      this.drawBossHpBar(this.bossHP, this.bossMaxHP);
      if (this.bossHP < previousBossHP) {
        this.flashBossDamage();
      }
      this.lastBossHP = this.bossHP;

      this.bossState = state.bossState;
      if (this.bossStateText) {
        this.bossStateText.setText(`BOSS  ${String(state.bossState || "").toUpperCase()}`);
      }
      this.drawBoss(state.bossState === "roar");

      this.streak = state.streak || 0;
      if (this.streak >= 2) {
        this.streakText.setText(`STREAK ×${this.streak}`);
        this.streakText.setVisible(true);
      } else {
        this.streakText.setVisible(false);
      }

      this.expectedWord = state.currentWord || "";
      this.localTypedProgress = state.typedProgress || 0;
      this.renderWord(this.expectedWord, this.localTypedProgress);

      const presentIds = new Set();
      state.players.forEach((player) => {
        presentIds.add(player.socketId);
        this.addOrUpdatePlayer(player);
        if (
          player.socketId === this.localSocketId &&
          player.role !== (this.isRunner ? "runner" : "typer")
        ) {
          this.applyRoleVisuals(player.role);
        }
      });
      this.playerSprites.forEach((_entry, socketId) => {
        if (!presentIds.has(socketId)) this.removePlayer(socketId);
      });

      const activeIds = new Set();
      (state.projectiles || []).forEach((projectile) => {
        activeIds.add(projectile.id);
        let sprite = this.projectileSprites.get(projectile.id);
        if (!sprite) {
          sprite = this.add.circle(projectile.x, projectile.y, 8, COLORS.projectile, 1);
          sprite.setBlendMode(Phaser.BlendModes.ADD);
          sprite.setStrokeStyle(2, COLORS.projectileGlow, 0.9);
          sprite.setDepth(15);
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

    this.handleTypingProgress = ({ currentWord, typedProgress, streak }) => {
      this.expectedWord = currentWord || "";
      this.localTypedProgress = typedProgress || 0;
      if (typeof streak === "number") this.streak = streak;
      this.renderWord(this.expectedWord, this.localTypedProgress);
    };

    this.handleTypo = ({ socketId }) => {
      if (socketId === this.localSocketId) {
        this.flashWordTypo();
      }
    };

    this.handleWordCompleted = ({ by, word, damage, stunBonus, healed }) => {
      this.flashLayer.setText(
        `${by} typed "${word}"  −${damage}${stunBonus ? " (STUN)" : ""}`
      );
      this.flashLayer.setAlpha(1);
      this.flashLayer.y = 200;
      this.flashLayer.setColor(stunBonus ? "#fbbf24" : "#86efac");
      this.tweens.add({
        targets: this.flashLayer,
        y: 160,
        alpha: 0,
        duration: 800,
        ease: "cubic.out",
      });
      this.spawnDamageBurst(
        damage,
        stunBonus ? 0xfbbf24 : COLORS.runner,
        Boolean(stunBonus)
      );
      if (healed > 0) {
        this.spawnHealBurst(healed);
      }
    };

    this.handlePlayerHit = ({ socketId }) => {
      this.flashPlayerHit(socketId);
    };

    this.handleBattleStarted = () => {
      this.cancelCountdownTimer();
      this.overlayText.setVisible(false);
      this.subOverlayText.setVisible(false);
    };

    this.handleRoarStart = ({ countdownMs }) => {
      this.cameras.main.shake(600, 0.012);
      this.drawBoss(true);
      this.triggerRoarShockwave();

      const totalSeconds = Math.max(1, Math.ceil((countdownMs || 3000) / 1000));
      let remaining = totalSeconds;
      this.overlayText.setColor("#ff6b9d");
      this.overlayText.setVisible(true);
      this.overlayText.setText(`ROAR\nSWAP IN ${remaining}`);
      this.subOverlayText.setVisible(false);

      if (this.roarCountdownTimer) this.roarCountdownTimer.remove(false);
      this.roarCountdownTimer = this.time.addEvent({
        delay: 1000,
        repeat: totalSeconds - 1,
        callback: () => {
          remaining -= 1;
          if (remaining > 0) {
            this.overlayText.setText(`ROAR\nSWAP IN ${remaining}`);
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
          const color = ROLE_COLOR[player.role] || COLORS.runner;
          entry.glow.fillColor = color;
          entry.ring.setStrokeStyle(2, color, 0.85);
          entry.body.fillColor = color;
          entry.color = color;
          this.drawRunnerArrow(entry, this.playerFacing.get(player.socketId));
        }
        if (player.socketId === this.localSocketId) {
          this.applyRoleVisuals(player.role);
        }
      });
      this.drawBoss(false);
    };

    this.handleGameOver = ({ winner, sharedHP, bossHP }) => {
      const playersWon = winner === "players";
      this.overlayText.setText(
        playersWon ? `VICTORY!\nBOSS DEFEATED` : `DEFEATED\nBOSS WINS`
      );
      this.overlayText.setColor(playersWon ? "#4ade80" : "#ff6b6b");
      this.overlayText.setFontSize(56);
      this.overlayText.setVisible(true);
      this.subOverlayText.setVisible(false);
      this.cameras.main.flash(
        700,
        playersWon ? 70 : 220,
        playersWon ? 240 : 50,
        playersWon ? 200 : 80
      );
      if (this.bossPulse) this.bossPulse.stop();
      this.bossHP = bossHP ?? this.bossHP;
      this.drawBossHpBar(this.bossHP, this.bossMaxHP);
    };

    this.socket.on("player_moved", this.handlePlayerMoved);
    this.socket.on("game_state", this.handleGameState);
    this.socket.on("typing_progress", this.handleTypingProgress);
    this.socket.on("typo", this.handleTypo);
    this.socket.on("word_completed", this.handleWordCompleted);
    this.socket.on("player_hit", this.handlePlayerHit);
    this.socket.on("battle_started", this.handleBattleStarted);
    this.socket.on("boss_roar_start", this.handleRoarStart);
    this.socket.on("roles_swapped", this.handleRolesSwapped);
    this.socket.on("game_over", this.handleGameOver);
  }

  update(time, delta) {
    const dt = delta / 1000;

    this.stars.forEach((star) => {
      star.sprite.x += star.vx * dt;
      star.sprite.y += star.vy * dt;
      if (star.sprite.x < -10) star.sprite.x = ARENA_WIDTH + 10;
      if (star.sprite.x > ARENA_WIDTH + 10) star.sprite.x = -10;
      if (star.sprite.y < -10) star.sprite.y = ARENA_HEIGHT + 10;
      if (star.sprite.y > ARENA_HEIGHT + 10) star.sprite.y = -10;
      star.twinklePhase += dt * 1.6;
      star.sprite.alpha = star.baseAlpha + Math.sin(star.twinklePhase) * 0.18;
    });

    this.playerSprites.forEach((entry, socketId) => {
      const target = this.playerTargets.get(socketId);
      if (!target) return;
      const lerpValue = socketId === this.localSocketId ? 0.35 : 0.2;
      const nextX = Phaser.Math.Linear(entry.body.x, target.x, lerpValue);
      const nextY = Phaser.Math.Linear(entry.body.y, target.y, lerpValue);
      entry.body.x = nextX;
      entry.body.y = nextY;
      entry.ring.x = nextX;
      entry.ring.y = nextY;
      entry.glow.x = nextX;
      entry.glow.y = nextY;
      if (entry.hitFlash) {
        entry.hitFlash.x = nextX;
        entry.hitFlash.y = nextY;
      }
      if (entry.arrowGfx) {
        entry.arrowGfx.x = nextX;
        entry.arrowGfx.y = nextY;
      }
      entry.label.x = nextX;
      entry.label.y = nextY - 36;
    });

    if (!this.isRunner || !this.keys || this.bossState === "countdown") return;

    const local = this.playerSprites.get(this.localSocketId);
    if (!local) return;

    const velocity = 280 * dt;
    let nextX = local.body.x;
    let nextY = local.body.y;
    let dx = 0;
    let dy = 0;

    if (this.keys.left.isDown) {
      nextX -= velocity;
      dx -= 1;
    }
    if (this.keys.right.isDown) {
      nextX += velocity;
      dx += 1;
    }
    if (this.keys.up.isDown) {
      nextY -= velocity;
      dy -= 1;
    }
    if (this.keys.down.isDown) {
      nextY += velocity;
      dy += 1;
    }

    nextX = Phaser.Math.Clamp(nextX, 20, 940);
    nextY = Phaser.Math.Clamp(nextY, 160, 460);

    this.playerTargets.set(this.localSocketId, { x: nextX, y: nextY });

    if (dx !== 0 || dy !== 0) {
      const mag = Math.sqrt(dx * dx + dy * dy);
      const facing = { x: dx / mag, y: dy / mag };
      this.playerFacing.set(this.localSocketId, facing);
      this.drawRunnerArrow(local, facing);

      if (time - this.lastSentAt > 50) {
        this.lastSentAt = time;
        this.socket?.emit("player_move", {
          roomCode: this.roomCode,
          x: nextX,
          y: nextY,
        });
      }
    }
  }

  shutdown() {
    if (this.socket) {
      const detach = (event, handler) => {
        if (handler) this.socket.off(event, handler);
      };
      detach("player_moved", this.handlePlayerMoved);
      detach("game_state", this.handleGameState);
      detach("typing_progress", this.handleTypingProgress);
      detach("typo", this.handleTypo);
      detach("word_completed", this.handleWordCompleted);
      detach("player_hit", this.handlePlayerHit);
      detach("battle_started", this.handleBattleStarted);
      detach("boss_roar_start", this.handleRoarStart);
      detach("roles_swapped", this.handleRolesSwapped);
      detach("game_over", this.handleGameOver);
    }
    if (this.input?.keyboard && this.handleKeydown) {
      this.input.keyboard.off("keydown", this.handleKeydown, this);
    }
    if (this.keys) {
      Object.values(this.keys).forEach((key) => {
        if (key && typeof key.destroy === "function") key.destroy();
      });
      this.keys = null;
    }
    this.cancelCountdownTimer();
    this.projectileSprites.forEach((sprite) => sprite.destroy());
    this.projectileSprites.clear();
    this.playerSprites.forEach((entry) => {
      entry.tween?.stop?.();
      entry.glow?.destroy?.();
      entry.ring?.destroy?.();
      entry.body?.destroy?.();
      entry.label?.destroy?.();
      entry.arrowGfx?.destroy?.();
      entry.hitFlash?.destroy?.();
    });
    this.playerSprites.clear();
    this.playerTargets.clear();
    this.playerFacing.clear();
    this.stars.forEach((star) => star.sprite?.destroy?.());
    this.stars = [];
    if (this.bossPulse) {
      this.bossPulse.stop();
      this.bossPulse = null;
    }
    if (this.roarCountdownTimer) {
      this.roarCountdownTimer.remove(false);
      this.roarCountdownTimer = null;
    }
  }
}
