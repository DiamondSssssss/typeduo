import Phaser from "phaser";
import { BOSS_VISUALS, PROJ_VISUALS, ATTACK_LABELS } from "./bosses/bossConfigs";
import { getWeapon, DEFAULT_WEAPON_ID } from "./weapons";
import { resolveHazardPreset } from "./hazardVisuals";

// ── Scene constants ───────────────────────────────────────────────────────────
const W = 1280;
const H = 720;
const GRID = 40;
const FONT = '"Outfit","Inter","Segoe UI",system-ui,sans-serif';
const MONO = '"JetBrains Mono","Fira Code","SF Mono",Consolas,monospace';

/** Player move speed (px/s). */
const PLAYER_SPEED = 300;
/** Snap to server when forced movement (magnet, pull) exceeds this distance. */
const CHAR_RECONCILE_SQ = 55 * 55;
/** Typer/coop follow smoothing — higher = snappier catch-up. */
const CHAR_SMOOTH_RATE = 18;

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
    this.weaponTypeId = DEFAULT_WEAPON_ID;
    this.weaponStreak = 0;
    this.wordExpiresAt = 0;
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
    const bw = 320, bh = 20, bx = 16, by = 48;
    const pct = Math.max(0, Math.min(1, hp / Math.max(1, maxHP)));
    this.teamHpBack.clear();
    this.teamHpBack.fillStyle(0x0a1124, 0.92);
    this.teamHpBack.fillRoundedRect(bx, by, bw, bh, 6);
    this.teamHpBack.lineStyle(2, 0x4ef0d4, 0.75);
    this.teamHpBack.strokeRoundedRect(bx, by, bw, bh, 6);
    this.teamHpFill.clear();
    if (pct > 0) {
      const col = pct > 0.5 ? 0x4ade80 : pct > 0.25 ? 0xfbbf24 : 0xef4444;
      this.teamHpFill.fillStyle(col, 0.95);
      this.teamHpFill.fillRoundedRect(bx + 2, by + 2, (bw - 4) * pct, bh - 4, 5);
    }
    if (this.teamHpText) {
      this.teamHpText.setText(`♥ TEAM HP   ${Math.round(hp)} / ${maxHP}`);
      this.teamHpText.setPosition(bx, by - 6);
    }
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
    if (!facing || (!this.isRunner && !this.isSolo)) return;
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
    this.typedTxt  = this.add.text(0, 0, "", {
      fontFamily: MONO, fontSize: "42px", color: "#4ef0d4", fontStyle: "bold",
      shadow: { offsetX: 0, offsetY: 0, color: "#4ef0d4", blur: 14, stroke: true, fill: true },
    }).setOrigin(0, 0.5);
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

    // Team HP overlay (top-left — kept clear of the word panel at the bottom)
    this.teamHpBack = this.add.graphics().setDepth(26);
    this.teamHpFill = this.add.graphics().setDepth(26);
    this.teamHpText = this.add.text(16, 42, "♥ TEAM HP   — / —", {
      fontFamily: FONT, fontSize: "15px", color: "#4ef0d4", fontStyle: "bold",
      backgroundColor: "rgba(10,17,36,0.85)", padding: { x: 8, y: 4 },
    }).setOrigin(0, 1).setDepth(26);
    this._drawTeamHpBar(100, 100);

    // Attack telegraph layers (void zone, eruption, singularity, dark pulse)
    this.groundTelegraphGfx = this.add.graphics().setDepth(14);
    this.bossChargeGfx      = this.add.graphics().setDepth(14);
    this.voidZoneGfx = this.add.graphics().setDepth(14);

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
    if (this.isSolo) {
      this.roleBadge?.setText("SOLO · Arrow keys move · A–Z type").setColor("#4ef0d4");
    } else {
      this.roleBadge?.setText(this.isRunner ? "▶  RUNNER · WASD" : "⌨  TYPER · KEYBOARD").setColor(this.isRunner ? "#4ef0d4" : "#c084fc");
    }
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
    this.tweens.killTweensOf(this.columnFireGfx);
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

  _clearColumnGraphics() {
    this.tweens.killTweensOf(this.columnWarnGfx);
    this.columnWarnGfx.setAlpha(0).clear();
    this.tweens.killTweensOf(this.columnFireGfx);
    this.columnFireGfx.setAlpha(0).clear();
  }

  // ── Populate from initial payload ─────────────────────────────────────────
  _populateFromPayload() {
    const p = this.payload || {};
    this.localSocketId = this.socket?.id;
    const players = p.players || [];
    const localP  = players.find(pl => pl.socketId === this.localSocketId);
    this.gameMode = p.gameMode || "coop";
    this.isSolo   = this.gameMode === "solo" || localP?.role === "solo";
    this.isRunner = this.isSolo || localP?.role === "runner";
    this.canType  = this.isSolo || localP?.role === "typer";
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
    this.weaponTypeId = p.weaponTypeId || DEFAULT_WEAPON_ID;
    this.weaponStreak = p.weaponStreak || 0;
    this.wordExpiresAt = p.wordExpiresAt || 0;

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
    if (!this.weaponHeld && p.weaponX != null) {
      this._setWeaponPos(p.weaponX, p.weaponY, p.weaponTypeId);
    }
    this._updateWeaponHeldBadge();
  }

  // ── Keyboard ──────────────────────────────────────────────────────────────
  _bindKeyboard() {
    if (this.keys) { Object.values(this.keys).forEach(k => k?.destroy?.()); this.keys = null; }
    if (this.cursors) { this.cursors = null; }
    if (this._onKeydown) { this.input.keyboard?.off("keydown", this._onKeydown, this); this._onKeydown = null; }

    if (this.isSolo) {
      this.cursors = this.input.keyboard.createCursorKeys();
    } else if (this.isRunner) {
      this.keys = this.input.keyboard.addKeys({ up: "W", left: "A", down: "S", right: "D" });
    }

    if (this.canType) {
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
    const hint = this.isSolo ? "Get ready · Arrows + type" : this.isRunner ? "Get ready · WASD to dodge" : "Get ready · type to attack";
    this.subOverlayTxt.setText(hint).setVisible(true);
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
  _spawnDamageBurst(damage, isCrit, color = 0xff9ec8) {
    const bx = this.bossX, by = this.bossY;
    const hex = color.toString(16).padStart(6, "0");
    const txt = this.add.text(bx, by - 40, `−${damage}${isCrit ? " ×2" : ""}`, {
      fontFamily: FONT, fontSize: isCrit ? "26px" : "21px", color: `#${hex}`, fontStyle: "bold",
    }).setOrigin(0.5).setDepth(45);
    this.tweens.add({ targets: txt, y: by - 90, alpha: 0, duration: 950, ease: "cubic.out", onComplete: () => txt.destroy() });
    const n = isCrit ? 14 : 9;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, d = 40 + Math.random() * 60;
      const p = this.add.circle(bx, by, 4, color, 0.95).setBlendMode(Phaser.BlendModes.ADD).setDepth(30);
      this.tweens.add({ targets: p, x: bx + Math.cos(a) * d, y: by + Math.sin(a) * d, alpha: 0, scale: 0.2, delay: i * 15, duration: 500 + Math.random() * 180, ease: "cubic.out", onComplete: () => p.destroy() });
    }
    this.bossFlash.clear();
    this.bossFlash.fillStyle(0xffffff, 0.55);
    if (this.bossVisual?.shape === "hex")     this.bossFlash.fillPoints(hexPts(80, Math.PI / 6), true);
    else if (this.bossVisual?.shape === "diamond") this.bossFlash.fillPoints(diamondPts(80), true);
    else if (this.bossVisual?.shape === "crystal") this.bossFlash.fillPoints(octaPts(78), true);
    else this.bossFlash.fillCircle(0, 0, 70);
    this.bossFlash.x = bx; this.bossFlash.y = by;
    this.tweens.add({ targets: this.bossFlash, alpha: 0, duration: 220, ease: "cubic.out", onComplete: () => this.bossFlash?.clear() });
    this.tweens.add({ targets: this.bossCont, x: { from: bx - 6, to: bx }, duration: 180, ease: "back.out" });
  }

  _spawnWeaponAttack(weaponTypeId, damage, isCrit) {
    const weapon = getWeapon(weaponTypeId);
    const col = parseInt(String(weapon.color || "#ff9ec8").replace("#", ""), 16);
    const fx = this.charX, fy = this.charY;
    const bx = this.bossX, by = this.bossY;

    const projectile = this.add.circle(fx, fy, 6, col, 1).setBlendMode(Phaser.BlendModes.ADD).setDepth(42);
    const duration = weaponTypeId === "swift_blade" ? 180 : weaponTypeId === "greatsword" ? 420 : 280;

    if (weaponTypeId === "greatsword") {
      const slash = this.add.graphics().setDepth(41);
      slash.lineStyle(8, col, 0.9);
      slash.beginPath();
      slash.moveTo(fx - 20, fy + 10);
      slash.lineTo(bx, by);
      slash.strokePath();
      this.tweens.add({ targets: slash, alpha: 0, duration: 350, onComplete: () => slash.destroy() });
    } else if (weaponTypeId === "lifestaff") {
      const orb = this.add.circle(fx, fy, 10, 0x4ade80, 0.8).setBlendMode(Phaser.BlendModes.ADD).setDepth(41);
      this.tweens.add({
        targets: orb, x: bx, y: by, scale: 1.8, alpha: 0,
        duration, ease: "sine.in",
        onComplete: () => orb.destroy(),
      });
    } else if (weaponTypeId === "fury_axe") {
      projectile.setScale(1 + Math.min(this.weaponStreak, 10) * 0.08);
    }

    this.tweens.add({
      targets: projectile,
      x: bx, y: by,
      duration,
      ease: weaponTypeId === "swift_blade" ? "power2" : "sine.in",
      onComplete: () => {
        projectile.destroy();
        this._spawnDamageBurst(damage, isCrit, col);
      },
    });
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
  _drawWeaponGraphic(gfx, typeId) {
    const weapon = getWeapon(typeId);
    const col = parseInt(String(weapon.color).replace("#", ""), 16);
    gfx.clear();
    gfx.lineStyle(3, col, 1);
    if (typeId === "greatsword") {
      gfx.lineBetween(-4, 16, -4, -18);
      gfx.lineBetween(4, 14, 4, -14);
      gfx.lineBetween(-12, -4, 12, -4);
    } else if (typeId === "fury_axe") {
      gfx.lineBetween(0, 12, 0, -10);
      gfx.lineBetween(-10, -6, 10, -6);
      gfx.fillStyle(col, 1);
      gfx.fillTriangle(-14, -8, 0, -20, 14, -8);
    } else if (typeId === "lifestaff") {
      gfx.lineBetween(0, 14, 0, -14);
      gfx.fillStyle(col, 0.9);
      gfx.fillCircle(0, -16, 6);
    } else if (typeId === "swift_blade") {
      gfx.lineBetween(-2, 12, -2, -14);
      gfx.lineBetween(2, 10, 6, -12);
    } else {
      gfx.lineBetween(0, 12, 0, -12);
      gfx.lineBetween(-8, -2, 8, -2);
    }
    gfx.fillStyle(col, 1);
    gfx.fillCircle(0, typeId === "lifestaff" ? -16 : -14, 4);
  }

  _createWeapon() {
    this.weaponCont = this.add.container(640, 490).setDepth(8).setVisible(false);
    this.weaponGlow = this.add.circle(0, 0, 26, 0xfbbf24, 0.18).setBlendMode(Phaser.BlendModes.ADD);
    this.weaponRing = this.add.circle(0, 0, 18, 0xfbbf24, 0).setStrokeStyle(2.5, 0xfde68a, 0.9);
    this.weaponGfx = this.add.graphics();
    this._drawWeaponGraphic(this.weaponGfx, DEFAULT_WEAPON_ID);
    this.weaponCont.add([this.weaponGlow, this.weaponRing, this.weaponGfx]);

    this.weaponLabel = this.add.text(640, 460, "NHẶT VŨ KHÍ", {
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
    this.weaponHeldBadge = this.add.text(W - 16, H - 30, "", {
      fontFamily: FONT, fontSize: "11px", color: "#fde68a", fontStyle: "bold",
      backgroundColor: "rgba(0,0,0,0.55)", padding: { x: 6, y: 2 },
    }).setOrigin(1, 1).setDepth(18).setVisible(false);

    // "No weapon" warning text (flashes when typer tries to type without weapon)
    this.noWeaponTxt = this.add.text(W / 2, H / 2 + 20, "⚔  Pick up the weapon first!", {
      fontFamily: FONT, fontSize: "18px", color: "#fde68a", fontStyle: "bold",
      backgroundColor: "rgba(0,0,0,0.65)", padding: { x: 14, y: 6 },
    }).setOrigin(0.5).setDepth(52).setAlpha(0);
  }

  _updateWeaponHeldBadge() {
    if (!this.weaponHeldBadge) return;
    const w = getWeapon(this.weaponTypeId);
    this.weaponHeldBadge.setText(`${w.icon} ${w.nameVi}`).setColor(w.color).setVisible(this.weaponHeld);
  }

  _setWeaponPos(x, y, typeId = this.weaponTypeId) {
    this.weaponTypeId = typeId || DEFAULT_WEAPON_ID;
    const w = getWeapon(this.weaponTypeId);
    const col = parseInt(String(w.color).replace("#", ""), 16);
    this._drawWeaponGraphic(this.weaponGfx, this.weaponTypeId);
    this.weaponGlow.setFillStyle(col, 0.2);
    this.weaponRing.setStrokeStyle(2.5, col, 0.9);
    this.weaponCont.setPosition(x, y).setVisible(true);
    this.weaponLabel.setText(`${w.icon} ${w.nameVi}`).setPosition(x, y - 34).setColor(w.color).setVisible(true);
    if (this.weaponBobTween) {
      this.weaponBobTween.stop();
      this.weaponBobTween = this.tweens.add({
        targets: this.weaponCont, y: { from: y, to: y - 6 },
        duration: 900, yoyo: true, repeat: -1, ease: "sine.inOut",
      });
    }
  }

  _onWeaponPickup(x, y, weaponTypeId) {
    if (weaponTypeId) this.weaponTypeId = weaponTypeId;
    this.weaponHeld = true;
    this.weaponCont.setVisible(false);
    this.weaponLabel.setVisible(false);
    if (this.weaponBobTween) { this.weaponBobTween.stop(); }
    this._updateWeaponHeldBadge();

    const col = parseInt(String(getWeapon(this.weaponTypeId).color).replace("#", ""), 16);
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2, d = 20 + Math.random() * 30;
      const p = this.add.circle(x, y, 4, col, 0.9).setBlendMode(Phaser.BlendModes.ADD).setDepth(20);
      this.tweens.add({ targets: p, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, alpha: 0, scale: 0.2, duration: 400, ease: "cubic.out", onComplete: () => p.destroy() });
    }
    const flash = this.add.circle(x, y, 30, col, 0.5).setBlendMode(Phaser.BlendModes.ADD).setDepth(20);
    this.tweens.add({ targets: flash, scale: 3, alpha: 0, duration: 350, ease: "cubic.out", onComplete: () => flash.destroy() });
    this._showFloatingText(`${getWeapon(this.weaponTypeId).icon} ${getWeapon(this.weaponTypeId).nameVi}`, getWeapon(this.weaponTypeId).color, 22);
  }

  _onWeaponDrop(x, y) {
    this.weaponHeld = false;
    this.weaponHeldBadge.setVisible(false);
    this._setWeaponPos(x, y, this.weaponTypeId);

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

  // ── Ground / boss attack telegraphs (Void Crawler) ─────────────────────────
  _clearGroundTelegraph() {
    this.groundTelegraphGfx?.clear();
    this._groundTelegraphAttack = null;
  }

  _drawGroundTelegraph(x, y, attackType) {
    if (!this.groundTelegraphGfx) return;
    this.groundTelegraphGfx.clear();
    if (attackType === "void_zone") {
      this.groundTelegraphGfx.fillStyle(0xd946ef, 0.22);
      this.groundTelegraphGfx.fillCircle(x, y, 90);
      this.groundTelegraphGfx.lineStyle(3, 0xd946ef, 0.95);
      this.groundTelegraphGfx.strokeCircle(x, y, 90);
      this.groundTelegraphGfx.lineStyle(2, 0xff85c2, 0.55);
      this.groundTelegraphGfx.strokeCircle(x, y, 102);
    } else if (attackType === "eruption") {
      this.groundTelegraphGfx.fillStyle(0xff3d9f, 0.2);
      this.groundTelegraphGfx.fillCircle(x, y, 55);
      this.groundTelegraphGfx.lineStyle(3, 0xff3d9f, 0.9);
      this.groundTelegraphGfx.strokeCircle(x, y, 55);
    }
  }

  _showBossWindUpTelegraph(attackType, durationMs) {
    this._clearGroundTelegraph();
    this._groundTelegraphAttack = ["void_zone", "eruption"].includes(attackType) ? attackType : null;
    if (this._groundTelegraphAttack) {
      this._drawGroundTelegraph(this.charTargetX, this.charTargetY, this._groundTelegraphAttack);
    }
    if (attackType === "singularity" || attackType === "dark_pulse") {
      this._showBossChargeRing(attackType, durationMs);
    }
  }

  _showBossChargeRing(attackType, durationMs) {
    const col = attackType === "singularity" ? 0xd946ef : 0x8b5cf6;
    const bx = this.bossX, by = this.bossY;
    const ring = this.add.circle(bx, by, 40, col, 0).setStrokeStyle(4, col, 0.9).setBlendMode(Phaser.BlendModes.ADD).setDepth(15);
    this.tweens.add({ targets: ring, scale: 3.2, alpha: 0, duration: durationMs, ease: "cubic.in", onComplete: () => ring.destroy() });
    const label = attackType === "singularity" ? "🕳 SINGULARITY" : "🌑 DARK PULSE";
    const txt = this.add.text(bx, by - 70, label, {
      fontFamily: FONT, fontSize: "16px", color: "#fae8ff", fontStyle: "bold",
      backgroundColor: "rgba(0,0,0,0.65)", padding: { x: 10, y: 4 },
    }).setOrigin(0.5).setDepth(16);
    this.tweens.add({ targets: txt, alpha: { from: 1, to: 0.25 }, duration: 280, yoyo: true, repeat: Math.floor(durationMs / 560), onComplete: () => txt.destroy() });
  }

  _showSingularityBurst(x, y, count = 12) {
    const core = this.add.circle(x, y, 18, 0x1a0b2e, 0.85).setStrokeStyle(5, 0xd946ef, 1).setBlendMode(Phaser.BlendModes.ADD).setDepth(16);
    this.tweens.add({ targets: core, scale: 4.5, alpha: 0, duration: 650, ease: "cubic.out", onComplete: () => core.destroy() });
    for (let i = 0; i < Math.min(count, 20); i++) {
      const a = (i / count) * Math.PI * 2;
      const orb = this.add.circle(x, y, 8, 0xd946ef, 0.95).setBlendMode(Phaser.BlendModes.ADD).setDepth(16);
      this.tweens.add({
        targets: orb, x: x + Math.cos(a) * 120, y: y + Math.sin(a) * 120,
        alpha: 0, scale: 0.3, duration: 500, ease: "cubic.out", onComplete: () => orb.destroy(),
      });
    }
    this.cameras.main.shake(280, 0.014);
    this._showFloatingText("SINGULARITY!", "#d946ef", 20);
  }

  _showDarkPulseWave(x, y, aim, spread = 0.7) {
    const gfx = this.add.graphics().setDepth(16);
    const len = 520;
    const a0 = aim - spread;
    const a1 = aim + spread;
    gfx.fillStyle(0x8b5cf6, 0.28);
    gfx.beginPath();
    gfx.moveTo(x, y);
    gfx.arc(x, y, len, a0, a1, false);
    gfx.closePath();
    gfx.fillPath();
    gfx.lineStyle(3, 0xc4b5fd, 0.85);
    gfx.beginPath();
    gfx.moveTo(x, y);
    gfx.lineTo(x + Math.cos(a0) * len, y + Math.sin(a0) * len);
    gfx.moveTo(x, y);
    gfx.lineTo(x + Math.cos(a1) * len, y + Math.sin(a1) * len);
    gfx.strokePath();
    this.tweens.add({ targets: gfx, alpha: 0, duration: 420, ease: "cubic.out", onComplete: () => gfx.destroy() });
  }

  // ── Void Zone visual ───────────────────────────────────────────────────────
  _showVoidZone(x, y, radius, detonateMs) {
    this.voidZoneGfx.clear();
    const fill = this.add.circle(x, y, radius, 0xd946ef, 0.28).setDepth(14);
    this.voidZoneGfx.lineStyle(4, 0xd946ef, 1);
    this.voidZoneGfx.strokeCircle(x, y, radius);
    this.voidZoneGfx.lineStyle(2, 0xff85c2, 0.6);
    this.voidZoneGfx.strokeCircle(x, y, radius + 14);

    const warnTxt = this.add.text(x, y - radius - 22, "⚠ VOID ZONE — MOVE OUT!", {
      fontFamily: FONT, fontSize: "16px", color: "#fae8ff", fontStyle: "bold",
      backgroundColor: "rgba(45,10,86,0.85)", padding: { x: 10, y: 5 },
    }).setOrigin(0.5).setDepth(17);
    this.tweens.add({ targets: warnTxt, alpha: { from: 1, to: 0.3 }, duration: 300, yoyo: true, repeat: Math.floor(detonateMs / 600), onComplete: () => warnTxt.destroy() });

    const countdown = this.add.text(x, y, "2", {
      fontFamily: FONT, fontSize: "42px", color: "#ffffff", fontStyle: "bold",
      stroke: "#2d0a56", strokeThickness: 6,
    }).setOrigin(0.5).setDepth(17);
    this.tweens.add({ targets: countdown, scale: { from: 1.4, to: 0.8 }, alpha: { from: 1, to: 0 }, duration: detonateMs, ease: "linear", onComplete: () => countdown.destroy() });

    this.tweens.add({
      targets: fill, scale: 0.12, alpha: 0.05, duration: detonateMs, ease: "linear",
      onComplete: () => { fill.destroy(); this.voidZoneGfx.clear(); },
    });
    const pulse = this.add.circle(x, y, radius + 8, 0xd946ef, 0).setStrokeStyle(3, 0xff85c2, 0.85).setDepth(15);
    this.tweens.add({
      targets: pulse, scale: { from: 1, to: 1.18 }, alpha: { from: 0.9, to: 0.2 },
      duration: 320, yoyo: true, repeat: Math.floor(detonateMs / 640),
      onComplete: () => pulse.destroy(),
    });
  }

  _spawnHazardParticle(x, y, radius, preset) {
    const p = preset.particles;
    const colors = p.colors || [preset.color];
    const col = colors[Math.floor(Math.random() * colors.length)];
    const ang = Math.random() * Math.PI * 2;
    const dist = Math.random() * radius * 0.85;
    const px = x + Math.cos(ang) * dist;
    const py = y + Math.sin(ang) * dist;
    const size = p.sizeMin + Math.random() * (p.sizeMax - p.sizeMin);
    const dot = this.add.circle(px, py, size, col, 0.85)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(15);

    let tx = px;
    let ty = py;
    let dur = 600 + Math.random() * 500;

    if (p.drift === "rise" || p.drift === "ember") {
      ty -= 35 + Math.random() * 45;
      tx += (Math.random() - 0.5) * 24;
      dur = p.drift === "ember" ? 450 + Math.random() * 350 : 700 + Math.random() * 400;
    } else if (p.drift === "bubble") {
      ty -= 20 + Math.random() * 30;
      tx += (Math.random() - 0.5) * 18;
      dur = 900 + Math.random() * 500;
    } else {
      tx += (Math.random() - 0.5) * 40;
      ty += (Math.random() - 0.5) * 20;
      dur = 1100 + Math.random() * 600;
    }

    this.tweens.add({
      targets: dot,
      x: tx,
      y: ty,
      alpha: 0,
      scale: p.drift === "ember" ? 0.1 : 0.25,
      duration: dur,
      ease: p.drift === "bubble" ? "sine.out" : "cubic.out",
      onComplete: () => dot.destroy(),
    });
  }

  _showHazardZone(x, y, radius, durationMs, hazardType, serverColor) {
    const preset = resolveHazardPreset(hazardType, serverColor);
    const glow = preset.glow || preset.color;
    const fill = this.add.circle(x, y, radius, preset.color, preset.fillAlpha)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(14);
    const ring = this.add.circle(x, y, radius, 0, 0)
      .setStrokeStyle(preset.ringWidth || 3, glow, 0.9)
      .setDepth(15);
    const halo = this.add.circle(x, y, radius * 1.12, glow, 0)
      .setStrokeStyle(1.5, glow, 0.28)
      .setDepth(14);

    this.tweens.add({
      targets: ring,
      scale: { from: 1, to: 1.05 },
      alpha: { from: 0.95, to: 0.55 },
      duration: 900,
      yoyo: true,
      repeat: Math.ceil(durationMs / 900),
    });

    const pCfg = preset.particles;
    const particleTimer = this.time.addEvent({
      delay: pCfg.interval,
      repeat: Math.max(0, Math.floor(durationMs / pCfg.interval)),
      callback: () => {
        const n = pCfg.burst || 2;
        for (let i = 0; i < n; i++) this._spawnHazardParticle(x, y, radius, preset);
      },
    });

    this.tweens.add({
      targets: [fill, ring, halo],
      alpha: { from: 1, to: 0 },
      duration: durationMs,
      ease: "sine.in",
      onComplete: () => {
        particleTimer.remove(false);
        fill.destroy();
        ring.destroy();
        halo.destroy();
      },
    });
  }

  _showDelayedMarker(x, y, detonateMs) {
    const ring = this.add.circle(x, y, 24, 0xfbbf24, 0).setStrokeStyle(4, 0xfbbf24, 1).setDepth(16);
    const txt = this.add.text(x, y, "!", { fontFamily: FONT, fontSize: "36px", color: "#fbbf24", fontStyle: "bold" }).setOrigin(0.5).setDepth(17);
    this.tweens.add({ targets: ring, scale: 4, alpha: 0, duration: detonateMs, ease: "cubic.in", onComplete: () => { ring.destroy(); txt.destroy(); } });
  }

  _showVoidZoneExplode(x, y) {
    this.voidZoneGfx.clear();
    const ring = this.add.circle(x, y, 30, 0xd946ef, 0).setStrokeStyle(8, 0xd946ef, 1).setBlendMode(Phaser.BlendModes.ADD).setDepth(17);
    this.tweens.add({ targets: ring, scale: 6, alpha: 0, duration: 750, ease: "cubic.out", onComplete: () => ring.destroy() });
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const p = this.add.circle(x, y, 6, 0xa855f7, 0.95).setBlendMode(Phaser.BlendModes.ADD).setDepth(17);
      this.tweens.add({ targets: p, x: x + Math.cos(a) * 100, y: y + Math.sin(a) * 100, alpha: 0, duration: 450, ease: "cubic.out", onComplete: () => p.destroy() });
    }
    this._showFloatingText("VOID BURST!", "#d946ef", 18);
    this.cameras.main.flash(220, 180, 50, 220);
    this.cameras.main.shake(220, 0.014);
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

  /** True when this client drives character movement (solo or runner). */
  _isLocalMover() {
    return this.isSolo || this.isRunner;
  }

  /**
   * Apply server character position.
   * Local mover: client prediction — only snap on large desync (status pulls).
   * Remote viewer: update interpolation target.
   */
  _syncCharFromServer(sx, sy) {
    if (!this._isLocalMover()) {
      this.charTargetX = sx;
      this.charTargetY = sy;
      return;
    }
    const dx = sx - this.charX;
    const dy = sy - this.charY;
    if (dx * dx + dy * dy > CHAR_RECONCILE_SQ) {
      this.charX = sx;
      this.charY = sy;
      this.charTargetX = sx;
      this.charTargetY = sy;
      this._setCharPos(sx, sy);
    }
  }

  // ── Socket binding ─────────────────────────────────────────────────────────
  _bindSocket() {
    if (!this.socket) return;
    const s = this.socket;

    this._ev = {
      character_moved: ({ x, y }) => { this._syncCharFromServer(x, y); },

      game_state: (state) => {
        if (state.character) this._syncCharFromServer(state.character.x, state.character.y);
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
          if (state.weaponHeld && !this.weaponHeld) {
            this._onWeaponPickup(state.weaponX ?? this.charX, state.weaponY ?? this.charY, state.weaponTypeId);
          } else if (!state.weaponHeld && this.weaponHeld) {
            this._onWeaponDrop(state.weaponX ?? W / 2, state.weaponY ?? H / 2);
          } else if (!state.weaponHeld && state.weaponX != null) {
            this._setWeaponPos(state.weaponX, state.weaponY, state.weaponTypeId);
          }
          if (state.weaponTypeId) this.weaponTypeId = state.weaponTypeId;
        }
        if (this.bossHP < prevHP) this.tweens.add({ targets: this.bossHpFill, alpha: { from: 0.4, to: 1 }, duration: 140 });

        const isRoar = state.bossState === "roar", isStun = state.bossState === "stunned";
        if (state.bossState !== this.bossState) {
          this.bossState = state.bossState;
          this._drawBossShape(isRoar, isStun);
        }
        this._updateBossStateText();
        this.weaponTypeId = state.weaponTypeId || this.weaponTypeId;
        this.weaponStreak = state.weaponStreak || 0;
        this.wordExpiresAt = state.wordExpiresAt || 0;
        this.streakText?.setVisible(this.weaponStreak >= 2 && getWeapon(this.weaponTypeId).streakDamage);
        if (this.streakText?.visible) this.streakText.setText(`CHUỖI ×${this.weaponStreak}`);
        this.expectedWord = state.currentWord || "";
        this.localTypedProgress = state.typedProgress || 0;
        this._renderWord(this.expectedWord, this.localTypedProgress);
        this._setCharLabels(state.players || []);
        const localP = (state.players || []).find(p => p.socketId === this.localSocketId);
        if (state.gameMode) this.gameMode = state.gameMode;
        if (localP) {
          this.isSolo   = this.gameMode === "solo" || localP.role === "solo";
          this.isRunner = this.isSolo || localP.role === "runner";
          this.canType  = this.isSolo || localP.role === "typer";
        }
        if (localP && !this.isSolo && localP.role !== (this.isRunner ? "runner" : "typer")) {
          this.isRunner = localP.role === "runner";
          this.canType  = localP.role === "typer";
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

      typing_progress: ({ currentWord, typedProgress, weaponStreak, wordExpiresAt, weaponTypeId }) => {
        this.expectedWord = currentWord || ""; this.localTypedProgress = typedProgress || 0;
        if (weaponStreak != null) this.weaponStreak = weaponStreak;
        if (wordExpiresAt != null) this.wordExpiresAt = wordExpiresAt;
        if (weaponTypeId) this.weaponTypeId = weaponTypeId;
        this._renderWord(this.expectedWord, this.localTypedProgress);
      },

      word_expired: ({ currentWord, weaponTypeId }) => {
        this.expectedWord = currentWord || "";
        this.localTypedProgress = 0;
        this.weaponTypeId = weaponTypeId || this.weaponTypeId;
        this._renderWord(this.expectedWord, 0);
        this._shakeWord();
        this._showFloatingText("Hết giờ!", "#22d3ee", 20);
      },

      typo:           ({ socketId }) => { if (socketId === this.localSocketId) this._shakeWord(); },

      word_completed: ({ by, word, damage, stunBonus, healed, weaponTypeId, weaponStreak }) => {
        if (weaponTypeId) this.weaponTypeId = weaponTypeId;
        if (weaponStreak != null) this.weaponStreak = weaponStreak;
        if (by && word) {
          this.flashTxt.setText(`${by} typed "${word}"  −${damage}${stunBonus ? " ×2" : ""}`).setColor(stunBonus ? "#fbbf24" : "#86efac").setAlpha(1);
          this.flashTxt.y = 260;
          this.tweens.add({ targets: this.flashTxt, y: 220, alpha: 0, duration: 850, ease: "cubic.out" });
          this._spawnWeaponAttack(weaponTypeId || this.weaponTypeId, damage, Boolean(stunBonus));
          if (healed > 0) {
            const t = this.add.text(W / 2, 275, `+${healed} HP`, { fontFamily: FONT, fontSize: "21px", color: "#4ade80", fontStyle: "bold" }).setOrigin(0.5).setDepth(45);
            this.tweens.add({ targets: t, y: 235, alpha: 0, duration: 900, ease: "cubic.out", onComplete: () => t.destroy() });
          }
        }
        this._updateWeaponHeldBadge();
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
        if (this.isSolo) return;
        this._setCharLabels(players);
        const lp = players.find(p => p.socketId === this.localSocketId);
        if (lp) {
          this.isRunner = lp.role === "runner";
          this.canType  = lp.role === "typer";
          this._updateRoleBadge();
          this._bindKeyboard();
        }
        this._drawBossShape(false, false);
      },

      toxic_pool_placed: ({ x, y, radius, durationMs }) => this._showHazardZone(x, y, radius, durationMs, "toxic"),
      slow_field_placed: ({ x, y, radius, durationMs }) => this._showHazardZone(x, y, radius, durationMs, "slow"),
      delayed_marker:    ({ x, y, detonateMs }) => this._showDelayedMarker(x, y, detonateMs),
      tidal_sweep:       () => {
        [220, 400, 560, 720].forEach((ly) => {
          const g = this.add.graphics().setDepth(14);
          g.fillStyle(0x22d3ee, 0.15);
          g.fillRect(0, ly - 18, W, 36);
          g.lineStyle(2, 0x22d3ee, 0.7);
          g.strokeRect(0, ly - 18, W, 36);
          this.tweens.add({ targets: g, alpha: 0, duration: 800, onComplete: () => g.destroy() });
        });
      },
      shockwave_burst: ({ x, y }) => this._showSingularityBurst(x, y, 8),

      melee_telegraph: ({ x, y, angle, radius, arcDeg, color, durationMs }) => {
        const g = this.add.graphics().setDepth(16);
        g.lineStyle(4, color || 0xff6b6b, 0.85);
        g.beginPath();
        g.arc(x, y, radius, angle - (arcDeg * Math.PI / 180) / 2, angle + (arcDeg * Math.PI / 180) / 2);
        g.strokePath();
        this.tweens.add({ targets: g, alpha: 0, duration: durationMs || 900, onComplete: () => g.destroy() });
        this._showFloatingText("⚔ SWIPE!", "#ff6b6b", 16);
      },
      melee_slam: ({ x, y, radius, color }) => {
        const ring = this.add.circle(x, y, radius, color || 0xff6b6b, 0.35).setBlendMode(Phaser.BlendModes.ADD).setDepth(17);
        this.tweens.add({ targets: ring, scale: 1.4, alpha: 0, duration: 280, onComplete: () => ring.destroy() });
        this.cameras.main.shake(180, 0.012);
      },
      dash_telegraph: ({ fromX, fromY, toX, toY, color, durationMs }) => {
        const g = this.add.graphics().setDepth(15);
        g.lineStyle(3, color || 0x38bdf8, 0.8);
        g.lineBetween(fromX, fromY, toX, toY);
        this.tweens.add({ targets: g, alpha: 0, duration: durationMs || 1100, onComplete: () => g.destroy() });
        this._showFloatingText("💨 DASH!", "#38bdf8", 16);
      },
      boss_dash: ({ toX, toY, color }) => {
        const trail = this.add.circle(toX, toY, 40, color || 0x38bdf8, 0.4).setBlendMode(Phaser.BlendModes.ADD).setDepth(16);
        this.tweens.add({ targets: trail, scale: 2, alpha: 0, duration: 400, onComplete: () => trail.destroy() });
      },
      teleport_telegraph: ({ x, y, color, durationMs }) => {
        const ring = this.add.circle(x, y, 36, color || 0xa855f7, 0).setStrokeStyle(3, color || 0xa855f7, 1).setDepth(16);
        this.tweens.add({ targets: ring, scale: 2.5, alpha: 0, duration: durationMs || 600, onComplete: () => ring.destroy() });
      },
      boss_teleport: ({ fromX, fromY, toX, toY, color }) => {
        const flash = this.add.circle(fromX, fromY, 28, color || 0xa855f7, 0.6).setBlendMode(Phaser.BlendModes.ADD).setDepth(17);
        this.tweens.add({ targets: flash, scale: 2, alpha: 0, duration: 250, onComplete: () => flash.destroy() });
        const arrive = this.add.circle(toX, toY, 24, color || 0xa855f7, 0.5).setBlendMode(Phaser.BlendModes.ADD).setDepth(17);
        this.tweens.add({ targets: arrive, scale: 1.8, alpha: 0, duration: 350, onComplete: () => arrive.destroy() });
      },
      ground_hazard_placed: ({ x, y, r, expiresAt, color, type }) => {
        const dur = Math.max(1000, (expiresAt || Date.now() + 5000) - Date.now());
        this._showHazardZone(x, y, r, dur, type || "rune", color);
      },
      aoe_telegraph: ({ x, y, radius, color, durationMs }) => {
        const ring = this.add.circle(x, y, radius, color || 0xff4444, 0).setStrokeStyle(4, color || 0xff4444, 0.9).setDepth(16);
        this.tweens.add({ targets: ring, alpha: 0, scale: 1.2, duration: durationMs || 500, onComplete: () => ring.destroy() });
      },
      aoe_detonate: ({ x, y, radius, color }) => {
        const blast = this.add.circle(x, y, radius, color || 0xff4444, 0.45).setBlendMode(Phaser.BlendModes.ADD).setDepth(17);
        this.tweens.add({ targets: blast, scale: 1.3, alpha: 0, duration: 350, onComplete: () => blast.destroy() });
        this.cameras.main.shake(280, 0.018);
      },
      ultimate_pull: ({ centerX, centerY, color, durationMs }) => {
        const ring = this.add.circle(centerX, centerY, 80, color || 0xff3d9f, 0).setStrokeStyle(4, color || 0xff3d9f, 0.8).setDepth(16);
        this.tweens.add({ targets: ring, scale: 2.2, alpha: 0, duration: durationMs || 1200, onComplete: () => ring.destroy() });
        this._showFloatingText("PULL!", "#ff3d9f", 20);
      },
      ultimate_blast: ({ x, y, radius, color }) => {
        const blast = this.add.circle(x, y, radius, color || 0xff3d9f, 0.5).setBlendMode(Phaser.BlendModes.ADD).setDepth(18);
        this.tweens.add({ targets: blast, scale: 1.5, alpha: 0, duration: 500, onComplete: () => blast.destroy() });
        this.cameras.main.flash(400, 200, 50, 200);
        this.cameras.main.shake(400, 0.025);
      },
      ultimate_minions: () => this._showFloatingText("MINIONS!", "#d946ef", 18),

      boss_attack_changed: ({ attackType }) => {
        this.bossAttackType = attackType;
        this._updateBossStateText();
        this._showAttackWarning(attackType);
        this._hideWindUpBar();
        this._clearGroundTelegraph();
        this._clearColumnGraphics();
      },

      boss_windup_start: ({ attackType, durationMs }) => {
        this.bossWindingUp    = true;
        this.bossWindUpAttack = attackType;
        this._updateBossStateText();
        const vis = this.bossVisual;
        const color = parseInt((vis?.windUpColor || 0xff3399).toString(16).replace("0x", ""), 16);
        this._showWindUpBar(attackType, durationMs, color);
        this._showBossWindUpTelegraph(attackType, durationMs);
        // Boss glows during wind-up
        this.tweens.add({ targets: this.bossCont, alpha: { from: 0.7, to: 1 }, duration: 200, yoyo: true, repeat: Math.floor(durationMs / 400) });
      },

      boss_windup_cancel: () => {
        this.bossWindingUp   = false;
        this.bossWindUpAttack = null;
        this._hideWindUpBar();
        this._clearGroundTelegraph();
        this._updateBossStateText();
      },

      column_warning: (data) => this._showColumnWarning(data),
      column_fire:    (data) => this._showColumnFire(data),

      weapon_picked:  ({ x, y, weaponTypeId }) => this._onWeaponPickup(x, y, weaponTypeId),
      weapon_dropped: ({ x, y }) => this._onWeaponDrop(x, y),
      no_weapon:      ({ socketId }) => { if (socketId === this.localSocketId) this._showNoWeaponFeedback(); },

      eruption_fire: ({ x, y }) => this._showEruptionBurst(x, y),

      void_zone_placed:  ({ x, y, radius, detonateMs }) => {
        this._clearGroundTelegraph();
        this._showVoidZone(x, y, radius, detonateMs);
      },
      void_zone_explode: ({ x, y }) => this._showVoidZoneExplode(x, y),

      singularity_burst: ({ x, y, count }) => this._showSingularityBurst(x, y, count),
      dark_pulse_fire:   ({ x, y, aim, spread }) => this._showDarkPulseWave(x, y, aim, spread),

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

    // Character — local mover uses prediction; others interpolate smoothly
    const canMove = this.isSolo ? Boolean(this.cursors) : Boolean(this.isRunner && this.keys);
    if (!canMove) {
      const smooth = 1 - Math.exp(-CHAR_SMOOTH_RATE * dt);
      this.charX = Phaser.Math.Linear(this.charX, this.charTargetX, smooth);
      this.charY = Phaser.Math.Linear(this.charY, this.charTargetY, smooth);
      this._setCharPos(this.charX, this.charY);
    } else if (this.bossState !== "countdown") {
      const vel = PLAYER_SPEED * dt;
      let ddx = 0;
      let ddy = 0;
      const k = this.keys;
      const c = this.cursors;
      if (this.isSolo && c) {
        if (c.left?.isDown)  ddx -= 1;
        if (c.right?.isDown) ddx += 1;
        if (c.up?.isDown)    ddy -= 1;
        if (c.down?.isDown)  ddy += 1;
      } else {
        if (k?.left?.isDown)  ddx -= 1;
        if (k?.right?.isDown) ddx += 1;
        if (k?.up?.isDown)    ddy -= 1;
        if (k?.down?.isDown)  ddy += 1;
      }
      if (ddx !== 0 || ddy !== 0) {
        const m = Math.sqrt(ddx * ddx + ddy * ddy);
        ddx /= m;
        ddy /= m;
        let nx = this.charX + ddx * vel;
        let ny = this.charY + ddy * vel;
        nx = Phaser.Math.Clamp(nx, 30, 1250);
        ny = Phaser.Math.Clamp(ny, 200, 590);
        this.charX = nx;
        this.charY = ny;
        this.charTargetX = nx;
        this.charTargetY = ny;
        this._setCharPos(nx, ny);
        this._drawCharArrow({ x: ddx, y: ddy });
        if (time - this.lastSentAt > 20) {
          this.lastSentAt = time;
          this.socket?.emit("player_move", { roomCode: this.roomCode, x: nx, y: ny });
        }
      }
    }

    if (this.bossWindingUp && this._groundTelegraphAttack) {
      this._drawGroundTelegraph(this.charTargetX, this.charTargetY, this._groundTelegraphAttack);
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
    this.groundTelegraphGfx?.clear();
    if (this.weaponBobTween) { this.weaponBobTween.stop(); this.weaponBobTween = null; }
    if (this.bossPulse) { this.bossPulse.stop(); this.bossPulse = null; }
    if (this.furyTween) { this.furyTween.stop(); this.furyTween = null; }
    this.furyOverlay?.setVisible(false);
  }

  // keep Phaser happy — public alias used by scene.add & scene.start
  shutdown() { this._shutdown(); }
}
