import Phaser from "phaser";

const W = 1280;
const H = 720;
const FONT = '"Outfit","Inter","Segoe UI",system-ui,sans-serif';
const MONO = '"JetBrains Mono","Fira Code",Consolas,monospace';

const STEPS = [
  { title: "Step 1 — Move", instruction: "Use ARROW KEYS or WASD to dodge the orbs. Survive 8 seconds!", goal: "survive", duration: 8000 },
  { title: "Step 2 — Type", instruction: "Type the word shown below. Each letter damages the dummy boss.", goal: "type", words: ["run", "dodge", "type"] },
  { title: "Step 3 — Weapon", instruction: "Walk over the glowing weapon, then type to deal real damage.", goal: "weapon" },
  { title: "Step 4 — Dodge + Type", instruction: "Orbs spawn while you type. Keep moving!", goal: "combo", duration: 12000 },
  { title: "Step 5 — Hazard Zone", instruction: "Leave the purple zone before it explodes!", goal: "hazard" },
  { title: "Step 6 — Ready!", instruction: "Defeat the training golem. You're ready for battle!", goal: "boss", bossHP: 80 },
];

export default class TutorialScene extends Phaser.Scene {
  constructor() { super("TutorialScene"); }

  init(data) { this.onComplete = data?.onComplete; this.onExit = data?.onExit; }

  create() {
    this.stepIdx = 0;
    this.orbs = [];
    this.typedProgress = 0;
    this.word = "";
    this.weaponHeld = false;
    this.bossHP = 999;
    this.charX = 640; this.charY = 490;
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys("W,S,A,D");
    this._orbTimer = 0;

    this.add.rectangle(W / 2, H / 2, W, H, 0x0a1124);
    this.panelTxt = this.add.text(24, 20, "", { fontFamily: FONT, fontSize: "18px", color: "#e8ecff", wordWrap: { width: 500 } }).setDepth(30);
    this.titleTxt = this.add.text(W / 2, 56, "", { fontFamily: FONT, fontSize: "22px", color: "#4ef0d4", fontStyle: "bold" }).setOrigin(0.5).setDepth(30);
    this.charBody = this.add.circle(640, 490, 12, 0xffffff).setStrokeStyle(2, 0x4ef0d4).setDepth(10);
    this.wordTxt = this.add.text(W / 2, H - 80, "", { fontFamily: MONO, fontSize: "36px", color: "#4ef0d4" }).setOrigin(0.5).setDepth(25);
    this.weapon = this.add.circle(400, 450, 14, 0xfbbf24, 0.9).setStrokeStyle(2, 0xffffff).setDepth(8).setVisible(false);
    this.dummyBoss = this.add.circle(640, 140, 40, 0x5b1130).setStrokeStyle(3, 0xff6b9d).setDepth(8).setVisible(false);
    this.bossHpTxt = this.add.text(640, 200, "", { fontFamily: FONT, fontSize: "14px", color: "#cdd5ff" }).setOrigin(0.5).setDepth(30).setVisible(false);
    this.skipBtn = this.add.text(W - 24, 24, "Skip tutorial →", { fontFamily: FONT, fontSize: "14px", color: "#94a3b8" }).setOrigin(1, 0).setInteractive({ useHandCursor: true }).setDepth(40);
    this.skipBtn.on("pointerdown", () => this._finish());
    this._onKey = (e) => this._handleKey(e);
    this.input.keyboard.on("keydown", this._onKey);
    this._loadStep(0);
  }

  _loadStep(idx) {
    this.stepIdx = idx;
    this.orbs.forEach((o) => o.destroy());
    this.orbs = [];
    this.hazardGfx?.clear();
    if (this.hazardTween) { this.hazardTween.stop(); this.hazardTween = null; }
    if (this.stepTimer) { this.stepTimer.remove(); this.stepTimer = null; }

    const step = STEPS[idx];
    this.titleTxt.setText(step.title);
    this.panelTxt.setText(step.instruction);
    this.word = "";
    this.typedProgress = 0;
    this.wordTxt.setText("");
    this.weaponHeld = false;
    this.weapon.setVisible(false);
    this.dummyBoss.setVisible(false);
    this.bossHpTxt.setVisible(false);

    if (step.goal === "survive") {
      this.stepTimer = this.time.delayedCall(step.duration, () => this._next());
    } else if (step.goal === "type") {
      this.word = step.words[0];
      this._wordsLeft = [...step.words];
      this.wordTxt.setText(this.word);
      this.dummyBoss.setVisible(true).setAlpha(0.5);
    } else if (step.goal === "weapon") {
      this.weapon.setVisible(true);
      this.word = "strike";
      this.wordTxt.setText(this.word);
      this.dummyBoss.setVisible(true);
    } else if (step.goal === "combo") {
      this.word = "focus";
      this.wordTxt.setText(this.word);
      this.stepTimer = this.time.delayedCall(step.duration, () => this._next());
    } else if (step.goal === "hazard") {
      this.hazardGfx = this.add.graphics().setDepth(5);
      const hx = 640; const hy = 450; const r = 90;
      this.hazardGfx.fillStyle(0xd946ef, 0.25);
      this.hazardGfx.fillCircle(hx, hy, r);
      this.hazardGfx.lineStyle(3, 0xd946ef, 0.9);
      this.hazardGfx.strokeCircle(hx, hy, r);
      this.stepTimer = this.time.delayedCall(2500, () => {
        const dx = this.charX - hx; const dy = this.charY - hy;
        if (dx * dx + dy * dy < r * r) {
          this.panelTxt.setText("Hit by the zone! Move out next time — try again.");
          this.time.delayedCall(1500, () => this._loadStep(idx));
        } else {
          this._next();
        }
      });
    } else if (step.goal === "boss") {
      this.bossHP = step.bossHP;
      this.dummyBoss.setVisible(true);
      this.bossHpTxt.setVisible(true).setText(`Training Golem: ${this.bossHP} HP`);
      this.word = "victory";
      this.wordTxt.setText(this.word);
    }
  }

  _next() {
    if (this.stepIdx >= STEPS.length - 1) this._finish();
    else this._loadStep(this.stepIdx + 1);
  }

  _finish() {
    this.input.keyboard.off("keydown", this._onKey);
    try { localStorage.setItem("typeduo_tutorial_complete", "true"); } catch (_) {}
    this.onComplete?.();
  }

  _handleKey(e) {
    const key = String(e.key || "").toLowerCase();
    const step = STEPS[this.stepIdx];
    if (step.goal === "type" || step.goal === "weapon" || step.goal === "combo" || step.goal === "boss") {
      if (key.length === 1 && /[a-z]/.test(key)) {
        if (step.goal === "weapon" && !this.weaponHeld) return;
        if (key === this.word[this.typedProgress]) {
          this.typedProgress++;
          this.wordTxt.setText(this.word.slice(0, this.typedProgress) + this.word.slice(this.typedProgress));
          if (this.typedProgress >= this.word.length) {
            if (step.goal === "type" && this._wordsLeft.length > 1) {
              this._wordsLeft.shift();
              this.word = this._wordsLeft[0];
              this.typedProgress = 0;
              this.wordTxt.setText(this.word);
            } else if (step.goal === "boss") {
              this.bossHP = Math.max(0, this.bossHP - 20);
              this.bossHpTxt.setText(`Training Golem: ${this.bossHP} HP`);
              if (this.bossHP <= 0) this._next();
              else { this.word = ["strike", "dodge", "power"][Math.floor(Math.random() * 3)]; this.typedProgress = 0; this.wordTxt.setText(this.word); }
            } else this._next();
          }
        }
      }
    }
  }

  update(_t, delta) {
    const dt = delta / 1000;
    const vel = 280 * dt;
    let nx = this.charX; let ny = this.charY;
    if (this.cursors.left.isDown || this.keys.A.isDown) nx -= vel;
    if (this.cursors.right.isDown || this.keys.D.isDown) nx += vel;
    if (this.cursors.up.isDown || this.keys.W.isDown) ny -= vel;
    if (this.cursors.down.isDown || this.keys.S.isDown) ny += vel;
    nx = Phaser.Math.Clamp(nx, 30, 1250);
    ny = Phaser.Math.Clamp(ny, 200, 590);
    this.charX = nx; this.charY = ny;
    this.charBody.setPosition(nx, ny);

    const step = STEPS[this.stepIdx];
    if (step.goal === "weapon" && this.weapon.visible) {
      const dx = nx - this.weapon.x; const dy = ny - this.weapon.y;
      if (dx * dx + dy * dy < 40 * 40) { this.weaponHeld = true; this.weapon.setVisible(false); this.panelTxt.setText("Weapon equipped! Type STRIKE."); }
    }

    if (["survive", "combo"].includes(step.goal)) {
      this._orbTimer += delta;
      if (this._orbTimer > 700) {
        this._orbTimer = 0;
        const orb = this.add.circle(Phaser.Math.Between(80, 1200), -10, 8, 0xff6b9d).setDepth(6);
        orb._vy = Phaser.Math.Between(120, 200);
        this.orbs.push(orb);
      }
      this.orbs = this.orbs.filter((o) => {
        o.y += o._vy * dt;
        if (o.y > H + 20) { o.destroy(); return false; }
        const dx = nx - o.x; const dy = ny - o.y;
        if (dx * dx + dy * dy < 24 * 24) {
          this.panelTxt.setText("Hit! Keep moving — orbs are slow, you can dodge.");
          o.destroy();
          return false;
        }
        return true;
      });
    }
  }

  shutdown() {
    this.input.keyboard?.off("keydown", this._onKey);
    this.orbs.forEach((o) => o.destroy());
  }
}
