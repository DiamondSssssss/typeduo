import Phaser from "phaser";

const W = 1280;
const H = 720;
const GRID = 40;
const FONT = '"Outfit","Inter","Segoe UI",system-ui,sans-serif';
const MONO = '"JetBrains Mono","Fira Code","SF Mono",Consolas,monospace';

const STEPS = [
  { title: "Step 1 — Move", instruction: "Use ARROW KEYS or WASD to dodge the orbs. Survive 8 seconds!", goal: "survive", duration: 8000 },
  { title: "Step 2 — Type", instruction: "Type the words below. Each correct letter glows cyan — just like co-op!", goal: "type", words: ["run", "dodge", "type"] },
  { title: "Step 3 — Weapon", instruction: "Walk over the glowing weapon, then type to deal real damage.", goal: "weapon" },
  { title: "Step 4 — Dodge + Type", instruction: "Orbs spawn while you type. Keep moving!", goal: "combo", duration: 12000 },
  { title: "Step 5 — Hazard Zone", instruction: "Leave the purple zone before it explodes!", goal: "hazard" },
  { title: "Step 6 — Ready!", instruction: "Defeat the training golem. You're ready for battle!", goal: "boss", bossHP: 80 },
];

export default class TutorialScene extends Phaser.Scene {
  constructor() { super("TutorialScene"); }

  init(data) { this.onComplete = data?.onComplete; }

  create() {
    this.stepIdx = 0;
    this.orbs = [];
    this.stars = [];
    this.typedProgress = 0;
    this.word = "";
    this.weaponHeld = false;
    this.bossHP = 999;
    this.charX = 640;
    this.charY = 490;
    this._orbTimer = 0;
    this._facing = { x: 0, y: 0 };

    this.cameras.main.setBackgroundColor(0x04060f);
    this._drawArena();
    this._createStars();

    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys("W,S,A,D");

    // Character (match MainScene)
    this.charGlow = this.add.circle(640, 490, 32, 0x4ef0d4, 0.15).setBlendMode(Phaser.BlendModes.ADD).setDepth(8);
    this.charRing = this.add.circle(640, 490, 18, 0xffffff, 0).setStrokeStyle(2.5, 0x4ef0d4, 0.9).setDepth(9);
    this.charBody = this.add.circle(640, 490, 11, 0xffffff, 1).setStrokeStyle(2, 0x4ef0d4, 0.85).setDepth(9);
    this.charHit = this.add.circle(640, 490, 26, 0xff5577, 0).setBlendMode(Phaser.BlendModes.ADD).setDepth(10);
    this.tweens.add({
      targets: this.charGlow,
      scale: { from: 1, to: 1.35 },
      alpha: { from: 0.35, to: 0.1 },
      duration: 1000, yoyo: true, repeat: -1, ease: "sine.inOut",
    });

    // Word panel (match MainScene)
    const pw = 900, ph = 70, px = W / 2 - pw / 2, py = H - 60 - ph / 2;
    const wg = this.add.graphics().setDepth(22);
    wg.fillStyle(0x0a1124, 0.72);
    wg.fillRoundedRect(px, py, pw, ph, 14);
    wg.lineStyle(1.5, 0x82aaff, 0.45);
    wg.strokeRoundedRect(px, py, pw, ph, 14);

    this.wordCont = this.add.container(W / 2, H - 60).setDepth(25);
    this.typedTxt = this.add.text(0, 0, "", {
      fontFamily: MONO, fontSize: "42px", color: "#4ef0d4", fontStyle: "bold",
      shadow: { offsetX: 0, offsetY: 0, color: "#4ef0d4", blur: 14, stroke: true, fill: true },
    }).setOrigin(0, 0.5);
    this.remainTxt = this.add.text(0, 0, "", {
      fontFamily: MONO, fontSize: "42px", color: "#e8ecff",
    }).setOrigin(0, 0.5);
    this.wordCont.add([this.typedTxt, this.remainTxt]);

    // Training boss
    this.bossAura = this.add.circle(640, 140, 55, 0xff6b9d, 0.08).setBlendMode(Phaser.BlendModes.ADD).setDepth(6);
    this.dummyBoss = this.add.circle(640, 140, 40, 0x5b1130, 1).setStrokeStyle(3, 0xff6b9d, 0.95).setDepth(7).setVisible(false);
    this.bossEye = this.add.circle(640, 132, 6, 0xff9ec8, 0.9).setDepth(8).setVisible(false);
    this.tweens.add({
      targets: this.bossAura,
      scale: { from: 1, to: 1.12 },
      alpha: { from: 0.06, to: 0.18 },
      duration: 1400, yoyo: true, repeat: -1, ease: "sine.inOut",
    });

    this.weaponGlow = this.add.circle(400, 450, 22, 0xfbbf24, 0.2).setBlendMode(Phaser.BlendModes.ADD).setDepth(6).setVisible(false);
    this.weapon = this.add.circle(400, 450, 12, 0xfbbf24, 1).setStrokeStyle(2, 0xffffff, 0.9).setDepth(7).setVisible(false);
    this.tweens.add({
      targets: [this.weapon, this.weaponGlow],
      y: "+=8",
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: "sine.inOut",
    });

    // HUD chrome
    this.progressGfx = this.add.graphics().setDepth(35);
    this.titleTxt = this.add.text(W / 2, 28, "", {
      fontFamily: FONT, fontSize: "20px", color: "#4ef0d4", fontStyle: "bold",
    }).setOrigin(0.5, 0).setDepth(35);
    this.panelTxt = this.add.text(W / 2, 58, "", {
      fontFamily: FONT, fontSize: "15px", color: "#cdd5ff", align: "center", wordWrap: { width: 720 },
    }).setOrigin(0.5, 0).setDepth(35);
    this.bossHpTxt = this.add.text(640, 198, "", {
      fontFamily: FONT, fontSize: "14px", color: "#ff9ec8", fontStyle: "bold",
      backgroundColor: "rgba(13,18,32,0.75)", padding: { x: 10, y: 4 },
    }).setOrigin(0.5).setDepth(35).setVisible(false);
    this.flashTxt = this.add.text(W / 2, 280, "", {
      fontFamily: FONT, fontSize: "22px", color: "#86efac", fontStyle: "bold",
    }).setOrigin(0.5).setDepth(40).setAlpha(0);
    this.overlayTxt = this.add.text(W / 2, H / 2, "", {
      fontFamily: FONT, fontSize: "52px", color: "#ffffff", fontStyle: "bold", align: "center",
    }).setOrigin(0.5).setDepth(50).setAlpha(0);

    const skipBg = this.add.rectangle(W - 100, 32, 168, 36, 0x1a2347, 0.9)
      .setStrokeStyle(1, 0x64748b, 0.6).setDepth(40).setInteractive({ useHandCursor: true });
    this.skipBtn = this.add.text(W - 100, 32, "Skip tutorial", {
      fontFamily: FONT, fontSize: "13px", color: "#94a3b8",
    }).setOrigin(0.5).setDepth(41);
    skipBg.on("pointerover", () => skipBg.setStrokeStyle(1.5, 0x4ef0d4, 0.8));
    skipBg.on("pointerout", () => skipBg.setStrokeStyle(1, 0x64748b, 0.6));
    skipBg.on("pointerdown", () => this._finish());

    this._onKey = (e) => this._handleKey(e);
    this.input.keyboard.on("keydown", this._onKey);
    this._loadStep(0);
  }

  _drawArena() {
    const g = this.add.graphics().setDepth(0);
    g.fillStyle(0x04060f, 1);
    g.fillRect(0, 0, W, H);
    g.lineStyle(1, 0x1a2347, 0.45);
    for (let x = 0; x <= W; x += GRID) g.lineBetween(x, 0, x, H);
    for (let y = 0; y <= H; y += GRID) g.lineBetween(0, y, W, y);
    const b = this.add.graphics().setDepth(1);
    b.lineStyle(2, 0x2a3567, 0.45);
    b.strokeRect(22, 62, W - 44, H - 124);
    const v = this.add.graphics().setDepth(2);
    v.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.55, 0.55, 0, 0);
    v.fillRect(0, 0, W, 95);
  }

  _createStars() {
    for (let i = 0; i < 48; i++) {
      const s = this.add.circle(Math.random() * W, Math.random() * H, Math.random() < 0.7 ? 1 : 1.6, 0x6f8aff, 0.5);
      s.setBlendMode(Phaser.BlendModes.ADD).setDepth(1);
      const dir = Math.random() * Math.PI * 2;
      const spd = 6 + Math.random() * 16;
      this.stars.push({ sprite: s, vx: Math.cos(dir) * spd * 0.28, vy: Math.sin(dir) * spd * 0.28, base: 0.25 + Math.random() * 0.5, phase: Math.random() * Math.PI * 2 });
    }
  }

  _drawStepProgress() {
    this.progressGfx.clear();
    const n = STEPS.length;
    const gap = 14;
    const dotW = 36;
    const total = n * dotW + (n - 1) * gap;
    let x = W / 2 - total / 2;
    const y = 96;
    for (let i = 0; i < n; i++) {
      const done = i < this.stepIdx;
      const active = i === this.stepIdx;
      const col = done ? 0x4ef0d4 : active ? 0x82aaff : 0x334155;
      this.progressGfx.fillStyle(col, done ? 0.9 : active ? 0.75 : 0.35);
      this.progressGfx.fillRoundedRect(x, y, dotW, 6, 3);
      if (active) {
        this.progressGfx.lineStyle(2, 0x4ef0d4, 0.5);
        this.progressGfx.strokeRoundedRect(x - 2, y - 2, dotW + 4, 10, 4);
      }
      x += dotW + gap;
    }
  }

  _renderWord(word, progress) {
    const w = word || "";
    const p = Math.max(0, Math.min(w.length, progress || 0));
    this.typedTxt.setText(w.slice(0, p));
    this.remainTxt.setText(w.slice(p));
    const total = this.typedTxt.width + this.remainTxt.width;
    const sx = -total / 2;
    this.typedTxt.setX(sx);
    this.remainTxt.setX(sx + this.typedTxt.width);
  }

  _shakeWord() {
    this.tweens.killTweensOf(this.wordCont);
    const bx = W / 2;
    this.tweens.add({
      targets: this.wordCont,
      x: { from: bx - 14, to: bx + 14 },
      yoyo: true, repeat: 2, duration: 55, ease: "sine.inOut",
      onComplete: () => { this.wordCont.x = bx; },
    });
    const orig = this.remainTxt.style.color;
    this.remainTxt.setColor("#ff6b6b");
    this.time.delayedCall(220, () => this.remainTxt?.setColor(orig));
    this.cameras.main.shake(80, 0.004);
  }

  _spawnLetterSpark(x, y) {
    for (let i = 0; i < 6; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = 12 + Math.random() * 28;
      const p = this.add.circle(x, y, 3 + Math.random() * 2, 0x4ef0d4, 0.95).setBlendMode(Phaser.BlendModes.ADD).setDepth(30);
      this.tweens.add({
        targets: p,
        x: x + Math.cos(a) * d,
        y: y + Math.sin(a) * d,
        alpha: 0,
        scale: 0.2,
        duration: 280 + Math.random() * 120,
        ease: "cubic.out",
        onComplete: () => p.destroy(),
      });
    }
    const flash = this.add.circle(x, y, 8, 0xffffff, 0.7).setBlendMode(Phaser.BlendModes.ADD).setDepth(29);
    this.tweens.add({ targets: flash, scale: 2.2, alpha: 0, duration: 200, onComplete: () => flash.destroy() });
  }

  _showFlash(text, color = "#86efac") {
    this.tweens.killTweensOf(this.flashTxt);
    this.flashTxt.setText(text).setColor(color).setAlpha(1).setScale(1);
    this.tweens.add({
      targets: this.flashTxt,
      y: 250,
      alpha: 0,
      scale: 1.15,
      duration: 1100,
      ease: "cubic.out",
      onComplete: () => { this.flashTxt.y = 280; this.flashTxt.setAlpha(0).setScale(1); },
    });
  }

  _stepTransition() {
    this.cameras.main.flash(180, 78, 240, 212);
    this.overlayTxt.setText("✓").setColor("#4ef0d4").setAlpha(1).setScale(0.5);
    this.tweens.add({
      targets: this.overlayTxt,
      scale: 1.2,
      alpha: 0,
      duration: 500,
      ease: "back.out",
      onComplete: () => this.overlayTxt.setAlpha(0).setScale(1),
    });
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const p = this.add.circle(this.charX, this.charY, 4, 0x4ef0d4, 0.9).setBlendMode(Phaser.BlendModes.ADD).setDepth(28);
      this.tweens.add({
        targets: p,
        x: this.charX + Math.cos(a) * (60 + Math.random() * 40),
        y: this.charY + Math.sin(a) * (60 + Math.random() * 40),
        alpha: 0,
        duration: 450,
        ease: "cubic.out",
        onComplete: () => p.destroy(),
      });
    }
  }

  _spawnOrb() {
    const x = Phaser.Math.Between(80, 1200);
    const core = this.add.circle(x, -12, 9, 0xff3d9f, 0.95).setBlendMode(Phaser.BlendModes.ADD).setDepth(6);
    const glow = this.add.circle(x, -12, 16, 0xff6b9d, 0.25).setBlendMode(Phaser.BlendModes.ADD).setDepth(5);
    const trail = this.add.circle(x, -12, 5, 0xff9ec8, 0.5).setBlendMode(Phaser.BlendModes.ADD).setDepth(5);
    core._vy = Phaser.Math.Between(130, 210);
    core._glow = glow;
    core._trail = trail;
    this.orbs.push(core);
  }

  _damageBoss(amt) {
    this.bossHP = Math.max(0, this.bossHP - amt);
    this.bossHpTxt.setText(`Training Golem · ${this.bossHP} HP`);
    const dmg = this.add.text(640, 100, `−${amt}`, {
      fontFamily: FONT, fontSize: "24px", color: "#ff9ec8", fontStyle: "bold",
    }).setOrigin(0.5).setDepth(40);
    this.tweens.add({ targets: dmg, y: 60, alpha: 0, duration: 700, ease: "cubic.out", onComplete: () => dmg.destroy() });
    this.tweens.add({ targets: this.dummyBoss, scale: { from: 1, to: 0.92 }, duration: 80, yoyo: true, ease: "sine.out" });
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * Math.PI * 2;
      const p = this.add.circle(640, 140, 4, 0xff6b9d, 0.9).setBlendMode(Phaser.BlendModes.ADD).setDepth(12);
      this.tweens.add({
        targets: p,
        x: 640 + Math.cos(a) * (30 + Math.random() * 50),
        y: 140 + Math.sin(a) * (30 + Math.random() * 50),
        alpha: 0,
        duration: 400,
        onComplete: () => p.destroy(),
      });
    }
  }

  _loadStep(idx) {
    this.stepIdx = idx;
    this.orbs.forEach((o) => {
      o._glow?.destroy();
      o._trail?.destroy();
      o.destroy();
    });
    this.orbs = [];
    this.hazardFill?.destroy();
    this.hazardRing?.destroy();
    this.hazardFill = null;
    this.hazardRing = null;
    if (this.hazardTween) { this.hazardTween.stop(); this.hazardTween = null; }
    if (this.stepTimer) { this.stepTimer.remove(); this.stepTimer = null; }

    const step = STEPS[idx];
    this.titleTxt.setText(step.title);
    this.panelTxt.setText(step.instruction);
    this._drawStepProgress();

    this.word = "";
    this.typedProgress = 0;
    this._renderWord("", 0);
    this.weaponHeld = false;
    this.weapon.setVisible(false);
    this.weaponGlow.setVisible(false);
    this.dummyBoss.setVisible(false);
    this.bossEye.setVisible(false);
    this.bossHpTxt.setVisible(false);

    if (step.goal === "survive") {
      this._showFlash("Dodge!", "#4ef0d4");
      this.stepTimer = this.time.delayedCall(step.duration, () => { this._stepTransition(); this._next(); });
    } else if (step.goal === "type") {
      this.word = step.words[0];
      this._wordsLeft = [...step.words];
      this._renderWord(this.word, 0);
      this.dummyBoss.setVisible(true);
      this.bossEye.setVisible(true);
    } else if (step.goal === "weapon") {
      this.weapon.setVisible(true);
      this.weaponGlow.setVisible(true);
      this.word = "strike";
      this._renderWord(this.word, 0);
      this.dummyBoss.setVisible(true);
      this.bossEye.setVisible(true);
    } else if (step.goal === "combo") {
      this.word = "focus";
      this._renderWord(this.word, 0);
      this._showFlash("Move + Type!", "#c084fc");
      this.stepTimer = this.time.delayedCall(step.duration, () => { this._stepTransition(); this._next(); });
    } else if (step.goal === "hazard") {
      const hx = 640; const hy = 450; const r = 90;
      this.hazardFill = this.add.circle(hx, hy, r, 0xd946ef, 0.22).setDepth(4);
      this.hazardRing = this.add.circle(hx, hy, r, 0, 0).setStrokeStyle(4, 0xd946ef, 0.95).setDepth(5);
      const warn = this.add.text(hx, hy - r - 20, "⚠ GET OUT!", {
        fontFamily: FONT, fontSize: "16px", color: "#fae8ff", fontStyle: "bold",
        backgroundColor: "rgba(45,10,86,0.85)", padding: { x: 10, y: 5 },
      }).setOrigin(0.5).setDepth(12);
      this.hazardTween = this.tweens.add({
        targets: [this.hazardFill, this.hazardRing],
        scale: { from: 1, to: 1.08 },
        alpha: { from: 0.9, to: 0.4 },
        duration: 320,
        yoyo: true,
        repeat: -1,
      });
      this.stepTimer = this.time.delayedCall(2800, () => {
        warn.destroy();
        const dx = this.charX - hx; const dy = this.charY - hy;
        if (dx * dx + dy * dy < r * r) {
          this._flashCharHit();
          this.panelTxt.setText("Caught in the zone! Step outside the circle.");
          this.time.delayedCall(1600, () => this._loadStep(idx));
        } else {
          this.cameras.main.flash(200, 180, 50, 220);
          this._stepTransition();
          this._next();
        }
      });
    } else if (step.goal === "boss") {
      this.bossHP = step.bossHP;
      this.dummyBoss.setVisible(true);
      this.bossEye.setVisible(true);
      this.bossHpTxt.setVisible(true).setText(`Training Golem · ${this.bossHP} HP`);
      this.word = "victory";
      this._renderWord(this.word, 0);
    }
  }

  _flashCharHit() {
    this.tweens.killTweensOf(this.charHit);
    this.charHit.setPosition(this.charX, this.charY).setAlpha(0.9).setScale(1);
    this.tweens.add({
      targets: this.charHit,
      alpha: 0,
      scale: { from: 1, to: 1.7 },
      duration: 380,
      ease: "cubic.out",
      onComplete: () => this.charHit?.setScale(1),
    });
    this.cameras.main.shake(160, 0.008);
  }

  _next() {
    if (this.stepIdx >= STEPS.length - 1) this._finish();
    else this._loadStep(this.stepIdx + 1);
  }

  _finish() {
    this.input.keyboard.off("keydown", this._onKey);
    try { localStorage.setItem("typeduo_tutorial_complete", "true"); } catch (_) {}
    this.overlayTxt.setText("TUTORIAL\nCOMPLETE!").setColor("#4ade80").setAlpha(1).setVisible(true);
    this.cameras.main.flash(500, 60, 240, 180);
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = 80 + Math.random() * 320;
      const p = this.add.circle(W / 2, H / 2, 4 + Math.random() * 4, 0x4ef0d4, 0.95).setBlendMode(Phaser.BlendModes.ADD).setDepth(45);
      this.tweens.add({
        targets: p,
        x: W / 2 + Math.cos(a) * d,
        y: H / 2 + Math.sin(a) * d,
        alpha: 0,
        duration: 800 + Math.random() * 400,
        ease: "cubic.out",
        onComplete: () => p.destroy(),
      });
    }
    this.time.delayedCall(1400, () => this.onComplete?.());
  }

  _handleKey(e) {
    const key = String(e.key || "").toLowerCase();
    const step = STEPS[this.stepIdx];
    if (!["type", "weapon", "combo", "boss"].includes(step.goal)) return;
    if (key.length !== 1 || !/[a-z]/.test(key)) return;
    if (step.goal === "weapon" && !this.weaponHeld) return;

    const letterX = this.wordCont.x + this.typedTxt.x + this.typedTxt.width - 8;
    const letterY = this.wordCont.y;

    if (key === this.word[this.typedProgress]) {
      this.typedProgress++;
      this._renderWord(this.word, this.typedProgress);
      this._spawnLetterSpark(letterX, letterY);
      this.tweens.add({ targets: this.wordCont, scale: { from: 1.04, to: 1 }, duration: 90, ease: "sine.out" });

      if (this.typedProgress >= this.word.length) {
        if (step.goal === "type") {
          this._damageBoss(12);
          if (this._wordsLeft.length > 1) {
            this._wordsLeft.shift();
            this.word = this._wordsLeft[0];
            this.typedProgress = 0;
            this._renderWord(this.word, 0);
            this._showFlash("Nice!", "#86efac");
          } else {
            this._showFlash("Word mastery!", "#4ef0d4");
            this.time.delayedCall(600, () => { this._stepTransition(); this._next(); });
          }
        } else if (step.goal === "boss") {
          this._damageBoss(20);
          if (this.bossHP <= 0) {
            this._showFlash("GOLEM DEFEATED!", "#4ade80");
            this.time.delayedCall(800, () => this._finish());
          } else {
            this.word = ["strike", "dodge", "power"][Math.floor(Math.random() * 3)];
            this.typedProgress = 0;
            this._renderWord(this.word, 0);
          }
        } else {
          this._showFlash("Perfect!", "#86efac");
          this.time.delayedCall(500, () => { this._stepTransition(); this._next(); });
        }
      }
    } else {
      this._shakeWord();
    }
  }

  update(_t, delta) {
    const dt = delta / 1000;

    this.stars.forEach((st) => {
      st.sprite.x += st.vx * dt;
      st.sprite.y += st.vy * dt;
      if (st.sprite.x < -8) st.sprite.x = W + 8;
      if (st.sprite.x > W + 8) st.sprite.x = -8;
      if (st.sprite.y < -8) st.sprite.y = H + 8;
      if (st.sprite.y > H + 8) st.sprite.y = -8;
      st.phase += dt * 1.5;
      st.sprite.alpha = st.base + Math.sin(st.phase) * 0.18;
    });

    const vel = 290 * dt;
    let nx = this.charX; let ny = this.charY;
    let ddx = 0; let ddy = 0;
    if (this.cursors.left.isDown || this.keys.A.isDown) { nx -= vel; ddx -= 1; }
    if (this.cursors.right.isDown || this.keys.D.isDown) { nx += vel; ddx += 1; }
    if (this.cursors.up.isDown || this.keys.W.isDown) { ny -= vel; ddy -= 1; }
    if (this.cursors.down.isDown || this.keys.S.isDown) { ny += vel; ddy += 1; }
    nx = Phaser.Math.Clamp(nx, 30, 1250);
    ny = Phaser.Math.Clamp(ny, 200, 590);
    this.charX = nx;
    this.charY = ny;
    this.charGlow.setPosition(nx, ny);
    this.charRing.setPosition(nx, ny);
    this.charBody.setPosition(nx, ny);
    this.charHit.setPosition(nx, ny);

    const step = STEPS[this.stepIdx];
    if (step.goal === "weapon" && this.weapon.visible) {
      const dx = nx - this.weapon.x;
      const dy = ny - this.weapon.y;
      if (dx * dx + dy * dy < 44 * 44) {
        this.weaponHeld = true;
        this.weapon.setVisible(false);
        this.weaponGlow.setVisible(false);
        this.cameras.main.flash(200, 255, 200, 100);
        this._showFlash("Weapon equipped!", "#fbbf24");
        this.panelTxt.setText("Type STRIKE to attack!");
      }
    }

    if (["survive", "combo"].includes(step.goal)) {
      this._orbTimer += delta;
      if (this._orbTimer > 650) {
        this._orbTimer = 0;
        this._spawnOrb();
      }
      this.orbs = this.orbs.filter((o) => {
        o.y += o._vy * dt;
        o._glow?.setPosition(o.x, o.y);
        o._trail?.setPosition(o.x, o.y - 10);
        if (o.y > H + 24) {
          o._glow?.destroy();
          o._trail?.destroy();
          o.destroy();
          return false;
        }
        const dx = nx - o.x;
        const dy = ny - o.y;
        if (dx * dx + dy * dy < 22 * 22) {
          this._flashCharHit();
          o._glow?.destroy();
          o._trail?.destroy();
          o.destroy();
          return false;
        }
        return true;
      });
    }
  }

  shutdown() {
    this.input.keyboard?.off("keydown", this._onKey);
    this.orbs.forEach((o) => { o._glow?.destroy(); o._trail?.destroy(); o.destroy(); });
    this.stars.forEach((s) => s.sprite?.destroy());
  }
}
