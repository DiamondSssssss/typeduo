import Phaser from "phaser";
import { BOSS_VISUALS, PROJ_VISUALS, ATTACK_LABELS } from "./bosses/bossConfigs";

// ── Scene constants ───────────────────────────────────────────────────────────
const W = 1280;
const H = 720;
const GRID = 40;
const FONT = '"Outfit","Inter","Segoe UI",system-ui,sans-serif';
const MONO = '"JetBrains Mono","Fira Code","SF Mono",Consolas,monospace';

const hexPts = (r, angle0 = 0) => {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const a = angle0 + (i / 6) * Math.PI * 2;
    pts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
  }
  return pts;
};

const diamondPts = (r) => [
  { x: 0,        y: -r        },
  { x: r * 0.55, y: -r * 0.38 },
  { x: r,        y: 0         },
  { x: r * 0.55, y:  r * 0.38 },
  { x: 0,        y:  r        },
  { x: -r * 0.55,y:  r * 0.38 },
  { x: -r,       y: 0         },
  { x: -r * 0.55,y: -r * 0.38 },
];

// Regular octagon rotated by 22.5° for the crystal/glacier boss
const octaPts = (r) => {
  const pts = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    pts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
  }
  return pts;
};

// ─────────────────────────────────────────────────────────────────────────────
export default class MainScene extends Phaser.Scene {
  constructor() {
    super("MainScene");
    // character state
    this.charX = 640; this.charY = 490;
    this.charTargetX = 640; this.charTargetY = 490;
    // boss state
    this.bossX = 640; this.bossY = 110;
    this.bossTX = 640; this.bossTY = 110;
    this.bossAuraAngle = 0;
    this.bossVisual = null;   // current BOSS_VISUALS entry
    this.bossPhaseIdx = 0;
    // input
    this.isRunner = false;
    this.keys = null;
    this.localTypedProgress = 0;
    this.expectedWord = "";
    this.lastSentAt = 0;
    // misc
    this.stars = [];
    this.projectileSprites = new Map();
    this.bossHP = 250; this.bossMaxHP = 250;
    this.bossState = "countdown";
    this.bossAttackType = "normal";
    this.bossWindingUp = false;
    this.bossWindUpAttack = null;
    this.bossWindUpRemaining = 0;
    this.streak = 0;
    this.countdownTimer = null;
    this.roarTimer = null;
    this.windUpBarTween = null;
    // Weapon
    this.weaponHeld = false;
    this.weaponBobTween = null;
  }

  init(data) {
    this.socket  = data.socket;
    this.payload = data.gamePayload;
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  create() {
    this.cameras.main.setBackgroundColor(0x04060f);
    this._drawArena();
    this._createStars();
    this._createBoss();
    this._createCharacter();
    this._createUI();
    this._createColumnLayer();
    this._createWeapon();
    this._populateFromPayload();
    this._bindKeyboard();
    this._bindSocket();
    this._handleInitialCountdown();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this._shutdown, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this._shutdown, this);
  }

  // ── Arena ──────────────────────────────────────────────────────────────────
  _drawArena() {
    const g = this.add.graphics();
    g.fillStyle(0x04060f, 1);
    g.fillRect(0, 0, W, H);
    g.lineStyle(1, 0x1a2347, 0.5);
    for (let x = 0; x <= W; x += GRID) g.lineBetween(x, 0, x, H);
    for (let y = 0; y <= H; y += GRID) g.lineBetween(0, y, W, y);
    const b = this.add.graphics();
    b.lineStyle(2, 0x2a3567, 0.4);
    b.strokeRect(22, 62, W - 44, H - 124);
    const v = this.add.graphics();
    v.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.65, 0.65, 0, 0);
    v.fillRect(0, 0, W, 95);
  }

  _createStars() {
    for (let i = 0; i < 40; i++) {
      const s = this.add.circle(Math.random() * W, Math.random() * H, Math.random() < 0.7 ? 1 : 1.7, 0x6f8aff, 0.55);
      s.setBlendMode(Phaser.BlendModes.ADD).setDepth(1);
      const dir = Math.random() * Math.PI * 2;
      const spd = 6 + Math.random() * 18;
      this.stars.push({ sprite: s, vx: Math.cos(dir) * spd * 0.28, vy: Math.sin(dir) * spd * 0.28, base: 0.3 + Math.random() * 0.55, phase: Math.random() * Math.PI * 2 });
    }
  }

  // ── Boss drawing ───────────────────────────────────────────────────────────
  _createBoss() {
    this.bossAuraGfx  = this.add.graphics().setDepth(7);
    this.bossCont     = this.add.container(640, 110).setDepth(9);
    this.bossBorderGfx = this.add.graphics();
    this.bossBodyGfx   = this.add.graphics();
    this.bossExtraGfx  = this.add.graphics(); // tendrils / wings / extra
    this.bossEyeGfx    = this.add.graphics();
    this.bossLabel     = this.add.text(0, 0, "BOSS", { fontFamily: FONT, fontSize: "20px", color: "#ffffff", fontStyle: "bold" }).setOrigin(0.5);
    this.bossFlash     = this.add.graphics().setDepth(10);
    this.bossCont.add([this.bossBorderGfx, this.bossBodyGfx, this.bossExtraGfx, this.bossEyeGfx, this.bossLabel]);

    this.bossPulse = this.tweens.add({ targets: this.bossCont, scale: { from: 1, to: 1.06 }, duration: 1200, yoyo: true, repeat: -1, ease: "sine.inOut" });

    // Fixed HP bar at top
    this.bossHpBack = this.add.graphics().setDepth(11);
    this.bossHpFill = this.add.graphics().setDepth(11);
    this.bossHpText = this.add.text(W / 2, 142, "", { fontFamily: MONO, fontSize: "12px", color: "#cdd5ff" }).setOrigin(0.5).setDepth(11);
  }

  _drawBossShape(isRoar = false, isStun = false) {
    const vis = this.bossVisual || BOSS_VISUALS.watcher;
    const col = isRoar ? vis.roar : isStun ? vis.stun : vis.phases[this.bossPhaseIdx] || vis.phases[0];
    const S   = vis.size || { body: 60, border: 78 };

    this.bossBorderGfx.clear();
    this.bossBodyGfx.clear();
    this.bossExtraGfx.clear();
    this.bossEyeGfx.clear();

    if (vis.shape === "hex") {
      this._drawHexBoss(col, S, isRoar || isStun);
    } else if (vis.shape === "diamond") {
      this._drawDiamondBoss(col, S, isRoar || isStun);
    } else if (vis.shape === "spider") {
      this._drawSpiderBoss(col, S, isRoar || isStun);
    } else if (vis.shape === "flame") {
      this._drawFlameBoss(col, S, isRoar || isStun);
    } else if (vis.shape === "crystal") {
      this._drawCrystalBoss(col, S, isRoar || isStun);
    }

    if (this.bossLabel) this.bossLabel.setText(vis.label || "BOSS");
  }

  _drawHexBoss(col, S, alt) {
    const R = S.body, R2 = S.border;
    this.bossBorderGfx.fillStyle(col.body, 0.22);
    this.bossBorderGfx.fillPoints(hexPts(R2, Math.PI / 6), true);
    this.bossBorderGfx.lineStyle(4, col.border, 0.95);
    this.bossBorderGfx.strokePoints(hexPts(R2, Math.PI / 6), true, true);
    this.bossBorderGfx.lineStyle(1.5, col.border, 0.3);
    this.bossBorderGfx.strokePoints(hexPts(R2 + 8, Math.PI / 6), true, true);

    this.bossBodyGfx.fillStyle(col.body, 0.95);
    this.bossBodyGfx.fillPoints(hexPts(R, Math.PI / 6), true);
    this.bossBodyGfx.fillStyle(col.outer, 0.5);
    this.bossBodyGfx.fillPoints(hexPts(R * 0.65, Math.PI / 6), true);

    this.bossEyeGfx.fillStyle(col.eye, 0.98);
    this.bossEyeGfx.fillCircle(-20, -8, 8);
    this.bossEyeGfx.fillCircle(20, -8, 8);
    this.bossEyeGfx.fillStyle(0x000000, 0.8);
    this.bossEyeGfx.fillCircle(-18, -7, 4);
    this.bossEyeGfx.fillCircle(22, -7, 4);
    this.bossEyeGfx.fillStyle(col.core, 0.85);
    this.bossEyeGfx.fillCircle(0, 14, 11);
    this.bossEyeGfx.fillStyle(0xffffff, 0.55);
    this.bossEyeGfx.fillCircle(0, 14, 5);
  }

  _drawDiamondBoss(col, S, alt) {
    const R = S.body, R2 = S.border;
    const pts  = diamondPts(R);
    const pts2 = diamondPts(R2);

    this.bossBorderGfx.fillStyle(col.body, 0.2);
    this.bossBorderGfx.fillPoints(pts2, true);
    this.bossBorderGfx.lineStyle(3.5, col.border, 0.95);
    this.bossBorderGfx.strokePoints(pts2, true, true);
    this.bossBorderGfx.lineStyle(1.2, col.border, 0.3);
    this.bossBorderGfx.strokePoints(diamondPts(R2 + 9), true, true);

    this.bossBodyGfx.fillStyle(col.body, 0.95);
    this.bossBodyGfx.fillPoints(pts, true);
    this.bossBodyGfx.fillStyle(col.outer, 0.55);
    this.bossBodyGfx.fillPoints(diamondPts(R * 0.6), true);

    // Wing-like horizontal lines
    this.bossExtraGfx.lineStyle(2.5, col.border, 0.55);
    this.bossExtraGfx.lineBetween(-R * 1.2, 0, -R, 0);
    this.bossExtraGfx.lineBetween( R,       0,  R * 1.2, 0);
    this.bossExtraGfx.lineStyle(1.5, col.border, 0.3);
    this.bossExtraGfx.lineBetween(-R * 1.4, -10, -R * 1.1, -4);
    this.bossExtraGfx.lineBetween( R * 1.1, -4,   R * 1.4, -10);

    // Narrow horizontal "eyes"
    this.bossEyeGfx.fillStyle(col.eye, 0.98);
    this.bossEyeGfx.fillRect(-22, -9, 18, 6);
    this.bossEyeGfx.fillRect(  4, -9, 18, 6);
    this.bossEyeGfx.fillStyle(col.core, 0.9);
    this.bossEyeGfx.fillCircle(0, 10, 10);
    this.bossEyeGfx.fillStyle(0xffffff, 0.5);
    this.bossEyeGfx.fillCircle(0, 10, 4);
  }

  _drawSpiderBoss(col, S, alt) {
    const R = S.body, R2 = S.border;

    // Tendrils (8 radial lines) at full opacity
    this.bossExtraGfx.lineStyle(3, col.border, 0.65);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const x1 = Math.cos(a) * R;
      const y1 = Math.sin(a) * R;
      const x2 = Math.cos(a) * R2;
      const y2 = Math.sin(a) * R2;
      this.bossExtraGfx.lineBetween(x1, y1, x2, y2);
    }
    this.bossExtraGfx.lineStyle(1.2, col.border, 0.3);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      const x2 = Math.cos(a) * (R2 * 0.8);
      const y2 = Math.sin(a) * (R2 * 0.8);
      this.bossExtraGfx.lineBetween(0, 0, x2, y2);
    }

    // Body circle
    this.bossBorderGfx.lineStyle(3.5, col.border, 0.9);
    this.bossBorderGfx.strokeCircle(0, 0, R2);
    this.bossBorderGfx.lineStyle(1.2, col.border, 0.3);
    this.bossBorderGfx.strokeCircle(0, 0, R2 + 10);

    this.bossBodyGfx.fillStyle(col.body, 0.95);
    this.bossBodyGfx.fillCircle(0, 0, R);
    this.bossBodyGfx.fillStyle(col.outer, 0.5);
    this.bossBodyGfx.fillCircle(0, 0, R * 0.65);

    // Single large eye
    this.bossEyeGfx.fillStyle(col.eye, 0.98);
    this.bossEyeGfx.fillCircle(0, -4, 16);
    this.bossEyeGfx.fillStyle(0x000000, 0.85);
    this.bossEyeGfx.fillCircle(3, -2, 8);
    this.bossEyeGfx.fillStyle(col.core, 0.9);
    this.bossEyeGfx.fillCircle(0, 14, 8);
    this.bossEyeGfx.fillStyle(0xffffff, 0.55);
    this.bossEyeGfx.fillCircle(0, 14, 3.5);
  }

  _drawFlameBoss(col, S, alt) {
    const R = S.body, R2 = S.border;

    // Outer glow ring
    this.bossBorderGfx.lineStyle(4.5, col.border, 0.9);
    this.bossBorderGfx.strokeCircle(0, 0, R2);
    this.bossBorderGfx.lineStyle(1.5, col.border, 0.3);
    this.bossBorderGfx.strokeCircle(0, 0, R2 + 10);

    // Amorphous blob: overlapping circles to suggest molten mass
    this.bossBodyGfx.fillStyle(col.body, 0.95);
    this.bossBodyGfx.fillCircle(0,   0,   R);
    this.bossBodyGfx.fillStyle(col.outer, 0.75);
    this.bossBodyGfx.fillCircle(-18, -14, R * 0.60);
    this.bossBodyGfx.fillCircle( 16, -16, R * 0.55);
    this.bossBodyGfx.fillStyle(col.outer, 0.55);
    this.bossBodyGfx.fillCircle( -8,  18, R * 0.65);
    this.bossBodyGfx.fillCircle( 22,  12, R * 0.45);

    // Molten inner glow
    this.bossBodyGfx.fillStyle(col.eye, 0.30);
    this.bossBodyGfx.fillCircle(0, 0, R * 0.50);

    // Aggressive twin eyes
    this.bossEyeGfx.fillStyle(col.eye, 0.98);
    this.bossEyeGfx.fillCircle(-17, -9, 8);
    this.bossEyeGfx.fillCircle( 17, -9, 8);
    this.bossEyeGfx.fillStyle(0x000000, 0.82);
    this.bossEyeGfx.fillCircle(-15, -8, 4.5);
    this.bossEyeGfx.fillCircle( 19, -8, 4.5);
    // Molten core
    this.bossEyeGfx.fillStyle(col.core, 0.9);
    this.bossEyeGfx.fillCircle(0, 12, 10);
    this.bossEyeGfx.fillStyle(0xffffff, 0.45);
    this.bossEyeGfx.fillCircle(0, 12, 4);
  }

  _drawCrystalBoss(col, S, alt) {
    const R = S.body, R2 = S.border;
    const inner = octaPts(R);
    const outer = octaPts(R2);
    const outerXL = octaPts(R2 + 10);

    // Faint fill behind outer octagon
    this.bossBorderGfx.fillStyle(col.body, 0.20);
    this.bossBorderGfx.fillPoints(outer, true);
    // Outer border strokes
    this.bossBorderGfx.lineStyle(3.5, col.border, 0.95);
    this.bossBorderGfx.strokePoints(outer, true, true);
    this.bossBorderGfx.lineStyle(1.2, col.border, 0.30);
    this.bossBorderGfx.strokePoints(outerXL, true, true);

    // Body fill
    this.bossBodyGfx.fillStyle(col.body, 0.95);
    this.bossBodyGfx.fillPoints(inner, true);
    // Inner highlight facet
    this.bossBodyGfx.fillStyle(col.outer, 0.55);
    this.bossBodyGfx.fillPoints(octaPts(R * 0.55), true);

    // Snowflake / cross lines through the crystal
    this.bossExtraGfx.lineStyle(1.8, col.border, 0.45);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI;
      this.bossExtraGfx.lineBetween(
        Math.cos(a) * R2, Math.sin(a) * R2,
        Math.cos(a + Math.PI) * R2, Math.sin(a + Math.PI) * R2,
      );
    }
    // Diagonal shorter cross
    this.bossExtraGfx.lineStyle(1.0, col.border, 0.28);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI + Math.PI / 8;
      this.bossExtraGfx.lineBetween(
        Math.cos(a) * R * 0.8, Math.sin(a) * R * 0.8,
        Math.cos(a + Math.PI) * R * 0.8, Math.sin(a + Math.PI) * R * 0.8,
      );
    }

    // Dual ice-cold eyes
    this.bossEyeGfx.fillStyle(col.eye, 0.98);
    this.bossEyeGfx.fillCircle(-18, -8, 8);
    this.bossEyeGfx.fillCircle( 18, -8, 8);
    this.bossEyeGfx.fillStyle(0x000000, 0.75);
    this.bossEyeGfx.fillCircle(-16, -7, 4.5);
    this.bossEyeGfx.fillCircle( 20, -7, 4.5);
    // Crystal core shard
    this.bossEyeGfx.fillStyle(col.core, 0.90);
    this.bossEyeGfx.fillCircle(0, 12, 10);
    this.bossEyeGfx.fillStyle(0xffffff, 0.60);
    this.bossEyeGfx.fillCircle(0, 12, 4.5);
  }

  _drawBossAura(dt) {
    this.bossAuraAngle += 36 * dt;
    const ang = this.bossAuraAngle * Math.PI / 180;
    const vis = this.bossVisual || BOSS_VISUALS.watcher;
    const col = vis.auraColors?.[this.bossPhaseIdx] || 0xff6b9d;
    const R3  = (vis.size?.aura || 92);
    this.bossAuraGfx.clear();
    this.bossAuraGfx.x = this.bossX;
    this.bossAuraGfx.y = this.bossY;

    if (vis.shape === "hex") {
      this.bossAuraGfx.lineStyle(2, col, 0.28);
      this.bossAuraGfx.strokePoints(hexPts(R3, ang), true, true);
      this.bossAuraGfx.lineStyle(1.5, col, 0.13);
      this.bossAuraGfx.strokePoints(hexPts(R3 + 10, ang + Math.PI / 6), true, true);
    } else if (vis.shape === "diamond") {
      this.bossAuraGfx.lineStyle(2, col, 0.28);
      const d = diamondPts(R3).map(p => ({ x: p.x * Math.cos(ang) - p.y * Math.sin(ang), y: p.x * Math.sin(ang) + p.y * Math.cos(ang) }));
      this.bossAuraGfx.strokePoints(d, true, true);
    } else if (vis.shape === "crystal") {
      // Slow-rotating octagon aura — looks like a spinning ice crystal
      this.bossAuraGfx.lineStyle(2, col, 0.28);
      const d = octaPts(R3).map(p => ({ x: p.x * Math.cos(ang) - p.y * Math.sin(ang), y: p.x * Math.sin(ang) + p.y * Math.cos(ang) }));
      this.bossAuraGfx.strokePoints(d, true, true);
      this.bossAuraGfx.lineStyle(1.2, col, 0.12);
      const d2 = octaPts(R3 + 10).map(p => ({ x: p.x * Math.cos(-ang * 0.6) - p.y * Math.sin(-ang * 0.6), y: p.x * Math.sin(-ang * 0.6) + p.y * Math.cos(-ang * 0.6) }));
      this.bossAuraGfx.strokePoints(d2, true, true);
    } else {
      // Flame / spider / fallback: pulsing circles
      this.bossAuraGfx.lineStyle(2, col, 0.28);
      this.bossAuraGfx.strokeCircle(0, 0, R3);
      this.bossAuraGfx.lineStyle(1.2, col, 0.13);
      this.bossAuraGfx.strokeCircle(0, 0, R3 + 10);
    }
  }

  _drawBossHpBar(hp, maxHP) {
    const bw = 230, bh = 12, bx = W / 2 - bw / 2, by = 128;
    const pct = Math.max(0, Math.min(1, hp / Math.max(1, maxHP)));
    this.bossHpBack.clear();
    this.bossHpBack.fillStyle(0x1f1230, 0.85);
    this.bossHpBack.fillRoundedRect(bx, by, bw, bh, 5);
    this.bossHpBack.lineStyle(1, (this.bossVisual?.phases?.[0]?.border || 0xff6b9d), 0.65);
    this.bossHpBack.strokeRoundedRect(bx, by, bw, bh, 5);
    this.bossHpFill.clear();
    if (pct > 0) {
      const col = pct > 0.66 ? 0xc026d3 : pct > 0.33 ? 0xea580c : 0xef4444;
      this.bossHpFill.fillStyle(col, 0.95);
      this.bossHpFill.fillRoundedRect(bx + 1, by + 1, (bw - 2) * pct, bh - 2, 4);
    }
    if (this.bossHpText) this.bossHpText.setText(`${Math.round(hp)} / ${maxHP}`);
  }

  _drawTeamHpBar(hp, maxHP) {
    const bw = 200, bh = 10, bx = 16, by = H - 48;
    const pct = Math.max(0, Math.min(1, hp / Math.max(1, maxHP)));
    this.teamHpBack.clear();
    this.teamHpBack.fillStyle(0x1f1230, 0.85);
    this.teamHpBack.fillRoundedRect(bx, by, bw, bh, 4);
    this.teamHpBack.lineStyle(1, 0x4ef0d4, 0.45);
    this.teamHpBack.strokeRoundedRect(bx, by, bw, bh, 4);
    this.teamHpFill.clear();
    if (pct > 0) {
      const col = pct > 0.5 ? 0x4ade80 : pct > 0.25 ? 0xfbbf24 : 0xef4444;
      this.teamHpFill.fillStyle(col, 0.92);
      this.teamHpFill.fillRoundedRect(bx + 1, by + 1, (bw - 2) * pct, bh - 2, 3);
    }
    if (this.teamHpText) this.teamHpText.setText(`Team HP  ${Math.round(hp)} / ${maxHP}`);
  }

  // ── Character ──────────────────────────────────────────────────────────────
  _createCharacter() {
    this.charGlow = this.add.circle(640, 490, 32, 0x4ef0d4, 0.15).setBlendMode(Phaser.BlendModes.ADD).setDepth(5);
    this.charRing = this.add.circle(640, 490, 18, 0xffffff, 0).setStrokeStyle(2.5, 0x4ef0d4, 0.9).setDepth(5);
    this.charBody = this.add.circle(640, 490, 11, 0xffffff, 1).setStrokeStyle(2, 0x4ef0d4, 0.85).setDepth(5);
    this.charHit  = this.add.circle(640, 490, 26, 0xff5577, 0).setBlendMode(Phaser.BlendModes.ADD).setDepth(6);
    this.charArrow = this.add.graphics().setDepth(6);
    const ls = { fontFamily: FONT, fontSize: "11px", color: "#e8ecff", backgroundColor: "rgba(13,18,32,0.75)", padding: { x: 6, y: 2 } };
    this.charLabel1 = this.add.text(640, 456, "", ls).setOrigin(0.5, 1).setDepth(6);
    this.charLabel2 = this.add.text(640, 468, "", ls).setOrigin(0.5, 1).setDepth(6);
    this.tweens.add({ targets: this.charGlow, scale: { from: 1, to: 1.35 }, alpha: { from: 0.35, to: 0.1 }, duration: 1000, yoyo: true, repeat: -1, ease: "sine.inOut" });
  }

  _setCharPos(x, y) {
    [this.charGlow, this.charRing, this.charBody, this.charHit, this.charArrow].forEach(o => o?.setPosition(x, y));
    this.charLabel1?.setPosition(x, y - 30);
    this.charLabel2?.setPosition(x, y - 19);
  }

  _setCharLabels(players) {
    const runner = players.find(p => p.role === "runner");
    const typer  = players.find(p => p.role === "typer");
    this.charLabel1?.setText(runner ? `▶ ${runner.username}` : "").setColor("#4ef0d4");
    this.charLabel2?.setText(typer  ? `⌨ ${typer.username}`  : "").setColor("#c084fc");
  }

  _drawCharArrow(facing) {
    this.charArrow?.clear();
    if (!facing || !this.isRunner) return;
    const mag = Math.sqrt(facing.x ** 2 + facing.y ** 2);
    if (mag < 0.05) return;
    const a = Math.atan2(facing.y, facing.x);
    const [tip, back] = [24, 14];
    const tx = Math.cos(a) * tip, ty = Math.sin(a) * tip;
    this.charArrow.fillStyle(0xffffff, 0.88);
    this.charArrow.beginPath();
    this.charArrow.moveTo(tx, ty);
    this.charArrow.lineTo(Math.cos(a + Math.PI * 0.85) * back, Math.sin(a + Math.PI * 0.85) * back);
    this.charArrow.lineTo(Math.cos(a - Math.PI * 0.85) * back, Math.sin(a - Math.PI * 0.85) * back);
    this.charArrow.closePath();
    this.charArrow.fillPath();
  }

  _flashCharHit() {
    this.tweens.killTweensOf(this.charHit);
    this.charHit.setAlpha(0.9).setScale(1);
    this.tweens.add({ targets: this.charHit, alpha: 0, scale: { from: 1, to: 1.7 }, duration: 380, ease: "cubic.out", onComplete: () => this.charHit?.setScale(1) });
    this.cameras.main.shake(160, 0.008);
  }

  // ── UI ─────────────────────────────────────────────────────────────────────
  _createUI() {
    this.roleBadge = this.add.text(16, 16, "", { fontFamily: FONT, fontSize: "13px", color: "#4ef0d4", backgroundColor: "rgba(13,18,32,0.65)", padding: { x: 10, y: 6 } }).setOrigin(0, 0).setDepth(10);
    this.bossStateText = this.add.text(W - 16, 16, "", { fontFamily: FONT, fontSize: "13px", color: "#fca5a5", backgroundColor: "rgba(13,18,32,0.65)", padding: { x: 10, y: 6 } }).setOrigin(1, 0).setDepth(10);
    this.streakText = this.add.text(W / 2, 210, "", { fontFamily: FONT, fontSize: "13px", color: "#fbbf24", fontStyle: "bold" }).setOrigin(0.5).setDepth(10).setVisible(false);

    // Word panel
    const pw = 900, ph = 70, px = W / 2 - pw / 2, py = H - 60 - ph / 2;
    const wg = this.add.graphics();
    wg.fillStyle(0x0a1124, 0.65);
    wg.fillRoundedRect(px, py, pw, ph, 14);
    wg.lineStyle(1, 0x82aaff, 0.35);
    wg.strokeRoundedRect(px, py, pw, ph, 14);

    this.wordCont = this.add.container(W / 2, H - 60).setDepth(20);
    this.typedTxt  = this.add.text(0, 0, "", { fontFamily: MONO, fontSize: "42px", color: "#4ef0d4", fontStyle: "bold" }).setOrigin(0, 0.5);
    this.remainTxt = this.add.text(0, 0, "", { fontFamily: MONO, fontSize: "42px", color: "#e8ecff" }).setOrigin(0, 0.5);
    this.wordCont.add([this.typedTxt, this.remainTxt]);

    this.flashTxt = this.add.text(W / 2, 260, "", { fontFamily: FONT, fontSize: "19px", color: "#86efac", fontStyle: "bold" }).setOrigin(0.5).setDepth(40).setAlpha(0);

    // Overlay (countdown / roar / game-over)
    this.overlayTxt    = this.add.text(W / 2, H / 2 - 60, "", { fontFamily: FONT, fontSize: "70px", color: "#ffffff", fontStyle: "bold", align: "center" }).setOrigin(0.5).setDepth(50).setVisible(false);
    this.subOverlayTxt = this.add.text(W / 2, H / 2 + 50, "", { fontFamily: FONT, fontSize: "20px", color: "#cdd5ff", align: "center" }).setOrigin(0.5).setDepth(50).setVisible(false);

    // Attack warning text
    this.attackWarnTxt = this.add.text(W / 2, 240, "", { fontFamily: FONT, fontSize: "15px", fontStyle: "bold", backgroundColor: "rgba(0,0,0,0.55)", padding: { x: 12, y: 5 } }).setOrigin(0.5).setDepth(45).setAlpha(0);

    // Wind-up bar (fills from 0 → full during wind-up, sits under boss name)
    this.windUpBarBg   = this.add.graphics().setDepth(12).setVisible(false);
    this.windUpBarFill = this.add.graphics().setDepth(12).setVisible(false);
    this.windUpLabel   = this.add.text(W / 2, 148, "", { fontFamily: FONT, fontSize: "12px", color: "#fff", fontStyle: "bold", backgroundColor: "rgba(0,0,0,0.5)", padding: { x: 8, y: 3 } }).setOrigin(0.5).setDepth(12).setVisible(false);

    // Team HP overlay bar (bottom-left corner of canvas — always visible during play)
    this.teamHpBack = this.add.graphics().setDepth(18);
    this.teamHpFill = this.add.graphics().setDepth(18);
    this.teamHpText = this.add.text(18, H - 30, "Team HP: — / —", { fontFamily: FONT, fontSize: "11px", color: "#cdd5ff" }).setOrigin(0, 1).setDepth(18);
    this._drawTeamHpBar(100, 100);

    // Void-zone warning graphics
    this.voidZoneGfx = this.add.graphics().setDepth(13);

    // Fury overlay — fullscreen red pulsing tint (depth 1 so everything renders on top)
    this.furyOverlay = this.add.rectangle(0, 0, W, H, 0xff1a1a, 0).setOrigin(0, 0).setDepth(1).setVisible(false);
    this.furyActive  = false;
    this.furyTween   = null;
  }

  // ── Fury & milestone effects ──────────────────────────────────────────────
  _updateFuryOverlay(active) {
    if (!this.furyOverlay) return;
    if (active && !this.furyActive) {
      this.furyActive = true;
      this.furyOverlay.setVisible(true).setAlpha(0);
      if (this.furyTween) { this.furyTween.stop(); this.furyTween = null; }
      this.furyTween = this.tweens.add({
        targets: this.furyOverlay,
        alpha: { from: 0, to: 0.10 },
        duration: 700, yoyo: true, repeat: -1, ease: "sine.inOut",
      });
    } else if (!active && this.furyActive) {
      this.furyActive = false;
      if (this.furyTween) { this.furyTween.stop(); this.furyTween = null; }
      this.tweens.add({ targets: this.furyOverlay, alpha: 0, duration: 400, onComplete: () => this.furyOverlay?.setVisible(false) });
    }
  }

  _showFloatingText(text, color, size = 32) {
    const cx = this.charX || W / 2;
    const cy = (this.charY || H / 2) - 30;
    const t  = this.add.text(cx, cy, text, {
      fontFamily: FONT, fontSize: `${size}px`, color, fontStyle: "bold",
      stroke: "#000000", strokeThickness: 4,
    }).setOrigin(0.5).setDepth(36);
    this.tweens.add({ targets: t, y: cy - 65, alpha: 0, duration: 1300, ease: "cubic.out", onComplete: () => t?.destroy() });
  }

  _onStreakMilestone(event, healed) {
    switch (event) {
      case "streak3":
        this._showFloatingText(`+${healed} HP`, "#4ade80", 26);
        this.cameras.main.flash(120, 60, 230, 100);
        break;
      case "streak5":
        this._showFloatingText(`POWER! +${healed}HP`, "#fbbf24", 34);
        this.cameras.main.flash(180, 200, 180, 50);
        this.cameras.main.shake(150, 0.006);
        break;
      case "streak8":
        this._showFloatingText(`RAMPAGE! +${healed}HP`, "#fb923c", 40);
        this.cameras.main.flash(260, 220, 120, 40);
        this.cameras.main.shake(220, 0.010);
        break;
      case "fury":
        this._showFloatingText("FURY!", "#ef4444", 52);
        this.cameras.main.flash(450, 255, 60, 60);
        this.cameras.main.shake(320, 0.014);
        this._updateFuryOverlay(true);
        break;
      default: break;
    }
  }

  _showWindUpBar(attackType, durationMs, color) {
    const bw = 240, bh = 8, bx = W / 2 - bw / 2, by = 152;
    this.windUpBarBg.clear().setVisible(true);
    this.windUpBarBg.fillStyle(0x1f1230, 0.8);
    this.windUpBarBg.fillRoundedRect(bx, by, bw, bh, 4);
    this.windUpBarFill.clear().setVisible(true);
    this.windUpBarFill.fillStyle(color || 0xff3399, 0.9);
    this.windUpBarFill.fillRoundedRect(bx, by, 0, bh, 4);
    this.windUpLabel.setText(`CHARGING: ${ATTACK_LABELS[attackType] || attackType.toUpperCase()}`).setVisible(true);

    if (this.windUpBarTween) this.windUpBarTween.stop();
    let filled = 0;
    this.windUpBarTween = this.tweens.addCounter({
      from: 0, to: bw, duration: durationMs, ease: "linear",
      onUpdate: (tween) => {
        const w = tween.getValue();
        this.windUpBarFill.clear();
        this.windUpBarFill.fillStyle(color || 0xff3399, 0.9);
        this.windUpBarFill.fillRoundedRect(bx, by, w, bh, 4);
      },
      onComplete: () => { this.windUpBarFill.clear().setVisible(false); this.windUpBarBg.setVisible(false); this.windUpLabel.setVisible(false); },
    });
  }

  _hideWindUpBar() {
    if (this.windUpBarTween) { this.windUpBarTween.stop(); this.windUpBarTween = null; }
    this.windUpBarBg.setVisible(false);
    this.windUpBarFill.clear().setVisible(false);
    this.windUpLabel.setVisible(false);
  }

  _renderWord(word, progress) {
    const w = word || "", p = Math.max(0, Math.min(w.length, progress || 0));
    this.typedTxt.setText(w.slice(0, p));
    this.remainTxt.setText(w.slice(p));
    const total = this.typedTxt.width + this.remainTxt.width;
    const sx = -total / 2;
    this.typedTxt.setX(sx);
    this.remainTxt.setX(sx + this.typedTxt.width);
  }

  _updateRoleBadge() {
    this.roleBadge?.setText(this.isRunner ? "▶  RUNNER · WASD" : "⌨  TYPER · KEYBOARD").setColor(this.isRunner ? "#4ef0d4" : "#c084fc");
  }

  _updateBossStateText() {
    const atk = this.bossWindingUp ? `CHARGING ${ATTACK_LABELS[this.bossWindUpAttack] || "…"}` : `${ATTACK_LABELS[this.bossAttackType] || this.bossAttackType}`;
    const st  = this.bossState?.toUpperCase() || "";
    const label = this.bossState === "attack" ? `BOSS · ${atk}` : `BOSS · ${st}`;
    this.bossStateText?.setText(label);
  }

  _showAttackWarning(type) {
    const vis = this.bossVisual;
    const col = vis?.auraColors?.[this.bossPhaseIdx] || 0xffffff;
    const hex = `#${col.toString(16).padStart(6, "0")}`;
    const label = ATTACK_LABELS[type] || type.toUpperCase();
    this.tweens.killTweensOf(this.attackWarnTxt);
    this.attackWarnTxt.setText(label).setColor(hex).setAlpha(1).y = 240;
    this.tweens.add({ targets: this.attackWarnTxt, y: 210, alpha: 0, duration: 1400, ease: "cubic.out", onComplete: () => { this.attackWarnTxt.y = 240; } });
  }

  // ── Column layer (laser / lightning) ──────────────────────────────────────
  _createColumnLayer() {
    this.columnWarnGfx = this.add.graphics().setDepth(14).setAlpha(0);
    this.columnFireGfx = this.add.graphics().setDepth(14).setAlpha(0);
  }

  _showColumnWarning({ x, width, color, durationMs }) {
    this.tweens.killTweensOf(this.columnWarnGfx);
    this.columnWarnGfx.clear();
    this.columnWarnGfx.fillStyle(color, 0.18);
    this.columnWarnGfx.fillRect(x - width / 2, 60, width, H - 120);
    this.columnWarnGfx.lineStyle(2, color, 0.65);
    this.columnWarnGfx.strokeRect(x - width / 2, 60, width, H - 120);
    this.columnWarnGfx.setAlpha(1);
    this.tweens.add({ targets: this.columnWarnGfx, alpha: { from: 1, to: 0.3 }, duration: 280, yoyo: true, repeat: Math.floor(durationMs / 560) });
  }

  _showColumnFire({ x, width, color, durationMs }) {
    this.tweens.killTweensOf(this.columnWarnGfx);
    this.columnWarnGfx.setAlpha(0).clear();
    this.columnFireGfx.clear();
    this.columnFireGfx.fillStyle(0xffffff, 0.9);
    this.columnFireGfx.fillRect(x - width / 2, 60, width, H - 120);
    this.columnFireGfx.lineStyle(4, color, 0.9);
    this.columnFireGfx.strokeRect(x - width / 2, 60, width, H - 120);
    this.columnFireGfx.setAlpha(1);
    this.cameras.main.shake(200, 0.015);
    this.cameras.main.flash(durationMs, 220, 200, 200);
    this.tweens.add({ targets: this.columnFireGfx, alpha: 0, duration: durationMs + 200, ease: "cubic.out", onComplete: () => this.columnFireGfx.clear() });
  }

  // ── Populate from initial payload ─────────────────────────────────────────
  _populateFromPayload() {
    const p = this.payload || {};
    this.localSocketId = this.socket?.id;
    const players = p.players || [];
    const localP  = players.find(pl => pl.socketId === this.localSocketId);
    this.isRunner  = localP?.role === "runner";
    this.roomCode  = p.roomCode;
    // Boss visual config
    const bossId   = p.bossId || "watcher";
    this.bossVisual = BOSS_VISUALS[bossId] || BOSS_VISUALS.watcher;
    if (this.bossLabel) this.bossLabel.setText(this.bossVisual.label);

    this.expectedWord      = p.currentWord || "";
    this.localTypedProgress = p.typedProgress || 0;
    this.bossHP    = p.bossHP   ?? this.bossVisual.maxHP ?? 250;
    this.bossMaxHP = p.bossMaxHP ?? this.bossHP;
    this.bossState = p.bossState || "countdown";
    this.bossAttackType    = p.boss?.attackType || "normal";
    this.bossPhaseIdx      = p.boss?.phase ?? 0;
    this.bossWindingUp     = p.boss?.windingUp || false;
    this.bossWindUpAttack  = p.boss?.windUpAttack || null;
    this.bossWindUpRemaining = p.boss?.windUpRemaining || 0;
    this.streak = p.streak || 0;

    if (p.character) { this.charX = p.character.x; this.charY = p.character.y; this.charTargetX = this.charX; this.charTargetY = this.charY; this._setCharPos(this.charX, this.charY); }
    if (p.boss)      { this.bossX = p.boss.x || 640; this.bossY = p.boss.y || 110; this.bossTX = this.bossX; this.bossTY = this.bossY; this.bossCont.x = this.bossX; this.bossCont.y = this.bossY; }
    // Draw team HP overlay from initial payload
    this._drawTeamHpBar(p.sharedHP ?? 100, p.sharedMaxHP ?? 100);

    this._drawBossShape();
    this._drawBossHpBar(this.bossHP, this.bossMaxHP);
    this._renderWord(this.expectedWord, this.localTypedProgress);
    this._setCharLabels(players);
    this._updateRoleBadge();
    this._updateBossStateText();
    // Weapon state
    this.weaponHeld = p.weaponHeld || false;
    if (!this.weaponHeld && p.weaponX != null) this._setWeaponPos(p.weaponX, p.weaponY);
  }

  // ── Keyboard ──────────────────────────────────────────────────────────────
  _bindKeyboard() {
    if (this.keys) { Object.values(this.keys).forEach(k => k?.destroy?.()); this.keys = null; }
    if (this._onKeydown) { this.input.keyboard?.off("keydown", this._onKeydown, this); this._onKeydown = null; }
    if (this.isRunner) {
      this.keys = this.input.keyboard.addKeys({ up: "W", left: "A", down: "S", right: "D" });
    } else {
      this._onKeydown = (e) => {
        const key = String(e?.key || "").toLowerCase();
        if (key.length !== 1 || !/[a-z]/.test(key)) return;
        if (this.bossState === "countdown" || this.bossState === "roar") return;
        if (this.expectedWord && this.localTypedProgress < this.expectedWord.length) {
          if (key === this.expectedWord[this.localTypedProgress]) { this.localTypedProgress++; this._renderWord(this.expectedWord, this.localTypedProgress); }
          else this._shakeWord();
        }
        this.socket?.emit("typer_input", { roomCode: this.roomCode, char: key });
      };
      this.input.keyboard.on("keydown", this._onKeydown, this);
    }
  }

  _shakeWord() {
    this.tweens.killTweensOf(this.wordCont);
    const bx = W / 2;
    this.tweens.add({ targets: this.wordCont, x: { from: bx - 14, to: bx + 14 }, yoyo: true, repeat: 2, duration: 55, ease: "sine.inOut", onComplete: () => { this.wordCont.x = bx; } });
    const orig = this.remainTxt.style.color;
    this.remainTxt.setColor("#ff6b6b");
    this.time.delayedCall(220, () => this.remainTxt?.setColor(orig));
  }

  // ── Countdown ─────────────────────────────────────────────────────────────
  _handleInitialCountdown() {
    const rem = this.payload?.countdownRemaining ?? 0;
    if (this.bossState === "countdown" || rem > 0) this._startCountdown(rem || 3000);
  }

  _startCountdown(remainMs) {
    this._cancelCountdown();
    let sec = Math.max(1, Math.ceil(remainMs / 1000));
    this.overlayTxt.setColor("#ffffff").setFontSize(70).setText(String(sec)).setVisible(true);
    this.subOverlayTxt.setText(this.isRunner ? "Get ready · WASD to dodge" : "Get ready · type to attack").setVisible(true);
    const pop = () => { this.overlayTxt.setScale(1.4); this.tweens.add({ targets: this.overlayTxt, scale: 1, duration: 500, ease: "back.out" }); };
    pop();
    this.countdownTimer = this.time.addEvent({
      delay: 1000, repeat: sec - 1, callback: () => {
        sec--;
        if (sec <= 0) {
          this.overlayTxt.setText("FIGHT!").setColor("#ff6b9d"); pop();
          this.cameras.main.flash(250, 255, 180, 220);
          this.time.delayedCall(700, () => { this.overlayTxt?.setVisible(false); this.subOverlayTxt?.setVisible(false); });
        } else { this.overlayTxt.setText(String(sec)); pop(); }
      },
    });
  }

  _cancelCountdown() { if (this.countdownTimer) { this.countdownTimer.remove(false); this.countdownTimer = null; } }

  // ── Projectile management ─────────────────────────────────────────────────
  _getOrCreateProjectile(id, x, y, type) {
    let s = this.projectileSprites.get(id);
    if (!s) {
      const vis = PROJ_VISUALS[type] || PROJ_VISUALS.normal;
      s = this.add.circle(x, y, vis.r, vis.color, 1);
      s.setBlendMode(Phaser.BlendModes.ADD).setStrokeStyle(1.5, vis.glow, 0.8).setDepth(15);
      if (vis.homing) s.setStrokeStyle(2.5, vis.glow, 1); // thicker ring for homing orbs
      this.projectileSprites.set(id, s);
    }
    s.x = x; s.y = y;
    return s;
  }

  // ── Spawn effects ──────────────────────────────────────────────────────────
  _spawnDamageBurst(damage, isCrit) {
    const bx = this.bossX, by = this.bossY;
    const txt = this.add.text(bx, by - 40, `−${damage}${isCrit ? " ×2" : ""}`, { fontFamily: FONT, fontSize: isCrit ? "26px" : "21px", color: isCrit ? "#fbbf24" : "#ff9ec8", fontStyle: "bold" }).setOrigin(0.5).setDepth(45);
    this.tweens.add({ targets: txt, y: by - 90, alpha: 0, duration: 950, ease: "cubic.out", onComplete: () => txt.destroy() });
    const pc = isCrit ? 0xfbbf24 : 0xff9ec8;
    const n  = isCrit ? 14 : 9;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, d = 40 + Math.random() * 60;
      const p = this.add.circle(bx, by, 4, pc, 0.95).setBlendMode(Phaser.BlendModes.ADD).setDepth(30);
      this.tweens.add({ targets: p, x: bx + Math.cos(a) * d, y: by + Math.sin(a) * d, alpha: 0, scale: 0.2, delay: i * 15, duration: 500 + Math.random() * 180, ease: "cubic.out", onComplete: () => p.destroy() });
    }
    this.bossFlash.clear();
    this.bossFlash.fillStyle(0xffffff, 0.55);
    if (this.bossVisual?.shape === "hex")     this.bossFlash.fillPoints(hexPts(80, Math.PI / 6), true);
    else if (this.bossVisual?.shape === "diamond") this.bossFlash.fillPoints(diamondPts(80), true);
    else if (this.bossVisual?.shape === "crystal") this.bossFlash.fillPoints(octaPts(78), true);
    else this.bossFlash.fillCircle(0, 0, 70); // flame, spider, fallback
    this.bossFlash.x = bx; this.bossFlash.y = by;
    this.tweens.add({ targets: this.bossFlash, alpha: 0, duration: 220, ease: "cubic.out", onComplete: () => this.bossFlash?.clear() });
    this.tweens.add({ targets: this.bossCont, x: { from: bx - 6, to: bx }, duration: 180, ease: "back.out" });
  }

  _spawnRoarShockwave() {
    const bx = this.bossX, by = this.bossY;
    const ring = this.add.circle(bx, by, 60, 0xff3366, 0).setStrokeStyle(5, 0xff6b9d, 0.9).setBlendMode(Phaser.BlendModes.ADD).setDepth(12);
    this.tweens.add({ targets: ring, scale: 7, alpha: 0, duration: 900, ease: "cubic.out", onComplete: () => ring.destroy() });
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2, d = 200 + Math.random() * 160;
      const par = this.add.circle(bx, by, 3, 0xff85a8, 0.9).setBlendMode(Phaser.BlendModes.ADD).setDepth(13);
      this.tweens.add({ targets: par, x: bx + Math.cos(a) * d, y: by + Math.sin(a) * d, alpha: 0, duration: 750, ease: "cubic.out", onComplete: () => par.destroy() });
    }
  }

  _spawnUltimateEffect(specialName, windUpMs) {
    this.cameras.main.shake(800, 0.02);
    this.cameras.main.flash(400, 255, 80, 80);
    const vis = this.bossVisual;
    const col = vis?.auraColors?.[2] || 0xff3d00;
    for (let i = 0; i < 32; i++) {
      const a = (i / 32) * Math.PI * 2, d = 80 + Math.random() * 250;
      const par = this.add.circle(this.bossX, this.bossY, 5, col, 0.9).setBlendMode(Phaser.BlendModes.ADD).setDepth(13);
      this.tweens.add({ targets: par, x: this.bossX + Math.cos(a) * d, y: this.bossY + Math.sin(a) * d, alpha: 0, scale: { from: 1.5, to: 0.2 }, duration: 900 + Math.random() * 400, ease: "cubic.out", onComplete: () => par.destroy() });
    }
    this.overlayTxt.setColor("#ff3333").setFontSize(52).setText(`${specialName || "SPECIAL"}\nULTIMATE`).setVisible(true);
    const showDuration = windUpMs ? windUpMs + 200 : 2200;
    this.time.delayedCall(showDuration, () => { this.overlayTxt?.setVisible(false); this.subOverlayTxt?.setVisible(false); });

    if (this.bossPulse) {
      this.bossPulse.stop();
      this.tweens.add({ targets: this.bossCont, scale: { from: 1, to: 1.14 }, duration: 550, yoyo: true, repeat: -1, ease: "sine.inOut" });
    }
  }

  // ── Weapon ────────────────────────────────────────────────────────────────
  _createWeapon() {
    // Weapon container: glow ring + staff shape
    this.weaponCont = this.add.container(640, 490).setDepth(8).setVisible(false);

    const glow = this.add.circle(0, 0, 26, 0xfbbf24, 0.18).setBlendMode(Phaser.BlendModes.ADD);
    const ring = this.add.circle(0, 0, 18, 0xfbbf24, 0).setStrokeStyle(2.5, 0xfde68a, 0.9);

    // Staff/wand shape: vertical bar + crossguard
    const staff = this.add.graphics();
    staff.lineStyle(3.5, 0xfde68a, 1);
    staff.lineBetween(0, -14, 0, 14);   // shaft
    staff.lineBetween(-7, -6, 7, -6);   // crossguard
    staff.fillStyle(0xfbbf24, 1);
    staff.fillCircle(0, -16, 5);         // gem tip
    staff.fillStyle(0xffffff, 0.7);
    staff.fillCircle(-1, -17, 2);        // gem highlight

    this.weaponCont.add([glow, ring, staff]);

    // Floating label
    this.weaponLabel = this.add.text(640, 460, "PICK UP", {
      fontFamily: FONT, fontSize: "10px", color: "#fde68a", fontStyle: "bold",
      backgroundColor: "rgba(0,0,0,0.5)", padding: { x: 4, y: 2 },
    }).setOrigin(0.5).setDepth(8).setVisible(false);

    // Bobbing tween
    this.weaponBobTween = this.tweens.add({
      targets: this.weaponCont, y: { from: 490, to: 484 },
      duration: 900, yoyo: true, repeat: -1, ease: "sine.inOut",
    });
    this.weaponBobTween.stop();

    // HUD indicator for when weapon is held (top-right of canvas)
    this.weaponHeldBadge = this.add.text(W - 16, H - 30, "⚔ ARMED", {
      fontFamily: FONT, fontSize: "11px", color: "#fde68a", fontStyle: "bold",
      backgroundColor: "rgba(0,0,0,0.55)", padding: { x: 6, y: 2 },
    }).setOrigin(1, 1).setDepth(18).setVisible(false);

    // "No weapon" warning text (flashes when typer tries to type without weapon)
    this.noWeaponTxt = this.add.text(W / 2, H / 2 + 20, "⚔  Pick up the weapon first!", {
      fontFamily: FONT, fontSize: "18px", color: "#fde68a", fontStyle: "bold",
      backgroundColor: "rgba(0,0,0,0.65)", padding: { x: 14, y: 6 },
    }).setOrigin(0.5).setDepth(52).setAlpha(0);
  }

  _setWeaponPos(x, y) {
    this.weaponCont.setPosition(x, y).setVisible(true);
    this.weaponLabel.setPosition(x, y - 34).setVisible(true);
    if (this.weaponBobTween) {
      this.weaponBobTween.stop();
      this.weaponBobTween = this.tweens.add({
        targets: this.weaponCont, y: { from: y, to: y - 6 },
        duration: 900, yoyo: true, repeat: -1, ease: "sine.inOut",
      });
    }
  }

  _onWeaponPickup(x, y) {
    this.weaponHeld = true;
    this.weaponCont.setVisible(false);
    this.weaponLabel.setVisible(false);
    if (this.weaponBobTween) { this.weaponBobTween.stop(); }
    this.weaponHeldBadge.setVisible(true);

    // Pickup burst effect
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2, d = 20 + Math.random() * 30;
      const p = this.add.circle(x, y, 4, 0xfbbf24, 0.9).setBlendMode(Phaser.BlendModes.ADD).setDepth(20);
      this.tweens.add({ targets: p, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, alpha: 0, scale: 0.2, duration: 400, ease: "cubic.out", onComplete: () => p.destroy() });
    }
    const flash = this.add.circle(x, y, 30, 0xfde68a, 0.5).setBlendMode(Phaser.BlendModes.ADD).setDepth(20);
    this.tweens.add({ targets: flash, scale: 3, alpha: 0, duration: 350, ease: "cubic.out", onComplete: () => flash.destroy() });
    this._showFloatingText("⚔ Armed!", "#fde68a", 22);
  }

  _onWeaponDrop(x, y) {
    this.weaponHeld = false;
    this.weaponHeldBadge.setVisible(false);
    this._setWeaponPos(x, y);

    // Drop impact flash
    const flash = this.add.circle(x, y, 16, 0xff8c00, 0.6).setBlendMode(Phaser.BlendModes.ADD).setDepth(20);
    this.tweens.add({ targets: flash, scale: 2.5, alpha: 0, duration: 300, ease: "cubic.out", onComplete: () => flash.destroy() });

    this.cameras.main.flash(180, 200, 140, 0);
    this._showFloatingText("Weapon dropped!", "#ff8c00", 18);
  }

  _showNoWeaponFeedback() {
    this.tweens.killTweensOf(this.noWeaponTxt);
    this.noWeaponTxt.setAlpha(1);
    this.tweens.add({ targets: this.noWeaponTxt, alpha: 0, duration: 1600, ease: "cubic.out" });
    // Also shake the word display
    this._shakeWord();
  }

  // ── Eruption burst visual (at character position) ──────────────────────────
  _showEruptionBurst(x, y) {
    // Red shockwave ring at eruption origin
    const ring = this.add.circle(x, y, 20, 0xff3d9f, 0).setStrokeStyle(4, 0xff3d9f, 1).setBlendMode(Phaser.BlendModes.ADD).setDepth(16);
    this.tweens.add({ targets: ring, scale: 5, alpha: 0, duration: 500, ease: "cubic.out", onComplete: () => ring.destroy() });
    const ring2 = this.add.circle(x, y, 10, 0xff9f3d, 0).setStrokeStyle(2, 0xff9f3d, 0.8).setBlendMode(Phaser.BlendModes.ADD).setDepth(16);
    this.tweens.add({ targets: ring2, scale: 8, alpha: 0, duration: 700, ease: "cubic.out", onComplete: () => ring2.destroy() });
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2, d = 60 + Math.random() * 80;
      const p = this.add.circle(x, y, 5, 0xff3d9f, 0.9).setBlendMode(Phaser.BlendModes.ADD).setDepth(16);
      this.tweens.add({ targets: p, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, alpha: 0, scale: 0.3, duration: 400 + Math.random() * 150, ease: "cubic.out", onComplete: () => p.destroy() });
    }
    this.cameras.main.shake(130, 0.010);
  }

  // ── Void Zone visual ───────────────────────────────────────────────────────
  _showVoidZone(x, y, radius, detonateMs) {
    this.voidZoneGfx.clear();
    this.voidZoneGfx.lineStyle(3, 0xd946ef, 0.8);
    this.voidZoneGfx.strokeCircle(x, y, radius);
    this.voidZoneGfx.lineStyle(1, 0xd946ef, 0.3);
    this.voidZoneGfx.strokeCircle(x, y, radius + 10);

    // Warning pulse text
    const warnTxt = this.add.text(x, y - radius - 16, "⚠ VOID ZONE", {
      fontFamily: FONT, fontSize: "14px", color: "#d946ef", fontStyle: "bold",
      backgroundColor: "rgba(0,0,0,0.6)", padding: { x: 8, y: 3 },
    }).setOrigin(0.5).setDepth(16);
    this.tweens.add({ targets: warnTxt, alpha: { from: 1, to: 0.2 }, duration: 350, yoyo: true, repeat: Math.floor(detonateMs / 700), onComplete: () => warnTxt.destroy() });

    // Shrinking fill circle (shows countdown)
    const fill = this.add.circle(x, y, radius, 0xd946ef, 0.08).setDepth(13);
    this.tweens.add({ targets: fill, scale: 0.1, alpha: 0, duration: detonateMs, ease: "linear", onComplete: () => { fill.destroy(); this.voidZoneGfx.clear(); } });
  }

  _showVoidZoneExplode(x, y) {
    this.voidZoneGfx.clear();
    const ring = this.add.circle(x, y, 30, 0xd946ef, 0).setStrokeStyle(6, 0xd946ef, 1).setBlendMode(Phaser.BlendModes.ADD).setDepth(17);
    this.tweens.add({ targets: ring, scale: 5, alpha: 0, duration: 700, ease: "cubic.out", onComplete: () => ring.destroy() });
    this.cameras.main.flash(200, 180, 50, 220);
    this.cameras.main.shake(200, 0.012);
  }

  // ── Game-over Return to Lobby button in canvas ─────────────────────────────
  _showGameOverButton() {
    const bx = W / 2, by = H / 2 + 130;
    const btnBg = this.add.rectangle(bx, by, 240, 52, 0x1a2347, 0.95)
      .setStrokeStyle(2, 0x4ef0d4, 0.9)
      .setInteractive({ useHandCursor: true })
      .setDepth(60);
    const btnTxt = this.add.text(bx, by, "Return to Lobby", {
      fontFamily: FONT, fontSize: "16px", color: "#4ef0d4", fontStyle: "bold",
    }).setOrigin(0.5).setDepth(61);
    btnBg.on("pointerover",  () => btnBg.setFillStyle(0x2a4470, 0.95));
    btnBg.on("pointerout",   () => btnBg.setFillStyle(0x1a2347, 0.95));
    btnBg.on("pointerdown",  () => {
      window.dispatchEvent(new CustomEvent("typeduo_leave_room"));
    });
    this.tweens.add({ targets: [btnBg, btnTxt], alpha: { from: 0, to: 1 }, duration: 600, ease: "cubic.out" });
  }

  // ── Socket binding ─────────────────────────────────────────────────────────
  _bindSocket() {
    if (!this.socket) return;
    const s = this.socket;

    this._ev = {
      character_moved: ({ x, y }) => { this.charTargetX = x; this.charTargetY = y; },

      game_state: (state) => {
        if (state.character) { this.charTargetX = state.character.x; this.charTargetY = state.character.y; }
        if (state.boss) {
          this.bossTX = state.boss.x; this.bossTY = state.boss.y;
          const newPhase = state.boss.phase ?? 0;
          if (newPhase !== this.bossPhaseIdx) { this.bossPhaseIdx = newPhase; this._drawBossShape(false, false); }
          this.bossAttackType   = state.boss.attackType;
          this.bossWindingUp    = state.boss.windingUp;
          this.bossWindUpAttack = state.boss.windUpAttack;
          this.bossWindUpRemaining = state.boss.windUpRemaining || 0;
        }
        const prevHP = this.bossHP;
        this.bossHP = state.bossHP; this.bossMaxHP = state.bossMaxHP ?? this.bossMaxHP;
        this._drawBossHpBar(this.bossHP, this.bossMaxHP);
        // Keep team HP overlay in sync
        if (state.sharedHP !== undefined) this._drawTeamHpBar(state.sharedHP, state.sharedMaxHP ?? 100);
        // Sync weapon state (catch-up on reconnect / desync)
        if (state.weaponHeld !== undefined) {
          if (state.weaponHeld && !this.weaponHeld) this._onWeaponPickup(state.weaponX ?? this.charX, state.weaponY ?? this.charY);
          else if (!state.weaponHeld && this.weaponHeld) this._onWeaponDrop(state.weaponX ?? W / 2, state.weaponY ?? H / 2);
          else if (!state.weaponHeld && state.weaponX != null) this._setWeaponPos(state.weaponX, state.weaponY);
        }
        if (this.bossHP < prevHP) this.tweens.add({ targets: this.bossHpFill, alpha: { from: 0.4, to: 1 }, duration: 140 });

        const isRoar = state.bossState === "roar", isStun = state.bossState === "stunned";
        if (state.bossState !== this.bossState) {
          this.bossState = state.bossState;
          this._drawBossShape(isRoar, isStun);
        }
        this._updateBossStateText();
        this.streak = state.streak || 0;
        this.streakText?.setVisible(this.streak >= 2);
        if (this.streak >= 2) this.streakText?.setText(`STREAK ×${this.streak}`);
        // Sync fury overlay from authoritative game state
        this._updateFuryOverlay(state.furyActive || false);
        this.expectedWord = state.currentWord || "";
        this.localTypedProgress = state.typedProgress || 0;
        this._renderWord(this.expectedWord, this.localTypedProgress);
        this._setCharLabels(state.players || []);
        const localP = (state.players || []).find(p => p.socketId === this.localSocketId);
        if (localP && localP.role !== (this.isRunner ? "runner" : "typer")) {
          this.isRunner = localP.role === "runner";
          this._updateRoleBadge();
          this._bindKeyboard();
        }
        // Sync projectiles with extrapolation data
        const active = new Set();
        const recvTime = performance.now();
        (state.projectiles || []).forEach(proj => {
          active.add(proj.id);
          const sp = this._getOrCreateProjectile(proj.id, proj.x, proj.y, proj.type || "normal");
          sp._serverX  = proj.x;
          sp._serverY  = proj.y;
          sp._vx       = proj.vx  || 0;
          sp._vy       = proj.vy  || 0;
          sp._gravity  = proj.gravity || 0;
          sp._recvTime = recvTime;
        });
        this.projectileSprites.forEach((sp, id) => { if (!active.has(id)) { sp.destroy(); this.projectileSprites.delete(id); } });
      },

      typing_progress: ({ currentWord, typedProgress, streak }) => {
        this.expectedWord = currentWord || ""; this.localTypedProgress = typedProgress || 0;
        if (streak != null) this.streak = streak;
        this._renderWord(this.expectedWord, this.localTypedProgress);
      },

      typo:           ({ socketId }) => { if (socketId === this.localSocketId) this._shakeWord(); },

      word_completed: ({ by, word, damage, stunBonus, healed, streakEvent, furyActive }) => {
        if (by && word) {
          this.flashTxt.setText(`${by} typed "${word}"  −${damage}${stunBonus ? " ×2" : ""}`).setColor(stunBonus ? "#fbbf24" : "#86efac").setAlpha(1);
          this.flashTxt.y = 260;
          this.tweens.add({ targets: this.flashTxt, y: 220, alpha: 0, duration: 850, ease: "cubic.out" });
          this._spawnDamageBurst(damage, Boolean(stunBonus));
          if (healed > 0) {
            const t = this.add.text(W / 2, 275, `+${healed} HP`, { fontFamily: FONT, fontSize: "21px", color: "#4ade80", fontStyle: "bold" }).setOrigin(0.5).setDepth(45);
            this.tweens.add({ targets: t, y: 235, alpha: 0, duration: 900, ease: "cubic.out", onComplete: () => t.destroy() });
          }
        }
        if (streakEvent) this._onStreakMilestone(streakEvent, healed);
        this._updateFuryOverlay(furyActive || false);
      },

      player_hit: ({ isLaser, isColumn, sharedHP, sharedMaxHP }) => {
        this._flashCharHit();
        if (isLaser || isColumn) { this.cameras.main.shake(250, 0.018); this.cameras.main.flash(300, 255, 100, 100); }
        if (sharedHP !== undefined) this._drawTeamHpBar(sharedHP, sharedMaxHP ?? 100);
      },

      battle_started: () => { this._cancelCountdown(); this.overlayTxt?.setVisible(false); this.subOverlayTxt?.setVisible(false); },

      boss_roar_start: ({ countdownMs }) => {
        this.cameras.main.shake(650, 0.013);
        this._spawnRoarShockwave();
        this._drawBossShape(true, false);
        let rem = Math.max(1, Math.ceil((countdownMs || 3000) / 1000));
        this.overlayTxt.setColor("#ff6b9d").setFontSize(70).setText(`ROAR\nSWAP IN ${rem}`).setVisible(true);
        this.subOverlayTxt.setVisible(false);
        if (this.roarTimer) this.roarTimer.remove(false);
        this.roarTimer = this.time.addEvent({
          delay: 1000, repeat: rem - 1, callback: () => {
            rem--;
            if (rem > 0) this.overlayTxt?.setText(`ROAR\nSWAP IN ${rem}`);
            else { this.overlayTxt?.setText("SWAP!"); this.time.delayedCall(450, () => this.overlayTxt?.setVisible(false)); }
          },
        });
      },

      roles_swapped: ({ players }) => {
        this._setCharLabels(players);
        const lp = players.find(p => p.socketId === this.localSocketId);
        if (lp) { this.isRunner = lp.role === "runner"; this._updateRoleBadge(); this._bindKeyboard(); }
        this._drawBossShape(false, false);
      },

      boss_attack_changed: ({ attackType }) => {
        this.bossAttackType = attackType;
        this._updateBossStateText();
        this._showAttackWarning(attackType);
        this._hideWindUpBar();
      },

      boss_windup_start: ({ attackType, durationMs }) => {
        this.bossWindingUp    = true;
        this.bossWindUpAttack = attackType;
        this._updateBossStateText();
        const vis = this.bossVisual;
        const color = parseInt((vis?.windUpColor || 0xff3399).toString(16).replace("0x", ""), 16);
        this._showWindUpBar(attackType, durationMs, color);
        // Boss glows during wind-up
        this.tweens.add({ targets: this.bossCont, alpha: { from: 0.7, to: 1 }, duration: 200, yoyo: true, repeat: Math.floor(durationMs / 400) });
      },

      boss_windup_cancel: () => {
        this.bossWindingUp   = false;
        this.bossWindUpAttack = null;
        this._hideWindUpBar();
        this._updateBossStateText();
      },

      column_warning: (data) => this._showColumnWarning(data),
      column_fire:    (data) => this._showColumnFire(data),

      weapon_picked:  ({ x, y }) => this._onWeaponPickup(x, y),
      weapon_dropped: ({ x, y }) => this._onWeaponDrop(x, y),
      no_weapon:      ({ socketId }) => { if (socketId === this.localSocketId) this._showNoWeaponFeedback(); },

      eruption_fire: ({ x, y }) => this._showEruptionBurst(x, y),

      void_zone_placed:  ({ x, y, radius, detonateMs }) => this._showVoidZone(x, y, radius, detonateMs),
      void_zone_explode: ({ x, y }) => this._showVoidZoneExplode(x, y),

      boss_ultimate_start: ({ specialName, windUpMs }) => this._spawnUltimateEffect(specialName, windUpMs),

      game_over: ({ winner, bossHP }) => {
        const won = winner === "players";
        this.overlayTxt.setColor(won ? "#4ade80" : "#ff6b6b").setFontSize(56).setText(won ? "VICTORY!\nBOSS DEFEATED" : "DEFEATED\nBOSS WINS").setVisible(true);
        this.subOverlayTxt.setVisible(false);
        this.cameras.main.flash(750, won ? 60 : 220, won ? 240 : 50, won ? 180 : 80);
        if (this.bossPulse) this.bossPulse.stop();
        this.bossHP = bossHP ?? this.bossHP;
        this._drawBossHpBar(this.bossHP, this.bossMaxHP);
        this._hideWindUpBar();
        this._showGameOverButton();
      },
    };

    Object.entries(this._ev).forEach(([ev, fn]) => s.on(ev, fn));
  }

  // ── Update loop ────────────────────────────────────────────────────────────
  update(time, delta) {
    const dt = delta / 1000;

    // Stars
    this.stars.forEach(st => {
      st.sprite.x += st.vx * dt; st.sprite.y += st.vy * dt;
      if (st.sprite.x < -8) st.sprite.x = W + 8; if (st.sprite.x > W + 8) st.sprite.x = -8;
      if (st.sprite.y < -8) st.sprite.y = H + 8; if (st.sprite.y > H + 8) st.sprite.y = -8;
      st.phase += dt * 1.5;
      st.sprite.alpha = st.base + Math.sin(st.phase) * 0.18;
    });

    // Extrapolate projectiles between server ticks for smooth 60fps motion
    const nowMs = performance.now();
    this.projectileSprites.forEach((sp) => {
      if (sp._serverX === undefined) return;
      const elapsed = Math.min((nowMs - sp._recvTime) / 1000, 0.12); // cap at 120ms
      const extraVy = sp._vy + sp._gravity * elapsed * 0.5; // midpoint approximation
      sp.x = sp._serverX + sp._vx * elapsed;
      sp.y = sp._serverY + extraVy * elapsed;
    });

    // Boss lerp + aura — faster factor so it doesn't lag behind game_state
    this.bossX = Phaser.Math.Linear(this.bossX, this.bossTX, 0.10);
    this.bossY = Phaser.Math.Linear(this.bossY, this.bossTY, 0.10);
    this.bossCont.x = this.bossX; this.bossCont.y = this.bossY;
    this.bossFlash.x = this.bossX; this.bossFlash.y = this.bossY;
    this._drawBossAura(dt);

    // Character
    if (!this.isRunner || !this.keys) {
      // Typer: smooth lerp toward server-authorised position (faster than before)
      this.charX = Phaser.Math.Linear(this.charX, this.charTargetX, 0.45);
      this.charY = Phaser.Math.Linear(this.charY, this.charTargetY, 0.45);
      this._setCharPos(this.charX, this.charY);
    } else {
      if (this.bossState !== "countdown") {
        const vel = 290 * dt;
        let nx = this.charTargetX, ny = this.charTargetY, ddx = 0, ddy = 0;
        if (this.keys.left?.isDown)  { nx -= vel; ddx -= 1; }
        if (this.keys.right?.isDown) { nx += vel; ddx += 1; }
        if (this.keys.up?.isDown)    { ny -= vel; ddy -= 1; }
        if (this.keys.down?.isDown)  { ny += vel; ddy += 1; }
        nx = Phaser.Math.Clamp(nx, 30, 1250);
        ny = Phaser.Math.Clamp(ny, 200, 590);
        this.charTargetX = nx; this.charTargetY = ny;
        // Runner sees instant movement — no network lag on their own input
        this.charX = nx; this.charY = ny;
        this._setCharPos(nx, ny);
        if (ddx !== 0 || ddy !== 0) { const m = Math.sqrt(ddx ** 2 + ddy ** 2); this._drawCharArrow({ x: ddx / m, y: ddy / m }); }
        // Throttle network send — every 33ms when moving for snappier server sync
        if (time - this.lastSentAt > 33 && (ddx !== 0 || ddy !== 0)) {
          this.lastSentAt = time;
          this.socket?.emit("player_move", { roomCode: this.roomCode, x: nx, y: ny });
        }
      }
    }
  }

  // ── Shutdown ───────────────────────────────────────────────────────────────
  _shutdown() {
    if (this.socket && this._ev) {
      Object.entries(this._ev).forEach(([ev, fn]) => this.socket.off(ev, fn));
      this._ev = null;
    }
    if (this._onKeydown) this.input.keyboard?.off("keydown", this._onKeydown, this);
    if (this.keys) { Object.values(this.keys).forEach(k => k?.destroy?.()); this.keys = null; }
    this._cancelCountdown();
    if (this.roarTimer) { this.roarTimer.remove(false); this.roarTimer = null; }
    this._hideWindUpBar();
    this.projectileSprites.forEach(s => s.destroy());
    this.projectileSprites.clear();
    this.stars.forEach(s => s.sprite?.destroy?.());
    this.stars = [];
    this.voidZoneGfx?.clear();
    if (this.weaponBobTween) { this.weaponBobTween.stop(); this.weaponBobTween = null; }
    if (this.bossPulse) { this.bossPulse.stop(); this.bossPulse = null; }
    if (this.furyTween) { this.furyTween.stop(); this.furyTween = null; }
    this.furyOverlay?.setVisible(false);
  }

  // keep Phaser happy — public alias used by scene.add & scene.start
  shutdown() { this._shutdown(); }
}
