import Phaser from "phaser";
import { BOSS_VISUALS, PROJ_VISUALS, ATTACK_LABELS } from "./bosses/bossConfigs";
import { getWeapon, DEFAULT_WEAPON_ID, weaponColorToInt, RAGE_MAX } from "./weapons";
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
    this.weaponRage = 0;
    this.ultimateMode = false;
    // Minion sprites (frontend-side chase tracking)
    this._minionSprites = [];
    // Pillar sprites (persistent column visuals)
    this._pillarSprites = [];
    // Stun wind-up telegraph
    this.paralyzeWindupActive = false;
    this.paralyzeWindupExpires = 0;
    this.paralyzeWindupGfx = null;
    this.paralyzeBeamGfx = null;
    // Animous Codex
    this.bookAlignment = "neutral";
    this.bookOfferGood = "";
    this.bookOfferEvil = "";
    this.bookCommitted = false;
    this.bookNeutralPrefix = "";
    this.bookGoodProgress = 0;
    this.bookEvilProgress = 0;
    this.bookTemptation = null;
    this.bookChoiceTxt = null;
    this.gamePaused = false;
    this._typoRestoreTimer = null;
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
    [this.charGlow, this.charRing, this.charBody, this.charHit, this.charArrow, this.paralyzeGfx].forEach(o => o?.setPosition(x, y));
    this.charLabel1?.setPosition(x, y - 30);
    this.charLabel2?.setPosition(x, y - 19);
  }

  _showParalyzeWindup(durationMs = 2200) {
    // Expanding shockwave ring at player position
    const ring = this.add.circle(this.charX, this.charY, 22, 0xc084fc, 0)
      .setStrokeStyle(4, 0xf472b6, 0.95).setDepth(7);
    this.tweens.add({
      targets: ring, scale: 2.8, alpha: 0,
      duration: durationMs,
      ease: "cubic.out",
      onComplete: () => ring.destroy(),
    });
    this._showFloatingText("PARALYZE INCOMING!", "#f472b6", 26);
    this.cameras.main.flash(120, 180, 80, 220, false);

    // Activate beam + reticle tracking for the wind-up duration
    this.paralyzeWindupActive  = true;
    this.paralyzeWindupExpires = Date.now() + durationMs;
    if (this.paralyzeBeamGfx)    this.paralyzeBeamGfx.setAlpha(1);
    if (this.paralyzeWindupGfx)  this.paralyzeWindupGfx.setAlpha(1);
  }

  _startParalyzeVisual() {
    this._endParalyzeVisual();
    this.paralyzed = true;
    this.charBody?.setFillStyle(0x7c3aed, 1);
    this.charRing?.setStrokeStyle(3, 0xf472b6, 1);
    this.paralyzeGfx = this.add.circle(this.charX, this.charY, 44, 0xc084fc, 0.22)
      .setStrokeStyle(2, 0xf472b6, 0.7).setDepth(4);
    this.tweens.add({
      targets: this.paralyzeGfx,
      scale: { from: 1, to: 1.18 },
      alpha: { from: 0.35, to: 0.15 },
      duration: 450,
      yoyo: true,
      repeat: -1,
      ease: "sine.inOut",
    });
    this.tweens.add({
      targets: [this.charBody, this.charRing],
      alpha: { from: 1, to: 0.65 },
      duration: 280,
      yoyo: true,
      repeat: -1,
    });
    this._showFloatingText("PARALYZED — TYPE YOUR WORD!", "#f472b6", 26);
    this.cameras.main.flash(220, 160, 60, 220, false);
  }

  _endParalyzeVisual() {
    if (!this.paralyzed && !this.paralyzeGfx) return;
    this.paralyzed = false;
    this.tweens.killTweensOf([this.charBody, this.charRing]);
    this.charBody?.setAlpha(1).setFillStyle(0xffffff, 1);
    this.charRing?.setAlpha(1).setStrokeStyle(2.5, 0x4ef0d4, 0.9);
    this.paralyzeGfx?.destroy();
    this.paralyzeGfx = null;
    this._clearStunTelegraph();
  }

  _clearStunTelegraph() {
    this.paralyzeWindupActive = false;
    this.paralyzeWindupExpires = 0;
    if (this.paralyzeBeamGfx)   { this.paralyzeBeamGfx.clear().setAlpha(0); }
    if (this.paralyzeWindupGfx) { this.paralyzeWindupGfx.clear().setAlpha(0); }
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
    this.wordPanelGfx = wg;
    this._wordPanelBounds = { pw, ph, px, py };

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

    // Rage / Ultimate bar (below Team HP bar)
    this.rageBarBack = this.add.graphics().setDepth(26);
    this.rageBarFill = this.add.graphics().setDepth(26);
    this.rageBarText = this.add.text(16, 92, "", {
      fontFamily: FONT, fontSize: "11px", color: "#fbbf24", fontStyle: "bold",
      backgroundColor: "rgba(10,17,36,0.85)", padding: { x: 6, y: 3 },
    }).setOrigin(0, 1).setDepth(27);
    this._drawRageBar(0, false);

    // Stun telegraph graphics (laser from boss to player + reticle)
    this.paralyzeBeamGfx = this.add.graphics().setDepth(23).setAlpha(0);
    this.paralyzeWindupGfx = this.add.graphics().setDepth(24).setAlpha(0);

    // Attack telegraph layers (void zone, eruption, singularity, dark pulse)
    this.groundTelegraphGfx = this.add.graphics().setDepth(14);
    this.bossChargeGfx      = this.add.graphics().setDepth(14);
    this.voidZoneGfx = this.add.graphics().setDepth(14);

    // Fury overlay — fullscreen red pulsing tint (depth 1 so everything renders on top)
    this.furyOverlay = this.add.rectangle(0, 0, W, H, 0xff1a1a, 0).setOrigin(0, 0).setDepth(1).setVisible(false);
    this.furyActive  = false;
    this.furyTween   = null;
  }

  _drawRageBar(rage = 0, isUltimate = false) {
    const bw = 320, bh = 10, bx = 16, by = 82;
    const weapon = getWeapon(this.weaponTypeId || DEFAULT_WEAPON_ID);
    const weaponCol = weaponColorToInt(weapon.color);
    const pct = Math.max(0, Math.min(1, (rage || 0) / RAGE_MAX));

    this.rageBarBack.clear();
    this.rageBarBack.fillStyle(0x0a1124, 0.92);
    this.rageBarBack.fillRoundedRect(bx, by, bw, bh, 4);
    this.rageBarBack.lineStyle(1.5, isUltimate ? 0xfbbf24 : weaponCol, isUltimate ? 1 : 0.55);
    this.rageBarBack.strokeRoundedRect(bx, by, bw, bh, 4);

    this.rageBarFill.clear();
    if (pct > 0) {
      const fillCol = isUltimate ? 0xfbbf24 : (pct >= 1 ? 0xf59e0b : weaponCol);
      this.rageBarFill.fillStyle(fillCol, isUltimate ? 1 : 0.9);
      this.rageBarFill.fillRoundedRect(bx + 1, by + 1, (bw - 2) * pct, bh - 2, 3);
      // Shine highlight
      this.rageBarFill.fillStyle(0xffffff, 0.2);
      this.rageBarFill.fillRoundedRect(bx + 1, by + 1, (bw - 2) * pct, Math.floor((bh - 2) * 0.4), 3);
    }

    const label = isUltimate
      ? `⚡ NỘ ${Math.round(pct * 100)}% — GÕ CÂU VÀNG!`
      : `⚡ NỘ  ${Math.round(pct * 100)}%${pct >= 1 ? '  —  SẤN SÀNG!' : ''}`;
    this.rageBarText.setText(label)
      .setColor(isUltimate ? '#fbbf24' : pct >= 1 ? '#fde68a' : '#94a3b8')
      .setPosition(bx, by - 2);
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

  _applyWeaponTypingStyle() {
    const weapon = getWeapon(this.weaponTypeId);
    const col = weapon.color;
    let blur = weapon.glowBlur ?? 14;
    if (weapon.streakDamage) {
      blur += Math.min(this.weaponStreak || 0, 12) * 1.1;
    }

    if (weapon.id === "fury_axe") {
      blur = Math.min(blur, 20);
      this.typedTxt.setColor("#fff1f2");
      this.typedTxt.setStroke("#7f1d1d", 2);
      this.typedTxt.setShadow(0, 0, col, blur, false, true);
    } else {
      this.typedTxt.setStroke("#000000", 0);
      this.typedTxt.setColor(col);
      this.typedTxt.setShadow(0, 0, col, blur, true, false);
    }
    this.remainTxt.setColor("#e8ecff");
    this.remainTxt.setStroke("#000000", 0);
    this.remainTxt.setShadow(0, 0, "#000000", 0, false, false);

    if (this.wordPanelGfx && this._wordPanelBounds) {
      const { pw, ph, px, py } = this._wordPanelBounds;
      const border = weaponColorToInt(col);
      this.wordPanelGfx.clear();
      this.wordPanelGfx.fillStyle(0x0a1124, 0.65);
      this.wordPanelGfx.fillRoundedRect(px, py, pw, ph, 14);
      this.wordPanelGfx.lineStyle(1.5, border, 0.5);
      this.wordPanelGfx.strokeRoundedRect(px, py, pw, ph, 14);
    }

    if (this.streakText?.visible) {
      this.streakText.setColor(col);
    }
  }

  _spawnLetterSpark(x, y) {
    const weapon = getWeapon(this.weaponTypeId);
    const col = weaponColorToInt(weapon.color);
    const n = weapon.sparkCount ?? 6;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = 10 + Math.random() * 26;
      const p = this.add.circle(x, y, 2 + Math.random() * 3, col, 0.92)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(30);
      this.tweens.add({
        targets: p,
        x: x + Math.cos(a) * d,
        y: y + Math.sin(a) * d - 4,
        alpha: 0,
        scale: 0.15,
        duration: 260 + Math.random() * 140,
        ease: "cubic.out",
        onComplete: () => p.destroy(),
      });
    }
    if (weapon.id !== "fury_axe") {
      const flash = this.add.circle(x, y, 7, 0xffffff, 0.65)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(29);
      this.tweens.add({ targets: flash, scale: 2, alpha: 0, duration: 180, onComplete: () => flash.destroy() });
    } else {
      const flash = this.add.circle(x, y, 6, 0xfff1f2, 0.5)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(29);
      this.tweens.add({ targets: flash, scale: 1.6, alpha: 0, duration: 160, onComplete: () => flash.destroy() });
    }
  }

  _wordForDisplay(word) {
    return String(word || "").replace(/ /g, "\u00B7");
  }

  _renderWord(word, progress) {
    if (this.weaponTypeId === "animous_codex" && this.bookAlignment === "neutral" && !this.bookCommitted) {
      this._renderBookNeutralPair(progress || 0);
      return;
    }
    const gatlingLetterMode = this.weaponTypeId === "gatling_gun"
      && !this.ultimateMode
      && this.currentWordPhase !== "ultimate"
      && (word || "").length <= 1;
    if (gatlingLetterMode) {
      this._renderGatlingBoard((word || "a")[0]);
      return;
    }
    if (this.gatlingGridTxt) {
      this.gatlingGridTxt.setVisible(false);
      this.typedTxt.setFontSize("42px").setY(0);
      this.remainTxt.setFontSize("42px").setY(0);
    }
    const w = word || "", p = Math.max(0, Math.min(w.length, progress || 0));
    this.typedTxt.setText(this._wordForDisplay(w.slice(0, p)));
    this.remainTxt.setText(this._wordForDisplay(w.slice(p)));
    const total = this.typedTxt.width + this.remainTxt.width;
    const sx = -total / 2;
    this.typedTxt.setX(sx);
    this.remainTxt.setX(sx + this.typedTxt.width);
    this._applyWeaponTypingStyle();
    this._updateBookSkipHint();
  }

  _updateBookSkipHint() {
    if (!this._atBookTemptationSkipPoint()) {
      this.bookSkipHintTxt?.setVisible(false);
      return;
    }
    const label = this.bookAlignment === "demon" ? "từ thánh" : "từ ác";
    if (!this.bookSkipHintTxt) {
      this.bookSkipHintTxt = this.add.text(W / 2, 158, "", {
        fontFamily: FONT, fontSize: "15px", color: "#fbbf24", fontStyle: "bold",
        stroke: "#1e1b4b", strokeThickness: 3,
      }).setOrigin(0.5).setDepth(33);
    }
    this.bookSkipHintTxt
      .setVisible(true)
      .setText(`SPACE × 2  →  bỏ ${label} (không gõ chữ đó)`);
  }

  _renderGatlingBoard(letter) {
    const weapon = getWeapon("gatling_gun");
    const col = weapon.color || "#eab308";
    const target = String(letter || "a").toLowerCase()[0] || "a";
    const rows = [
      "abcdefghijk".split(""),
      "lmnopqrstuv".split(""),
      "wxyz".split(""),
    ];
    const fmtRow = (chars) => chars.map((ch) => {
      const up = ch.toUpperCase();
      return ch === target ? `[${up}]` : ` ${up} `;
    }).join("");

    if (!this.gatlingGridTxt) {
      this.gatlingGridTxt = this.add.text(0, 44, "", {
        fontFamily: MONO, fontSize: "15px", color: "#64748b", align: "center", lineSpacing: 8,
      }).setOrigin(0.5, 0.5).setDepth(21);
      this.wordCont.add(this.gatlingGridTxt);
    }
    this.gatlingGridTxt.setVisible(true).setText(rows.map(fmtRow).join("\n"));

    this.typedTxt.setVisible(true).setFontSize("64px").setText(target.toUpperCase())
      .setColor(col).setStroke("#422006", 3).setShadow(0, 0, col, 22, false, true);
    this.remainTxt.setVisible(true).setFontSize("12px").setText("GÕ 1 CHỮ · BẮN LIÊN HOÀI")
      .setColor("#94a3b8").setStroke("#000000", 0).setShadow(0, 0, "#000000", 0, false, false);
    this.typedTxt.setY(-10);
    this.remainTxt.setY(54);
    this.typedTxt.setX(-this.typedTxt.width / 2);
    this.remainTxt.setX(-this.remainTxt.width / 2);
    this._applyWeaponTypingStyle();
  }

  _applyBookState(book) {
    if (!book) return;
    this.bookAlignment = book.alignment || "neutral";
    this.bookOfferGood = book.offerGood || "";
    this.bookOfferEvil = book.offerEvil || "";
    this.bookCommitted = Boolean(book.committed);
    this.bookNeutralPrefix = book.neutralPrefix || "";
    this.bookGoodProgress = book.goodProgress ?? 0;
    this.bookEvilProgress = book.evilProgress ?? 0;
    this.bookTemptation = book.temptation || null;
  }

  _atBookTemptationSkipPoint() {
    const t = this.bookTemptation;
    return this.weaponTypeId === "animous_codex"
      && this.bookAlignment !== "neutral"
      && t
      && this.localTypedProgress === t.start;
  }

  _renderBookNeutralPair(progress = 0) {
    const g = this.bookOfferGood || "???";
    const e = this.bookOfferEvil || "???";
    if (!this.bookChoiceTxt) {
      this.bookChoiceTxt = this.add.text(W / 2, 118, "", {
        fontFamily: FONT, fontSize: "13px", color: "#94a3b8",
      }).setOrigin(0.5).setDepth(32);
    }
    const prefix = this.bookNeutralPrefix || "";
    const hint = prefix
      ? "gõ tiếp — từ nào khớp prefix sẽ được chọn"
      : "gõ chữ đầu để chọn phe";
    this.bookChoiceTxt.setText(
      `THIỆN ${this.bookGoodProgress}/10  ·  ÁC ${this.bookEvilProgress}/10  — ${hint}`
    );
    if (!this.bookCommitted) {
      this.typedTxt.setFontSize("40px");
      this.remainTxt.setFontSize("40px");
      const goodActive = !prefix || g.startsWith(prefix);
      const evilActive = !prefix || e.startsWith(prefix);
      this.typedTxt.setText(g).setColor(goodActive ? "#fde68a" : "#64748b");
      this.remainTxt.setText(e).setColor(evilActive ? "#fca5a5" : "#64748b");
      const gap = 72;
      const total = this.typedTxt.width + gap + this.remainTxt.width;
      const sx = -total / 2;
      this.typedTxt.setX(sx);
      this.remainTxt.setX(sx + this.typedTxt.width + gap);
      this.typedTxt.setStroke("#422006", 2);
      this.remainTxt.setStroke("#450a0a", 2);
      return;
    }
    const w = this.expectedWord || g;
    const p = Math.max(0, Math.min(w.length, progress));
    this.typedTxt.setText(this._wordForDisplay(w.slice(0, p)));
    this.remainTxt.setText("");
    const sx = -this.typedTxt.width / 2;
    this.typedTxt.setX(sx);
    this.remainTxt.setX(sx + this.typedTxt.width);
    this._applyWeaponTypingStyle();
  }

  _playBookTransform(alignment) {
    const col = alignment === "holy" ? "#fde68a" : "#f87171";
    const label = alignment === "holy" ? "THÁNH KHÍ" : "QUỶ KHÍ";
    this._showFloatingText(label, col, 40);
    this.cameras.main.shake(420, 0.018);
    if (this.weaponCont?.visible) {
      const glowCol = alignment === "holy" ? 0xfbbf24 : 0xef4444;
      this.weaponGlow.setFillStyle(glowCol, 0.35);
      this.tweens.add({
        targets: this.weaponCont,
        scale: { from: 0.6, to: 1.15 },
        duration: 500,
        ease: "back.out",
      });
    }
    this._drawWeaponGraphic(this.weaponGfx, "animous_codex", alignment);
  }

  _spawnAnimousUltimate(alignment, damage) {
    if (alignment === "demon") this._spawnAnimousDemonUltimate(damage);
    else this._spawnAnimousHolyUltimate(damage);
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
    this.gamePaused = Boolean(p.paused);
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
    if (p.book) this._applyBookState(p.book);

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
    this._applyWeaponTypingStyle();
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
        if (this.gamePaused) return;
        let char;
        if (e.key === " " || e.key === "Spacebar") {
          char = " ";
        } else {
          char = String(e?.key || "").toLowerCase();
          if (char.length !== 1 || !/[a-z]/.test(char)) return;
        }
        if (this.bossState === "countdown" || this.bossState === "roar") return;
        const canTypeWord = this.expectedWord && (
          this.weaponTypeId !== "animous_codex"
          || this.bookAlignment !== "neutral"
          || this.bookCommitted
        );
        if (canTypeWord && this.localTypedProgress < this.expectedWord.length) {
          const skipTemptSpace = char === " " && this._atBookTemptationSkipPoint();
          if (skipTemptSpace || char === this.expectedWord[this.localTypedProgress]) {
            if (!skipTemptSpace) this.localTypedProgress++;
            this._renderWord(this.expectedWord, this.localTypedProgress);
            const letterX = this.wordCont.x + this.typedTxt.x + this.typedTxt.width - 8;
            const letterY = this.wordCont.y;
            this._spawnLetterSpark(letterX, letterY);
            this.tweens.killTweensOf(this.wordCont);
            this.tweens.add({
              targets: this.wordCont,
              scale: { from: 1.035, to: 1 },
              duration: 85,
              ease: "sine.out",
            });
          } else {
            this._shakeWord();
          }
        }
        this.socket?.emit("typer_input", { roomCode: this.roomCode, char });
      };
      this.input.keyboard.on("keydown", this._onKeydown, this);
    }
  }

  _shakeWord() {
    this.tweens.killTweensOf(this.wordCont);
    const bx = W / 2;
    this.tweens.add({
      targets: this.wordCont,
      x: { from: bx - 14, to: bx + 14 },
      yoyo: true, repeat: 2, duration: 55,
      ease: "sine.inOut",
      onComplete: () => { this.wordCont.x = bx; },
    });

    if (this._typoRestoreTimer) this._typoRestoreTimer.remove(false);

    if (this.wordPanelGfx && this._wordPanelBounds) {
      const { pw, ph, px, py } = this._wordPanelBounds;
      this.wordPanelGfx.clear();
      this.wordPanelGfx.fillStyle(0x3a1018, 0.82);
      this.wordPanelGfx.fillRoundedRect(px, py, pw, ph, 14);
      this.wordPanelGfx.lineStyle(2.5, 0xff6b6b, 0.95);
      this.wordPanelGfx.strokeRoundedRect(px, py, pw, ph, 14);
    }

    this.remainTxt.setColor("#ff6b6b");
    this.typedTxt.setColor("#ff6b6b");

    if (this.weaponTypeId === "fury_axe") this._updateFuryOverlay(false);

    this._typoRestoreTimer = this.time.delayedCall(280, () => {
      this._typoRestoreTimer = null;
      this._applyWeaponTypingStyle();
    });
  }

  _spawnGreatswordUltimate(damage, col) {
    const bx = this.bossX;
    const by = this.bossY;
    const bladeCol = col || 0xf97316;
    const edgeCol = 0xfff7ed;

    const dim = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0).setDepth(44);
    this.tweens.add({ targets: dim, alpha: 0.35, duration: 180 });

    const giantBlade = this.add.graphics().setDepth(49);
    const drawBlade = (x, y, scale, alpha) => {
      giantBlade.clear();
      giantBlade.fillStyle(bladeCol, alpha);
      giantBlade.lineStyle(4, edgeCol, alpha);
      const w = 28 * scale;
      const h = 220 * scale;
      giantBlade.fillRect(x - w * 0.35, y - h, w * 0.7, h * 0.88);
      giantBlade.fillRect(x - w * 1.1, y - h * 0.12, w * 2.2, h * 0.14);
      giantBlade.fillRect(x - w * 0.15, y - h * 1.05, w * 0.3, h * 0.2);
    };

    drawBlade(bx, -80, 1.4, 0.95);
    this.tweens.add({
      targets: { p: 0 },
      p: 1,
      duration: 380,
      ease: "power2.in",
      onUpdate: (tw) => {
        const p = tw.getValue();
        drawBlade(bx, Phaser.Math.Linear(-80, by + 10, p), 1.4 - p * 0.15, 0.95);
      },
      onComplete: () => {
        drawBlade(bx, by + 10, 1.25, 1);
        this.cameras.main.shake(520, 0.035);

        const cracks = this.add.graphics().setDepth(49).setBlendMode(Phaser.BlendModes.ADD);
        cracks.lineStyle(4, 0xfff7ed, 0.9);
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2 + 0.2;
          const len = 40 + Math.random() * 70;
          cracks.beginPath();
          cracks.moveTo(bx, by);
          cracks.lineTo(bx + Math.cos(a) * len, by + Math.sin(a) * len * 0.65);
          cracks.strokePath();
        }
        this.tweens.add({ targets: cracks, alpha: 0, duration: 500, delay: 200, onComplete: () => cracks.destroy() });

        const shock = this.add.circle(bx, by, 30, bladeCol, 0.5).setBlendMode(Phaser.BlendModes.ADD).setDepth(47);
        this.tweens.add({ targets: shock, scale: 5.5, alpha: 0, duration: 550, onComplete: () => shock.destroy() });

        for (let i = 0; i < 18; i++) {
          const a = (i / 18) * Math.PI * 2;
          const sp = this.add.circle(bx, by, 4 + Math.random() * 4, bladeCol, 0.9)
            .setDepth(48).setBlendMode(Phaser.BlendModes.ADD);
          this.tweens.add({
            targets: sp,
            x: bx + Math.cos(a) * (35 + Math.random() * 55),
            y: by + Math.sin(a) * (30 + Math.random() * 45),
            alpha: 0, scale: 0.1, duration: 450 + Math.random() * 250,
            onComplete: () => sp.destroy(),
          });
        }

        this.tweens.add({ targets: giantBlade, alpha: 0, duration: 400, delay: 250, onComplete: () => giantBlade.destroy() });
        this.tweens.add({ targets: dim, alpha: 0, duration: 500, delay: 300, onComplete: () => dim.destroy() });
        this._spawnDamageBurst(damage, true, bladeCol);
      },
    });
  }

  _spawnSwiftStormUltimate(_damage, col = 0x22d3ee) {
    if (this._swiftStormIntroActive) return;
    this._swiftStormIntroActive = true;
    this.time.delayedCall(1200, () => { this._swiftStormIntroActive = false; });

    const bx = this.bossX;
    const by = this.bossY;
    const edgeCol = 0xe0f2fe;
    const stormCol = col || 0x22d3ee;

    const dim = this.add.rectangle(W / 2, H / 2, W, H, 0x020617, 0).setDepth(44);
    this.tweens.add({ targets: dim, alpha: 0.42, duration: 200 });

    const vortex = this.add.graphics().setDepth(45).setBlendMode(Phaser.BlendModes.ADD);
    let spin = 0;
    const vortexTimer = this.time.addEvent({
      delay: 16,
      loop: true,
      callback: () => {
        spin += 0.22;
        vortex.clear();
        vortex.lineStyle(2, stormCol, 0.35);
        for (let r = 0; r < 3; r++) {
          const rad = 55 + r * 38 + Math.sin(spin * 2 + r) * 8;
          vortex.strokeCircle(bx, by, rad);
        }
        vortex.lineStyle(4, edgeCol, 0.5);
        for (let i = 0; i < 8; i++) {
          const a = spin + (i / 8) * Math.PI * 2;
          vortex.lineBetween(bx, by, bx + Math.cos(a) * 160, by + Math.sin(a) * 120);
        }
      },
    });

    this.cameras.main.flash(200, 34, 211, 238, false);
    this.cameras.main.shake(220, 0.012);

    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
      const startDist = 220 + Math.random() * 40;
      const sx = bx + Math.cos(angle) * startDist;
      const sy = by + Math.sin(angle) * startDist;

      const blade = this.add.graphics().setDepth(48).setPosition(sx, sy);
      blade.fillStyle(edgeCol, 0.95);
      blade.lineStyle(3, stormCol, 1);
      blade.beginPath();
      blade.moveTo(-22, 0);
      blade.lineTo(-8, -5);
      blade.lineTo(36, 0);
      blade.lineTo(-8, 5);
      blade.closePath();
      blade.fillPath();
      blade.strokePath();
      blade.setRotation(angle + Math.PI);

      const trail = this.add.graphics().setDepth(47).setBlendMode(Phaser.BlendModes.ADD);
      trail.lineStyle(14, stormCol, 0.25);
      trail.lineBetween(sx, sy, bx, by);

      this.tweens.add({
        targets: blade,
        x: bx,
        y: by,
        scale: { from: 1.8, to: 0.4 },
        delay: i * 55,
        duration: 280,
        ease: "power3.in",
        onComplete: () => {
          blade.destroy();
          trail.destroy();
          const burst = this.add.circle(bx, by, 14, stormCol, 0.65)
            .setBlendMode(Phaser.BlendModes.ADD).setDepth(49);
          this.tweens.add({
            targets: burst, scale: 2.8, alpha: 0, duration: 220,
            onComplete: () => burst.destroy(),
          });
          this.cameras.main.shake(90, 0.008);
        },
      });
      this.tweens.add({ targets: trail, alpha: 0, duration: 300, delay: i * 55 + 180, onComplete: () => trail.destroy() });
    }

    this.time.delayedCall(900, () => {
      vortexTimer.remove(false);
      vortex.destroy();
      this.tweens.add({ targets: dim, alpha: 0, duration: 500, onComplete: () => dim.destroy() });
    });
  }

  _spawnSwiftStormFinale(bx, by, damage, col = 0x22d3ee) {
    const stormCol = col || 0x22d3ee;
    this.cameras.main.shake(380, 0.028);
    this.cameras.main.flash(220, 34, 211, 238, false);

    const core = this.add.circle(bx, by, 55, stormCol, 0.35).setBlendMode(Phaser.BlendModes.ADD).setDepth(49);
    this.tweens.add({ targets: core, scale: 0.15, alpha: 0, duration: 420, ease: "power3.in", onComplete: () => core.destroy() });

    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const dist = 90 + (i % 4) * 25;
      const sp = this.add.circle(bx + Math.cos(a) * dist, by + Math.sin(a) * dist * 0.7, 5, stormCol, 0.9)
        .setDepth(50).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: sp, x: bx, y: by, alpha: 0, scale: 0.2,
        duration: 380 + (i % 5) * 30, ease: "power2.in",
        onComplete: () => sp.destroy(),
      });
    }

    const nova = this.add.circle(bx, by, 12, 0xffffff, 0.95).setBlendMode(Phaser.BlendModes.ADD).setDepth(51);
    this.tweens.add({ targets: nova, scale: 4, alpha: 0, duration: 280, onComplete: () => nova.destroy() });
    this._spawnDamageBurst(damage, true, stormCol);
  }

  _finaleShortsword(bx, by, damage, col = 0x94a3b8) {
    this.cameras.main.shake(320, 0.022);
    this.cameras.main.flash(200, 220, 230, 255, false);
    const edge = 0xf8fafc;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const ray = this.add.graphics().setDepth(49).setPosition(bx, by).setBlendMode(Phaser.BlendModes.ADD);
      ray.lineStyle(5, edge, 0.95);
      ray.lineBetween(0, 0, Math.cos(a) * 95, Math.sin(a) * 75);
      ray.lineStyle(2, col, 0.8);
      ray.lineBetween(0, 0, Math.cos(a) * 70, Math.sin(a) * 55);
      this.tweens.add({ targets: ray, alpha: 0, scaleX: 1.4, scaleY: 1.4, duration: 380, onComplete: () => ray.destroy() });
    }
    const seal = this.add.circle(bx, by, 20, col, 0).setStrokeStyle(4, edge, 1).setDepth(50).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: seal, scale: 3.5, alpha: 0, duration: 450, onComplete: () => seal.destroy() });
    this._spawnDamageBurst(damage, true, col);
  }

  _finaleLifestaff(bx, by, damage, col = 0x4ade80) {
    this.cameras.main.shake(280, 0.018);
    this.cameras.main.flash(180, 120, 255, 160, false);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const petal = this.add.ellipse(bx, by, 22, 10, 0x86efac, 0.7)
        .setDepth(49).setBlendMode(Phaser.BlendModes.ADD);
      petal.setRotation(a);
      this.tweens.add({
        targets: petal, scaleX: 2.8, scaleY: 2.2, alpha: 0,
        duration: 520, delay: i * 35, onComplete: () => petal.destroy(),
      });
    }
    const bloom = this.add.circle(bx, by - 8, 16, col, 0.6).setDepth(50).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: bloom, scale: 2.5, alpha: 0, duration: 400, onComplete: () => bloom.destroy() });
    this._spawnDamageBurst(damage, true, col);
  }

  _finaleFuryAxe(bx, by, damage, col = 0xef4444) {
    this.cameras.main.shake(400, 0.03);
    this.cameras.main.flash(240, 255, 90, 50, false);
    const scorch = this.add.ellipse(bx, by + 25, 120, 35, 0x450a0a, 0.75).setDepth(48);
    this.tweens.add({ targets: scorch, scaleX: 1.8, scaleY: 1.4, alpha: 0, duration: 500, onComplete: () => scorch.destroy() });
    const pillar = this.add.graphics().setDepth(49).setBlendMode(Phaser.BlendModes.ADD);
    pillar.fillStyle(col, 0.5);
    pillar.fillRect(bx - 22, by - 180, 44, 160);
    pillar.lineStyle(3, 0xfca5a5, 0.9);
    pillar.strokeRect(bx - 22, by - 180, 44, 160);
    this.tweens.add({ targets: pillar, alpha: 0, scaleY: 0.3, duration: 450, onComplete: () => pillar.destroy() });
    for (let i = 0; i < 14; i++) {
      const em = this.add.circle(bx + (Math.random() - 0.5) * 60, by, 5, 0xf97316, 0.9)
        .setDepth(50).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: em, y: by - 120 - Math.random() * 80, alpha: 0, scale: 0.2,
        duration: 400 + Math.random() * 200, onComplete: () => em.destroy(),
      });
    }
    this._spawnDamageBurst(damage, true, col);
  }

  _finaleGatling(bx, by, damage, col = 0xeab308) {
    this.cameras.main.shake(420, 0.024);
    this.cameras.main.flash(200, 255, 210, 80, false);
    for (let i = 0; i < 20; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = 30 + Math.random() * 80;
      const shell = this.add.rectangle(bx + Math.cos(a) * d, by + Math.sin(a) * d * 0.6, 4, 2, 0xd97706, 0.9)
        .setDepth(48).setRotation(Math.random() * Math.PI);
      this.tweens.add({
        targets: shell, y: shell.y + 40 + Math.random() * 30, alpha: 0,
        duration: 350 + Math.random() * 200, onComplete: () => shell.destroy(),
      });
    }
    const brass = this.add.circle(bx, by, 35, col, 0.45).setBlendMode(Phaser.BlendModes.ADD).setDepth(49);
    this.tweens.add({ targets: brass, scale: 3.2, alpha: 0, duration: 480, onComplete: () => brass.destroy() });
    this._spawnDamageBurst(damage, true, col);
  }

  _finaleAnimousHoly(bx, by, damage) {
    const col = 0xfbbf24;
    this.cameras.main.shake(300, 0.02);
    this.cameras.main.flash(260, 255, 245, 200, false);
    const pillar = this.add.graphics().setDepth(49).setBlendMode(Phaser.BlendModes.ADD);
    pillar.fillStyle(col, 0.25);
    pillar.fillRect(bx - 28, by - 200, 56, 190);
    pillar.lineStyle(2, 0xfde68a, 0.9);
    pillar.strokeRect(bx - 28, by - 200, 56, 190);
    this.tweens.add({ targets: pillar, alpha: 0, duration: 500, onComplete: () => pillar.destroy() });
    const halo = this.add.circle(bx, by, 25, col, 0).setStrokeStyle(5, 0xfde68a, 1).setDepth(50).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: halo, scale: 3, alpha: 0, duration: 550, onComplete: () => halo.destroy() });
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const star = this.add.circle(bx + Math.cos(a) * 50, by + Math.sin(a) * 38, 3, 0xfffbeb, 1)
        .setDepth(51).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: star, alpha: 0, scale: 0.3, duration: 400, delay: i * 25, onComplete: () => star.destroy() });
    }
    this._spawnDamageBurst(damage, true, col);
  }

  _drawEnergyBeam(gfx, x1, y1, x2, y2, outerW, outerCol, coreW, coreCol) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.max(1, Math.hypot(dx, dy));
    const nx = -dy / len;
    const ny = dx / len;
    const layers = [
      { w: outerW, c: outerCol, a: 0.22 },
      { w: outerW * 0.72, c: outerCol, a: 0.45 },
      { w: coreW, c: coreCol, a: 0.95 },
    ];
    layers.forEach(({ w, c, a }) => {
      gfx.lineStyle(w, c, a);
      gfx.beginPath();
      gfx.moveTo(x1 + nx * w * 0.5, y1 + ny * w * 0.5);
      gfx.lineTo(x2 + nx * w * 0.5, y2 + ny * w * 0.5);
      gfx.lineTo(x2 - nx * w * 0.5, y2 - ny * w * 0.5);
      gfx.lineTo(x1 - nx * w * 0.5, y1 - ny * w * 0.5);
      gfx.closePath();
      gfx.fillPath();
    });
  }

  /** Multi-layer Kamehameha-style beam (player → boss). */
  _drawKamehamehaBeam(gfx, x1, y1, x2, y2, phase, cols) {
    const { outer, mid, core, accent } = cols;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.max(1, Math.hypot(dx, dy));
    const ux = dx / len;
    const uy = dy / len;
    const nx = -uy;
    const ny = ux;
    const pulse = phase;
    const grow = Math.min(1, phase * 0.85);
    const outerW = (38 + Math.sin(pulse * 2.1) * 10) * grow;
    const midW = (24 + Math.sin(pulse * 2.8) * 6) * grow;
    const coreW = (12 + Math.sin(pulse * 3.4) * 3) * grow;

    this._drawEnergyBeam(gfx, x1, y1, x2, y2, outerW, outer, midW * 0.55, mid);
    this._drawEnergyBeam(gfx, x1, y1, x2, y2, midW, mid, coreW, core);

    for (let t = 0; t <= 1.001; t += 1 / 28) {
      const bx = x1 + dx * t;
      const by = y1 + dy * t;
      const wave = Math.sin(t * Math.PI * 10 + pulse * 4) * (14 + Math.sin(pulse + t * 8) * 6) * grow;
      const tx = bx + nx * wave;
      const ty = by + ny * wave;
      gfx.lineStyle(2, accent, 0.35 + Math.sin(t * 20 + pulse) * 0.15);
      gfx.beginPath();
      gfx.moveTo(bx, by);
      gfx.lineTo(tx, ty);
      gfx.strokePath();
    }

    const drawSpikeBurst = (cx, cy, scale, col, edgeCol) => {
      const spikes = 14;
      for (let i = 0; i < spikes; i++) {
        const a = (i / spikes) * Math.PI * 2 + pulse * 0.4;
        const r1 = 10 * scale;
        const r2 = (28 + Math.sin(pulse * 3 + i) * 10) * scale;
        gfx.lineStyle(3, edgeCol, 0.85);
        gfx.beginPath();
        gfx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1 * 0.75);
        gfx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2 * 0.75);
        gfx.strokePath();
        gfx.lineStyle(5, col, 0.55);
        gfx.beginPath();
        gfx.moveTo(cx + Math.cos(a) * (r1 + 2), cy + Math.sin(a) * (r1 + 2) * 0.75);
        gfx.lineTo(cx + Math.cos(a) * (r2 - 4), cy + Math.sin(a) * (r2 - 4) * 0.75);
        gfx.strokePath();
      }
      gfx.fillStyle(core, 0.95);
      gfx.fillCircle(cx, cy, 14 * scale);
      gfx.lineStyle(3, edgeCol, 1);
      gfx.strokeCircle(cx, cy, 16 * scale);
      gfx.fillStyle(col, 0.35);
      gfx.fillCircle(cx, cy, 22 * scale);
    };

    drawSpikeBurst(x1, y1, 1 + Math.sin(pulse * 5) * 0.12, outer, core);
    drawSpikeBurst(x2, y2, 1.15 + Math.sin(pulse * 4.2) * 0.15, mid, core);
  }

  _spawnShortswordUltimate(damage, col = 0x94a3b8) {
    const bx = this.bossX, by = this.bossY;
    const edge = 0xf8fafc;
    const dim = this.add.rectangle(W / 2, H / 2, W, H, 0x0f172a, 0).setDepth(44);
    this.tweens.add({ targets: dim, alpha: 0.45, duration: 180 });
    this.cameras.main.flash(180, 220, 230, 255, false);

    for (let r = 0; r < 3; r++) {
      const ring = this.add.circle(bx, by, 40 + r * 35, col, 0)
        .setStrokeStyle(3, edge, 0.7 - r * 0.15).setDepth(45).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: ring, scale: 2.2 + r * 0.3, alpha: 0, duration: 700, delay: r * 90, onComplete: () => ring.destroy() });
    }

    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const dist = 200 + (i % 2) * 40;
      const sx = bx + Math.cos(angle) * dist;
      const sy = by + Math.sin(angle) * dist;
      const blade = this.add.graphics().setDepth(48).setPosition(sx, sy);
      blade.fillStyle(edge, 0.95);
      blade.lineStyle(3, col, 1);
      blade.beginPath();
      blade.moveTo(-20, 0);
      blade.lineTo(-7, -5);
      blade.lineTo(32, 0);
      blade.lineTo(-7, 5);
      blade.closePath();
      blade.fillPath();
      blade.strokePath();
      blade.setRotation(angle + Math.PI);
      const trail = this.add.graphics().setDepth(47).setBlendMode(Phaser.BlendModes.ADD);
      trail.lineStyle(12, col, 0.3);
      trail.lineBetween(sx, sy, bx, by);
      this.tweens.add({
        targets: blade, x: bx, y: by, scale: { from: 1.7, to: 0.5 },
        delay: i * 65, duration: 300, ease: "power3.in",
        onComplete: () => { blade.destroy(); trail.destroy(); this.cameras.main.shake(70, 0.007); },
      });
      this.tweens.add({ targets: trail, alpha: 0, duration: 280, delay: i * 65 + 150, onComplete: () => trail.destroy() });
    }

    this.time.delayedCall(720, () => {
      this.tweens.add({ targets: dim, alpha: 0, duration: 450, onComplete: () => dim.destroy() });
      this._finaleShortsword(bx, by, damage, col);
    });
  }

  _spawnLifestaffUltimate(damage, col = 0x4ade80) {
    const bx = this.bossX, by = this.bossY;
    const fx = this.charX, fy = this.charY;
    const dim = this.add.rectangle(W / 2, H / 2, W, H, 0x022c22, 0).setDepth(44);
    this.tweens.add({ targets: dim, alpha: 0.5, duration: 200 });
    this.cameras.main.flash(220, 74, 222, 128, false);

    const staff = this.add.graphics().setDepth(49);
    const drawStaff = (x, y, sc) => {
      staff.clear();
      staff.lineStyle(5, col, 1);
      staff.lineBetween(x, y, x, y - 90 * sc);
      staff.fillStyle(0x86efac, 0.95);
      staff.fillCircle(x, y - 94 * sc, 14 * sc);
      staff.fillStyle(col, 0.5);
      staff.fillCircle(x, y - 94 * sc, 22 * sc);
    };
    drawStaff(bx, -60, 1.5);
    this.tweens.add({
      targets: { p: 0 }, p: 1, duration: 420, ease: "power2.in",
      onUpdate: (tw) => {
        const p = tw.getValue();
        drawStaff(bx, Phaser.Math.Linear(-60, by - 20, p), 1.5 - p * 0.2);
      },
      onComplete: () => {
        drawStaff(bx, by - 20, 1.3);
        this.cameras.main.shake(380, 0.022);
        for (let w = 0; w < 4; w++) {
          const wave = this.add.circle(bx, by, 20 + w * 8, col, 0)
            .setStrokeStyle(4, 0xdcfce7, 0.85 - w * 0.15).setDepth(48).setBlendMode(Phaser.BlendModes.ADD);
          this.tweens.add({ targets: wave, scale: 5 + w, alpha: 0, duration: 700, delay: w * 100, onComplete: () => wave.destroy() });
        }
      },
    });

    const healRing = this.add.circle(fx, fy, 25, col, 0.2)
      .setStrokeStyle(4, 0xdcfce7, 1).setDepth(47).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: healRing, scale: 6, alpha: 0, duration: 900, ease: "sine.out", onComplete: () => healRing.destroy() });

    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2;
      const dist = 120 + Math.random() * 140;
      const petal = this.add.circle(fx + Math.cos(a) * dist * 0.3, fy + Math.sin(a) * dist * 0.2, 5, 0xbbf7d0, 0.9)
        .setDepth(46).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: petal, x: bx, y: by, alpha: 0, scale: 0.3,
        duration: 650 + Math.random() * 350, delay: 200 + i * 25, ease: "sine.inOut",
        onComplete: () => petal.destroy(),
      });
    }

    this.time.delayedCall(880, () => {
      const healTxt = this.add.text(fx, fy - 50, "+TEAM", {
        fontFamily: FONT, fontSize: "20px", color: "#bbf7d0", fontStyle: "bold",
        stroke: "#14532d", strokeThickness: 4,
      }).setOrigin(0.5).setDepth(51);
      this.tweens.add({ targets: healTxt, y: fy - 90, alpha: 0, duration: 900, onComplete: () => healTxt.destroy() });
      this.tweens.add({ targets: dim, alpha: 0, duration: 500, onComplete: () => { dim.destroy(); staff.destroy(); } });
      this._finaleLifestaff(bx, by, damage, col);
    });
  }

  _spawnFuryAxeUltimate(damage, col = 0xef4444) {
    const bx = this.bossX, by = this.bossY;
    const dim = this.add.rectangle(W / 2, H / 2, W, H, 0x1a0505, 0).setDepth(44);
    this.tweens.add({ targets: dim, alpha: 0.55, duration: 160 });
    this._updateFuryOverlay(true);
    this.cameras.main.flash(200, 255, 80, 40, false);

    for (let i = 0; i < 6; i++) {
      this.time.delayedCall(i * 100, () => {
        const w = 90 + Math.random() * 70;
        const h = 260 + Math.random() * 120;
        const leftX = bx - w / 2 + (Math.random() - 0.5) * 30;
        const topY = by - h;
        const pillar = this.add.graphics().setDepth(45).setBlendMode(Phaser.BlendModes.ADD);
        pillar.fillStyle(0xef4444, 0.4);
        pillar.fillRect(leftX, topY, w, h);
        pillar.lineStyle(3, 0xf97316, 0.9);
        pillar.strokeRect(leftX, topY, w, h);
        this.tweens.add({ targets: pillar, alpha: 0, scaleY: 1.35, duration: 450, onComplete: () => pillar.destroy() });
        this.cameras.main.shake(120, 0.012);
      });
    }

    const axe = this.add.graphics().setDepth(48).setPosition(bx, by - 140);
    const drawAxe = (sc) => {
      axe.clear();
      axe.fillStyle(0xef4444, 0.95);
      axe.lineStyle(4, 0xfca5a5, 1);
      axe.fillRect(-4 * sc, -30 * sc, 8 * sc, 50 * sc);
      axe.beginPath();
      axe.moveTo(-38 * sc, -8 * sc);
      axe.lineTo(-8 * sc, -8 * sc);
      axe.lineTo(0, -48 * sc);
      axe.lineTo(38 * sc, -8 * sc);
      axe.lineTo(8 * sc, -8 * sc);
      axe.closePath();
      axe.fillPath();
      axe.strokePath();
    };
    drawAxe(2);
    this.tweens.add({
      targets: axe, y: by, angle: 900, scale: { from: 2.2, to: 0.9 },
      duration: 580, ease: "power2.in",
      onComplete: () => {
        axe.destroy();
        this._updateFuryOverlay(false);
        this.tweens.add({ targets: dim, alpha: 0, duration: 400, onComplete: () => dim.destroy() });
        this._finaleFuryAxe(bx, by, damage, col);
      },
    });
  }

  _spawnGatlingLeadStormIntro() {
    if (this._gatlingUltIntroActive) return;
    this._gatlingUltIntroActive = true;
    this.time.delayedCall(1400, () => { this._gatlingUltIntroActive = false; });

    const col = parseInt(String(getWeapon("gatling_gun").color || "#eab308").replace("#", ""), 16);
    const bx = this.bossX, by = this.bossY;
    const dim = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0).setDepth(46);
    this.tweens.add({ targets: dim, alpha: 0.5, duration: 200 });

    const reticle = this.add.graphics().setDepth(47).setBlendMode(Phaser.BlendModes.ADD);
    reticle.lineStyle(2, col, 0.8);
    reticle.strokeCircle(bx, by, 55);
    reticle.strokeCircle(bx, by, 85);
    reticle.lineBetween(0, by, W, by);
    reticle.lineBetween(bx, 0, bx, H);

    const spinGfx = this.add.graphics().setPosition(this.charX, this.charY).setDepth(48);
    let rot = 0;
    const spinTimer = this.time.addEvent({
      delay: 16, loop: true,
      callback: () => {
        rot += 0.4;
        spinGfx.clear();
        spinGfx.lineStyle(3, col, 0.9);
        for (let i = 0; i < 10; i++) {
          const a = rot + (i / 10) * Math.PI * 2;
          spinGfx.lineBetween(0, 0, Math.cos(a) * 32, Math.sin(a) * 32);
        }
        spinGfx.fillStyle(col, 0.4);
        spinGfx.fillCircle(0, 0, 12);
      },
    });

    this.cameras.main.flash(180, 255, 220, 80, false);
    this.cameras.main.shake(300, 0.012);

    this.time.delayedCall(1200, () => {
      spinTimer.remove(false);
      spinGfx.destroy();
      this.tweens.add({ targets: [dim, reticle], alpha: 0, duration: 400, onComplete: () => { dim.destroy(); reticle.destroy(); } });
    });
  }

  _spawnGatlingLeadStormFinale(bx, by, damage, col = 0xeab308) {
    this._finaleGatling(bx, by, damage, col);
  }

  _spawnAnimousHolyUltimate(damage) {
    const bx = this.bossX, by = this.bossY;
    const fx = this.charX, fy = this.charY;
    const col = 0xfbbf24;
    const dim = this.add.rectangle(W / 2, H / 2, W, H, 0x1a1205, 0).setDepth(44);
    this.tweens.add({ targets: dim, alpha: 0.4, duration: 200 });
    this.cameras.main.flash(220, 255, 240, 160, false);

    const dome = this.add.circle(fx, fy, 20, col, 0.15)
      .setStrokeStyle(5, 0xfde68a, 1).setDepth(47).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: dome, scale: 7, alpha: 0, duration: 800, ease: "sine.out", onComplete: () => dome.destroy() });

    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const dist = 100 + Math.random() * 80;
      const sp = this.add.circle(fx + Math.cos(a) * dist * 0.4, fy + Math.sin(a) * dist * 0.3, 4, 0xfde68a, 0.85)
        .setDepth(48).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: sp, x: bx, y: by, alpha: 0, duration: 550 + i * 25, delay: 200 + i * 30,
        onComplete: () => sp.destroy(),
      });
    }

    this.time.delayedCall(700, () => {
      this.tweens.add({ targets: dim, alpha: 0, duration: 450, onComplete: () => dim.destroy() });
      this._finaleAnimousHoly(bx, by, damage);
    });
  }

  _spawnAnimousDemonUltimate(damage) {
    const bx = this.bossX;
    const by = this.bossY;
    const fx = this.charX;
    const fy = this.charY;
    const beamCols = {
      outer: 0x2563eb,
      mid: 0x7c3aed,
      core: 0xffffff,
      accent: 0x38bdf8,
    };
    const sparkCol = 0xf97316;
    const CHARGE_MS = 520;
    const BEAM_MS = 2000;

    const dim = this.add.rectangle(W / 2, H / 2, W, H, 0x020617, 0).setDepth(44);
    this.tweens.add({ targets: dim, alpha: 0.62, duration: CHARGE_MS, ease: "sine.in" });

    const chargeCore = this.add.circle(fx, fy, 10, beamCols.core, 0.95)
      .setBlendMode(Phaser.BlendModes.ADD).setDepth(48);
    const chargeAura = this.add.circle(fx, fy, 18, beamCols.mid, 0.25)
      .setStrokeStyle(4, beamCols.accent, 0.9).setBlendMode(Phaser.BlendModes.ADD).setDepth(47);
    const chargeRing = this.add.circle(fx, fy, 26, beamCols.outer, 0)
      .setStrokeStyle(3, beamCols.outer, 0.75).setBlendMode(Phaser.BlendModes.ADD).setDepth(46);

    this.tweens.add({ targets: chargeCore, scale: 2.6, duration: CHARGE_MS, ease: "power2.in" });
    this.tweens.add({ targets: chargeAura, scale: 3.2, alpha: 0.15, duration: CHARGE_MS, ease: "sine.out" });
    this.tweens.add({
      targets: chargeRing, scale: 4.5, alpha: 0,
      duration: CHARGE_MS, ease: "cubic.out",
    });

    const chargeSparks = [];
    const chargeSparkTimer = this.time.addEvent({
      delay: 42,
      repeat: Math.floor(CHARGE_MS / 42),
      callback: () => {
        const a = Math.random() * Math.PI * 2;
        const dist = 55 + Math.random() * 45;
        const sp = this.add.circle(
          fx + Math.cos(a) * dist, fy + Math.sin(a) * dist * 0.7,
          2 + Math.random() * 2, Math.random() < 0.35 ? sparkCol : beamCols.accent, 0.95,
        ).setBlendMode(Phaser.BlendModes.ADD).setDepth(49);
        chargeSparks.push(sp);
        this.tweens.add({
          targets: sp, x: fx, y: fy, alpha: 0, scale: 0.2,
          duration: 280 + Math.random() * 120, ease: "power2.in",
          onComplete: () => sp.destroy(),
        });
      },
    });

    this.time.delayedCall(CHARGE_MS, () => {
      chargeCore.destroy();
      chargeAura.destroy();
      chargeRing.destroy();
      chargeSparkTimer.remove(false);
      chargeSparks.forEach((s) => { if (s?.active) s.destroy(); });

      const beamGfx = this.add.graphics().setDepth(49).setBlendMode(Phaser.BlendModes.ADD);
      const bloomGfx = this.add.graphics().setDepth(48).setBlendMode(Phaser.BlendModes.ADD);
      let phase = 0;
      let frame = 0;

      const beamTimer = this.time.addEvent({
        delay: 16,
        loop: true,
        callback: () => {
          frame += 1;
          phase += 0.14;
          const ramp = Math.min(1, frame / 18);
          beamGfx.clear();
          bloomGfx.clear();
          bloomGfx.fillStyle(beamCols.outer, 0.08 * ramp);
          bloomGfx.fillCircle(fx, fy, 55 + Math.sin(phase * 4) * 8);
          bloomGfx.fillStyle(beamCols.mid, 0.1 * ramp);
          bloomGfx.fillCircle(bx, by, 48 + Math.sin(phase * 3.2) * 10);
          this._drawKamehamehaBeam(beamGfx, fx, fy, bx, by, phase, beamCols);
        },
      });

      const particleTimer = this.time.addEvent({
        delay: 22,
        loop: true,
        callback: () => {
          const t = Math.random();
          const px = Phaser.Math.Linear(fx, bx, t) + (Math.random() - 0.5) * 28;
          const py = Phaser.Math.Linear(fy, by, t) + (Math.random() - 0.5) * 22;
          const p = this.add.circle(px, py, 2 + Math.random() * 4, beamCols.accent, 0.9)
            .setBlendMode(Phaser.BlendModes.ADD).setDepth(50);
          this.tweens.add({
            targets: p,
            x: px + (bx - fx) * 0.06,
            y: py + (by - fy) * 0.06,
            alpha: 0, scale: 0.15,
            duration: 200 + Math.random() * 140,
            onComplete: () => p.destroy(),
          });
          if (Math.random() < 0.22) {
            const em = this.add.circle(fx - 8, fy, 3, sparkCol, 0.9)
              .setBlendMode(Phaser.BlendModes.ADD).setDepth(50);
            this.tweens.add({
              targets: em, x: em.x + 18 + Math.random() * 20, alpha: 0,
              duration: 160, onComplete: () => em.destroy(),
            });
          }
        },
      });

      const rumbleTimer = this.time.addEvent({
        delay: 90,
        loop: true,
        callback: () => this.cameras.main.shake(55, 0.005 + Math.sin(phase) * 0.002),
      });

      this.time.delayedCall(BEAM_MS, () => {
        beamTimer.remove(false);
        particleTimer.remove(false);
        rumbleTimer.remove(false);
        beamGfx.destroy();
        bloomGfx.destroy();

        for (let r = 0; r < 4; r++) {
          const ring = this.add.circle(bx, by, 18 + r * 12, beamCols.mid, 0)
            .setStrokeStyle(5 - r, beamCols.accent, 0.9 - r * 0.15)
            .setBlendMode(Phaser.BlendModes.ADD).setDepth(51);
          this.tweens.add({
            targets: ring, scale: 2.8 + r * 0.4, alpha: 0,
            duration: 480 + r * 80, delay: r * 60, onComplete: () => ring.destroy(),
          });
        }

        const impactCore = this.add.circle(bx, by, 16, beamCols.core, 0.95)
          .setBlendMode(Phaser.BlendModes.ADD).setDepth(52);
        const impactFlare = this.add.circle(bx, by, 30, beamCols.outer, 0.45)
          .setBlendMode(Phaser.BlendModes.ADD).setDepth(51);
        this.tweens.add({
          targets: impactCore, scale: 4.2, alpha: 0, duration: 520, ease: "power2.out",
          onComplete: () => impactCore.destroy(),
        });
        this.tweens.add({
          targets: impactFlare, scale: 5.5, alpha: 0, duration: 620, ease: "cubic.out",
          onComplete: () => impactFlare.destroy(),
        });

        for (let i = 0; i < 20; i++) {
          const a = (i / 20) * Math.PI * 2;
          const sp = this.add.circle(bx, by, 4, beamCols.accent, 0.9)
            .setBlendMode(Phaser.BlendModes.ADD).setDepth(52);
          this.tweens.add({
            targets: sp,
            x: bx + Math.cos(a) * (60 + Math.random() * 50),
            y: by + Math.sin(a) * (45 + Math.random() * 40),
            alpha: 0, scale: 0.2,
            duration: 450 + Math.random() * 200,
            onComplete: () => sp.destroy(),
          });
        }

        this.cameras.main.shake(480, 0.032);
        this.tweens.add({ targets: dim, alpha: 0, duration: 550, onComplete: () => dim.destroy() });
        this._spawnDamageBurst(damage, true, beamCols.mid);
      });
    });
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

  _spawnGatlingShot(damage, isCrit = false) {
    const weapon = getWeapon("gatling_gun");
    const col = parseInt(String(weapon.color || "#eab308").replace("#", ""), 16);
    const fx = this.charX + 18, fy = this.charY - 8;
    const bx = this.bossX + (Math.random() - 0.5) * 24;
    const by = this.bossY + (Math.random() - 0.5) * 20;
    const ang = Math.atan2(by - fy, bx - fx);
    const bullet = this.add.rectangle(fx, fy, 10, 3, col, 1)
      .setRotation(ang).setBlendMode(Phaser.BlendModes.ADD).setDepth(42);
    const flash = this.add.circle(fx, fy, 5, 0xffffff, 0.9).setBlendMode(Phaser.BlendModes.ADD).setDepth(41);
    this.tweens.add({ targets: flash, alpha: 0, scale: 2, duration: 60, onComplete: () => flash.destroy() });
    this.tweens.add({
      targets: bullet, x: bx, y: by, duration: 72, ease: "linear",
      onComplete: () => {
        bullet.destroy();
        this._spawnDamageBurst(damage, isCrit, col);
      },
    });
    if (Math.random() < 0.12) this.cameras.main.shake(35, 0.002);
  }

  _showGatlingRainBullet(spawnX, spawnY, bossX, bossY, col) {
    const tracer = this.add.circle(spawnX, spawnY, 3, col, 0.85)
      .setBlendMode(Phaser.BlendModes.ADD).setDepth(48);
    this.tweens.add({
      targets: tracer,
      x: bossX + (Math.random() - 0.5) * 36,
      y: bossY + (Math.random() - 0.5) * 28,
      duration: 85 + Math.random() * 55,
      ease: "power2.in",
      onComplete: () => {
        tracer.destroy();
        const spark = this.add.circle(bossX, bossY, 6, col, 0.5)
          .setBlendMode(Phaser.BlendModes.ADD).setDepth(48);
        this.tweens.add({
          targets: spark, scale: 1.8, alpha: 0, duration: 120,
          onComplete: () => spark.destroy(),
        });
      },
    });
  }

  _spawnWeaponAttack(weaponTypeId, damage, isCrit) {
    if (weaponTypeId === "gatling_gun") {
      this._spawnGatlingShot(damage, isCrit);
      return;
    }
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

  _playUltimateCutscene(weaponTypeId, damage, ultimateName) {
    const weapon = getWeapon(weaponTypeId);
    const colHex = weapon?.color || "#fbbf24";
    const label = (ultimateName || weapon?.ultimateName || "ULTIMATE").toUpperCase();
    const cut = this.add.text(W / 2, H * 0.32, label, {
      fontFamily: FONT, fontSize: "40px", color: colHex, fontStyle: "bold",
      stroke: "#0f172a", strokeThickness: 5,
    }).setOrigin(0.5).setDepth(55).setAlpha(0).setScale(1.35);
    this.tweens.add({ targets: cut, alpha: 1, scale: 1, duration: 140, ease: "back.out" });
    this.cameras.main.shake(160, 0.007);
    const fire = () => {
      if (weaponTypeId === "animous_codex") {
        this._spawnAnimousUltimate(this.bookAlignment, damage);
      } else if (weaponTypeId === "gatling_gun" || weaponTypeId === "swift_blade") {
        /* Intro synced via weapon_ult_*_start socket events */
      } else {
        this._spawnWeaponUltimateAttack(weaponTypeId, damage);
      }
    };
    this.time.delayedCall(340, () => {
      this.tweens.add({
        targets: cut, alpha: 0, y: cut.y - 28, duration: 180,
        onComplete: () => { cut.destroy(); fire(); },
      });
    });
  }

  _spawnWeaponUltimateAttack(weaponTypeId, damage) {
    const weapon = getWeapon(weaponTypeId);
    const col = parseInt(String(weapon.color || "#ff9ec8").replace("#", ""), 16);

    if (weaponTypeId === "swift_blade" || weaponTypeId === "gatling_gun") return;

    if (weaponTypeId === "shortsword") {
      this._spawnShortswordUltimate(damage, col);
    } else if (weaponTypeId === "greatsword") {
      this._spawnGreatswordUltimate(damage, col);
    } else if (weaponTypeId === "lifestaff") {
      this._spawnLifestaffUltimate(damage, col);
    } else if (weaponTypeId === "fury_axe") {
      this._spawnFuryAxeUltimate(damage, col);
    } else {
      this._spawnWeaponAttack(weaponTypeId, damage, true);
    }
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

  _showSwiftStabIntoBoss(bx, by, angle, damage, color = 0x22d3ee, hit = 1, totalHits = 12) {
    const len = 110 + Math.random() * 70;
    const x1 = bx + Math.cos(angle) * len;
    const y1 = by + Math.sin(angle) * len;
    const edgeCol = 0xe0f2fe;

    const glow = this.add.graphics().setDepth(45).setBlendMode(Phaser.BlendModes.ADD);
    glow.lineStyle(18, color, 0.22);
    glow.beginPath();
    glow.moveTo(x1, y1);
    glow.lineTo(bx, by);
    glow.strokePath();

    const slash = this.add.graphics().setDepth(46).setBlendMode(Phaser.BlendModes.ADD);
    slash.lineStyle(5, edgeCol, 0.95);
    slash.beginPath();
    slash.moveTo(x1, y1);
    slash.lineTo(bx, by);
    slash.strokePath();
    slash.lineStyle(3, color, 1);
    slash.beginPath();
    slash.moveTo(x1 + Math.cos(angle + 0.4) * 20, y1 + Math.sin(angle + 0.4) * 20);
    slash.lineTo(bx, by);
    slash.strokePath();

    const bladeGfx = this.add.graphics().setDepth(47);
    bladeGfx.fillStyle(edgeCol, 0.9);
    bladeGfx.lineStyle(2, color, 1);
    bladeGfx.beginPath();
    bladeGfx.moveTo(-18, 0);
    bladeGfx.lineTo(-6, -4);
    bladeGfx.lineTo(28, 0);
    bladeGfx.lineTo(-6, 4);
    bladeGfx.closePath();
    bladeGfx.fillPath();
    bladeGfx.setPosition(x1, y1);
    bladeGfx.setRotation(angle + Math.PI);
    this.tweens.add({
      targets: bladeGfx,
      x: bx, y: by,
      duration: 120,
      ease: "power2.in",
      onComplete: () => bladeGfx.destroy(),
    });

    this.tweens.add({
      targets: [glow, slash], alpha: 0, duration: 200,
      onComplete: () => { glow.destroy(); slash.destroy(); },
    });

    for (let w = 0; w < 5; w++) {
      const t = w / 5;
      const px = Phaser.Math.Linear(x1, bx, t);
      const py = Phaser.Math.Linear(y1, by, t);
      const wind = this.add.circle(px, py, 3 + Math.random() * 3, color, 0.7)
        .setBlendMode(Phaser.BlendModes.ADD).setDepth(46);
      this.tweens.add({
        targets: wind, alpha: 0, scale: 0.2, duration: 180 + w * 20,
        onComplete: () => wind.destroy(),
      });
    }

    const tip = this.add.circle(bx, by, 8, color, 0.85)
      .setBlendMode(Phaser.BlendModes.ADD).setDepth(48);
    this.tweens.add({
      targets: tip, scale: 3, alpha: 0, duration: 180,
      onComplete: () => tip.destroy(),
    });

    if (damage > 0 && hit % 3 === 0) {
      const ox = (Math.random() - 0.5) * 24;
      const dmgTxt = this.add.text(bx + ox, by - 22, `-${damage}`, {
        fontFamily: FONT, fontSize: hit === totalHits ? "22px" : "16px",
        color: "#e0f2fe", fontStyle: "bold", stroke: "#0c4a6e", strokeThickness: 3,
      }).setOrigin(0.5).setDepth(48);
      this.tweens.add({
        targets: dmgTxt, y: by - 50, alpha: 0, duration: 420,
        onComplete: () => dmgTxt.destroy(),
      });
    }

    if (this.bossFlash) {
      this.bossFlash.clear();
      this.bossFlash.fillStyle(color, 0.45);
      this.bossFlash.fillCircle(0, 0, 18);
      this.bossFlash.x = bx;
      this.bossFlash.y = by;
      this.bossFlash.alpha = 1;
      this.tweens.add({
        targets: this.bossFlash, alpha: 0, duration: 120,
        onComplete: () => this.bossFlash?.clear(),
      });
    }

    const shakeAmt = hit === totalHits ? 0.02 : 0.006 + (hit % 3) * 0.003;
    this.cameras.main.shake(hit === totalHits ? 0 : 80, shakeAmt);
  }

  _spawnUltimateEffect(specialName, windUpMs, color) {
    const vis = this.bossVisual;
    const col = color ?? vis?.auraColors?.[2] ?? 0xff3d00;
    const hex = `#${col.toString(16).padStart(6, "0")}`;
    this.cameras.main.shake(420, 0.014);
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2, d = 60 + Math.random() * 180;
      const par = this.add.circle(this.bossX, this.bossY, 4, col, 0.75).setBlendMode(Phaser.BlendModes.ADD).setDepth(13);
      this.tweens.add({
        targets: par,
        x: this.bossX + Math.cos(a) * d, y: this.bossY + Math.sin(a) * d,
        alpha: 0, scale: 0.2, duration: 700 + Math.random() * 300,
        onComplete: () => par.destroy(),
      });
    }
    this._showFloatingText(`${specialName || "BOSS"} — ULTIMATE`, hex, 30);
    const showDuration = windUpMs ? windUpMs + 200 : 2200;
    this.time.delayedCall(showDuration, () => {
      if (this.bossPulse) this.tweens.add({ targets: this.bossCont, scale: 1, duration: 200 });
    });
  }

  _showBossUltTelegraph({ x, y, radius, color, durationMs }) {
    const ring = this.add.circle(x, y, radius, color || 0xff4444, 0)
      .setStrokeStyle(3, color || 0xff4444, 0.85).setDepth(16);
    this.tweens.add({
      targets: ring, scale: 1.12, alpha: 0,
      duration: durationMs || 500, onComplete: () => ring.destroy(),
    });
  }

  _showBossUltLane(y, color) {
    const g = this.add.graphics().setDepth(17);
    g.fillStyle(color || 0xf97316, 0.2);
    g.fillRect(0, y - 28, W, 56);
    g.lineStyle(3, color || 0xf97316, 0.85);
    g.strokeRect(0, y - 28, W, 56);
    this.tweens.add({ targets: g, alpha: 0, duration: 500, onComplete: () => g.destroy() });
    this.cameras.main.shake(140, 0.01);
  }

  _showBossUltSweep(y, color) {
    const g = this.add.graphics().setDepth(17);
    g.lineStyle(7, color || 0xa855f7, 0.9);
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(W, y);
    g.strokePath();
    this.tweens.add({ targets: g, alpha: 0, duration: 420, onComplete: () => g.destroy() });
    this.cameras.main.shake(120, 0.009);
  }

  _showBossUltCross(color) {
    const g = this.add.graphics().setDepth(18);
    g.lineStyle(6, color || 0x0ea5e9, 0.9);
    g.beginPath();
    g.moveTo(W / 2, 60);
    g.lineTo(W / 2, H - 60);
    g.moveTo(80, H / 2);
    g.lineTo(W - 80, H / 2);
    g.strokePath();
    this.tweens.add({ targets: g, alpha: 0, duration: 380, onComplete: () => g.destroy() });
    this.cameras.main.shake(200, 0.014);
  }

  _showBossUltDrain(bossX, bossY, charX, charY, color, durationMs) {
    const beam = this.add.graphics().setDepth(17);
    beam.lineStyle(4, color || 0x84cc16, 0.85);
    beam.lineBetween(bossX, bossY, charX, charY);
    const pulse = this.add.circle(charX, charY, 12, color || 0x84cc16, 0.35)
      .setBlendMode(Phaser.BlendModes.ADD).setDepth(18);
    this.tweens.add({
      targets: [beam, pulse], alpha: 0, duration: durationMs || 2800,
      onComplete: () => { beam.destroy(); pulse.destroy(); },
    });
  }

  _showBossUltCrown(x, y, radius, color, shrinkMs) {
    const ring = this.add.circle(x, y, radius, color || 0xff6600, 0)
      .setStrokeStyle(4, color || 0xff6600, 0.9).setDepth(16).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: ring, scale: 0.35, alpha: 0,
      duration: shrinkMs || 4000, ease: "sine.in",
      onComplete: () => ring.destroy(),
    });
  }

  // ── Weapon ────────────────────────────────────────────────────────────────
  _drawWeaponGraphic(gfx, typeId, bookAlignment = null) {
    const weapon = getWeapon(typeId);
    let col = parseInt(String(weapon.color).replace("#", ""), 16);
    if (typeId === "animous_codex") {
      if (bookAlignment === "holy") col = 0xfbbf24;
      else if (bookAlignment === "demon") col = 0xef4444;
    }
    gfx.clear();
    gfx.lineStyle(3, col, 1);
    if (typeId === "animous_codex") {
      gfx.fillStyle(col, 0.85);
      gfx.fillRect(-14, -10, 28, 20);
      gfx.lineStyle(2, col, 1);
      gfx.strokeRect(-14, -10, 28, 20);
      gfx.lineBetween(-10, -6, 10, -6);
      gfx.lineBetween(-10, 0, 10, 0);
      gfx.lineBetween(-10, 6, 10, 6);
    } else if (typeId === "greatsword") {
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
    } else if (typeId === "gatling_gun") {
      gfx.fillStyle(col, 0.9);
      gfx.fillRect(-10, -6, 20, 12);
      gfx.lineStyle(2, col, 1);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        gfx.lineBetween(0, 0, Math.cos(a) * 14, Math.sin(a) * 14);
      }
      gfx.fillCircle(6, 0, 5);
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
    this._applyWeaponTypingStyle();
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

  _onWeaponDrop(x, y, weaponTypeId) {
    this.weaponHeld = false;
    this.weaponHeldBadge.setVisible(false);
    if (weaponTypeId) this.weaponTypeId = weaponTypeId;
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
    // Big danger flash so player knows it's firing HERE
    this.cameras.main.flash(180, 255, 30, 100);
    this.cameras.main.shake(200, 0.018);

    // Large warning ring that quickly expands — gives ~300ms visual cue
    const warn = this.add.circle(x, y, 55, 0xff3d9f, 0).setStrokeStyle(6, 0xff3d9f, 1).setBlendMode(Phaser.BlendModes.ADD).setDepth(18);
    this.tweens.add({ targets: warn, scale: 2.2, alpha: 0, duration: 300, ease: "cubic.out", onComplete: () => warn.destroy() });

    // Inner hot-white core flash
    const core = this.add.circle(x, y, 22, 0xffffff, 0.9).setBlendMode(Phaser.BlendModes.ADD).setDepth(19);
    this.tweens.add({ targets: core, scale: 3, alpha: 0, duration: 220, ease: "cubic.out", onComplete: () => core.destroy() });

    // Expanding shockwave rings
    const ring = this.add.circle(x, y, 20, 0xff3d9f, 0).setStrokeStyle(4, 0xff3d9f, 1).setBlendMode(Phaser.BlendModes.ADD).setDepth(16);
    this.tweens.add({ targets: ring, scale: 6, alpha: 0, duration: 600, ease: "cubic.out", onComplete: () => ring.destroy() });
    const ring2 = this.add.circle(x, y, 10, 0xff9f3d, 0).setStrokeStyle(2, 0xff9f3d, 0.8).setBlendMode(Phaser.BlendModes.ADD).setDepth(16);
    this.tweens.add({ targets: ring2, scale: 9, alpha: 0, duration: 800, ease: "cubic.out", onComplete: () => ring2.destroy() });

    // Radial sparks
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2, d = 70 + Math.random() * 90;
      const p = this.add.circle(x, y, 5, 0xff3d9f, 0.95).setBlendMode(Phaser.BlendModes.ADD).setDepth(17);
      this.tweens.add({ targets: p, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, alpha: 0, scale: 0.2, duration: 380 + Math.random() * 150, ease: "cubic.out", onComplete: () => p.destroy() });
    }

    this._showFloatingText("💥 ERUPTION!", "#ff3d9f", 22);
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
      // Pulsing danger zone — redrawn every frame so it tracks the player
      const t = (Date.now() % 600) / 600; // 0→1 pulse cycle
      const alpha = 0.18 + 0.22 * Math.sin(t * Math.PI * 2); // 0.18–0.40
      this.groundTelegraphGfx.fillStyle(0xff3d9f, alpha);
      this.groundTelegraphGfx.fillCircle(x, y, 58);
      this.groundTelegraphGfx.lineStyle(4, 0xff3d9f, 0.95);
      this.groundTelegraphGfx.strokeCircle(x, y, 58);
      this.groundTelegraphGfx.lineStyle(2, 0xffffff, 0.35);
      this.groundTelegraphGfx.strokeCircle(x, y, 70);
      // Crosshair lines so it's unmissable
      this.groundTelegraphGfx.lineStyle(2, 0xff3d9f, 0.7);
      this.groundTelegraphGfx.lineBetween(x - 70, y, x + 70, y);
      this.groundTelegraphGfx.lineBetween(x, y - 70, x, y + 70);
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

  // ── Depth Charge warning (Leviathan) ───────────────────────────────────────
  _showDepthChargeWarn(x, warnMs = 900) {
    const H = 768;
    // Full-height danger column showing where it will rise from
    const col = this.add.graphics().setDepth(15);
    col.fillStyle(0x22d3ee, 0.12);
    col.fillRect(x - 32, 0, 64, H);
    col.lineStyle(3, 0x22d3ee, 0.85);
    col.lineBetween(x - 32, 0, x - 32, H);
    col.lineBetween(x + 32, 0, x + 32, H);

    const label = this.add.text(x, H - 48, "⚠ DEPTH CHARGE", {
      fontFamily: FONT, fontSize: "14px", color: "#22d3ee", fontStyle: "bold",
      backgroundColor: "rgba(0,20,40,0.85)", padding: { x: 8, y: 4 },
    }).setOrigin(0.5).setDepth(18);
    this.tweens.add({
      targets: label, alpha: { from: 0.85, to: 0.45 }, duration: 450,
      yoyo: true, repeat: -1,
    });

    // Rising "sonar ping" ring that climbs from bottom → impact zone
    const ping = this.add.circle(x, H - 20, 18, 0x22d3ee, 0)
      .setStrokeStyle(4, 0x22d3ee, 1).setBlendMode(Phaser.BlendModes.ADD).setDepth(17);
    this.tweens.add({
      targets: ping, y: 300, scale: 1.6, alpha: { from: 0.9, to: 0 },
      duration: warnMs, ease: "cubic.in",
    });

    // Flash + camera hint at impact X
    const impactFlash = this.add.circle(x, 300, 28, 0x06b6d4, 0)
      .setStrokeStyle(5, 0x22d3ee, 1).setBlendMode(Phaser.BlendModes.ADD).setDepth(17);
    this.tweens.add({
      targets: impactFlash,
      scale: { from: 1, to: 2.5 }, alpha: { from: 0.8, to: 0 },
      duration: warnMs, ease: "sine.out",
    });

    // Clean up everything when warn window ends
    this.time.delayedCall(warnMs, () => {
      col.destroy(); label.destroy();
      ping.destroy(); impactFlash.destroy();
      this.cameras.main.shake(140, 0.012);
      this._showFloatingText("💧 DEPTH CHARGE!", "#22d3ee", 18);
    });
  }

  _showWhirlpoolWarn(x, y, durationMs = 3500) {
    const cx = x ?? W / 2;
    const cy = y ?? 400;
    const dur = durationMs || 3500;
    const ring = this.add.circle(cx, cy, 40, 0x22d3ee, 0.08)
      .setStrokeStyle(4, 0x38bdf8, 0.9).setBlendMode(Phaser.BlendModes.ADD).setDepth(15);
    this.tweens.add({
      targets: ring, scale: 2.8, alpha: { from: 0.85, to: 0.15 },
      duration: dur, ease: "sine.inOut",
      onComplete: () => ring.destroy(),
    });
    const spin = this.add.graphics().setDepth(14);
    const drawSpiral = (rot) => {
      spin.clear();
      spin.lineStyle(3, 0x22d3ee, 0.55);
      for (let i = 0; i < 3; i++) {
        spin.beginPath();
        spin.arc(cx, cy, 55 + i * 22, rot + i * 0.6, rot + i * 0.6 + Math.PI * 1.2);
        spin.strokePath();
      }
    };
    drawSpiral(0);
    this.tweens.add({
      targets: { rot: 0 },
      rot: Math.PI * 2,
      duration: dur,
      repeat: -1,
      onUpdate: (tw) => drawSpiral(tw.getValue()),
      onComplete: () => spin.destroy(),
    });
    const label = this.add.text(cx, cy - 72, "🌀 WHIRLPOOL", {
      fontFamily: FONT, fontSize: "16px", color: "#7dd3fc", fontStyle: "bold",
      stroke: "#0c4a6e", strokeThickness: 3,
    }).setOrigin(0.5).setDepth(18);
    this.tweens.add({ targets: label, alpha: 0, duration: dur, onComplete: () => label.destroy() });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const p = this.add.circle(cx, cy, 4, 0xe0f2fe, 0.85).setBlendMode(Phaser.BlendModes.ADD).setDepth(16);
      this.tweens.add({
        targets: p,
        x: cx + Math.cos(a) * 28,
        y: cy + Math.sin(a) * 28,
        duration: 400,
        yoyo: true,
        repeat: Math.floor(dur / 800),
        onComplete: () => p.destroy(),
      });
    }
    this._showFloatingText("PULL!", "#22d3ee", 18);
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
    const makeBtn = (x, y, label, color, stroke, eventName) => {
      const bg = this.add.rectangle(x, y, 220, 48, 0x1a2347, 0.95)
        .setStrokeStyle(2, stroke, 0.9)
        .setInteractive({ useHandCursor: true })
        .setDepth(60);
      const txt = this.add.text(x, y, label, {
        fontFamily: FONT, fontSize: "15px", color, fontStyle: "bold",
      }).setOrigin(0.5).setDepth(61);
      bg.on("pointerover", () => bg.setFillStyle(0x2a4470, 0.95));
      bg.on("pointerout", () => bg.setFillStyle(0x1a2347, 0.95));
      bg.on("pointerdown", () => window.dispatchEvent(new CustomEvent(eventName)));
      return [bg, txt];
    };
    const targets = [
      ...makeBtn(W / 2 - 125, H / 2 + 120, "Chơi lại", "#fde68a", 0xfbbf24, "typeduo_play_again"),
      ...makeBtn(W / 2 + 125, H / 2 + 120, "Rời phòng", "#4ef0d4", 0x4ef0d4, "typeduo_leave_room"),
    ];
    this.tweens.add({ targets, alpha: { from: 0, to: 1 }, duration: 600, ease: "cubic.out" });
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

      game_paused: ({ paused }) => { this.gamePaused = Boolean(paused); },

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
        if (state.bossDisplayName && this.bossLabel) {
          this.bossLabel.setText(String(state.bossDisplayName).toUpperCase());
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
        this.weaponRage = state.weaponRage ?? this.weaponRage ?? 0;
        this.ultimateMode = state.ultimateMode ?? false;
        this.wordExpiresAt = state.wordExpiresAt || 0;
        this.streakText?.setVisible(this.weaponStreak >= 2 && getWeapon(this.weaponTypeId).streakDamage);
        if (this.streakText?.visible) this.streakText.setText(`CHUỖI ×${this.weaponStreak}`);
        if (state.book) this._applyBookState(state.book);
        if (state.paused != null) this.gamePaused = Boolean(state.paused);
        this.expectedWord = state.currentWord || "";
        this.localTypedProgress = state.typedProgress || 0;
        this._renderWord(this.expectedWord, this.localTypedProgress);
        this._drawRageBar(this.weaponRage, this.ultimateMode);
        if (this.weaponTypeId === "animous_codex" && this.weaponGfx) {
          this._drawWeaponGraphic(this.weaponGfx, "animous_codex", this.bookAlignment);
        }
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

      typing_progress: ({ currentWord, typedProgress, weaponStreak, wordExpiresAt, weaponTypeId, weaponRage, ultimateMode, currentWordPhase, book, gatlingTarget }) => {
        this.expectedWord = currentWord || ""; this.localTypedProgress = typedProgress || 0;
        if (currentWordPhase) this.currentWordPhase = currentWordPhase;
        if (weaponStreak != null) {
          this.weaponStreak = weaponStreak;
          if (weaponStreak === 0 && this.weaponTypeId === "fury_axe") this._updateFuryOverlay(false);
        }
        if (wordExpiresAt != null) this.wordExpiresAt = wordExpiresAt;
        if (weaponTypeId) this.weaponTypeId = weaponTypeId;
        if (weaponRage != null) this.weaponRage = weaponRage;
        if (ultimateMode != null) this.ultimateMode = ultimateMode;
        if (book) this._applyBookState(book);
        if (this.ultimateMode || currentWordPhase === "ultimate") {
          if (this.gatlingGridTxt) this.gatlingGridTxt.setVisible(false);
        }
        this._renderWord(this.expectedWord, this.localTypedProgress);
        this._drawRageBar(this.weaponRage, this.ultimateMode);
        if (ultimateMode || currentWordPhase === "ultimate") {
          this.typedTxt.setColor("#fef3c7");
          this.typedTxt.setStroke("#78350f", 2);
          this.typedTxt.setShadow(0, 0, "#fbbf24", 20, false, true);
        } else if (weaponStreak != null || weaponTypeId) {
          this._applyWeaponTypingStyle();
        }
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

      typo_feed: ({ heal, enraged }) => {
        if (heal > 0) {
          this._showFloatingText(enraged ? `LEECH +${heal}` : `FEED +${heal}`, enraged ? "#ef4444" : "#84cc16", 24);
          this.tweens.add({ targets: this.bossHpFill, alpha: { from: 0.3, to: 1 }, duration: 200 });
        }
      },

      typing_challenge: ({ active, kind, word, progress }) => {
        this.challengeKind = active ? kind : null;
        if (active && word) {
          this.expectedWord = word;
          this.localTypedProgress = progress || 0;
          this._renderWord(word, this.localTypedProgress);
          const colors = {
            windup_cancel: "#fbbf24",
            shield_break: "#38bdf8",
            minion: "#a3e635",
            pillar: "#c084fc",
            player_stun: "#f472b6",
          };
          const col = colors[kind] || "#fbbf24";
          this.typedTxt.setColor("#fff7ed");
          this.typedTxt.setStroke("#1e1b4b", 2);
          this.typedTxt.setShadow(0, 0, col, 16, false, true);
          this._showAttackWarning(kind === "windup_cancel" ? "CANCEL!" : kind?.toUpperCase() || "TYPE");
        }
      },

      overcharge_start: () => {
        this.cameras.main.flash(200, 255, 80, 80, false);
        this._showFloatingText("OVERCHARGE — TYPE YOUR WORD!", "#fbbf24", 26);
      },
      overcharge_cancelled: () => {
        this._showFloatingText("CANCELLED!", "#4ade80", 30);
        this.cameras.main.flash(150, 80, 255, 120, false);
      },
      overcharge_hit: ({ damage }) => {
        this._showFloatingText(`HIT -${damage}`, "#ef4444", 34);
        this.cameras.main.shake(400, 0.02);
      },

      typable_minions_spawn: ({ minions }) => {
        // Destroy any existing minion sprites first
        (this._minionSprites || []).forEach((s) => { s.aura?.destroy(); s.body?.destroy(); s.inner?.destroy(); s.icon?.destroy(); s.shadow?.destroy(); });
        this._minionSprites = [];
        (minions || []).forEach((m) => {
          // Shadow orb (bottom layer)
          const shadow = this.add.circle(m.x, m.y + 6, 14, 0x000000, 0.35).setDepth(13);
          // Aura ring (outer glow)
          const aura = this.add.circle(m.x, m.y, 30, 0xef4444, 0)
            .setStrokeStyle(3, 0xff6b35, 0.9).setBlendMode(Phaser.BlendModes.ADD).setDepth(14);
          // Body (main circle)
          const body = this.add.circle(m.x, m.y, 18, 0xdc2626, 0.95)
            .setStrokeStyle(2.5, 0xff3d00, 1).setDepth(15);
          // Inner glow core
          const inner = this.add.circle(m.x, m.y, 8, 0xff9966, 0.9)
            .setBlendMode(Phaser.BlendModes.ADD).setDepth(16);
          // Danger icon
          const icon = this.add.text(m.x, m.y, '☠', {
            fontFamily: FONT, fontSize: '16px', color: '#fef2f2', fontStyle: 'bold',
          }).setOrigin(0.5, 0.5).setDepth(17);
          // Pulse aura continuously
          this.tweens.add({ targets: aura, scale: { from: 1, to: 1.55 }, alpha: { from: 0.7, to: 0 }, duration: 700, repeat: -1, ease: 'sine.out' });
          // Pulse body
          this.tweens.add({ targets: body, scale: { from: 1, to: 1.1 }, duration: 400, yoyo: true, repeat: -1, ease: 'sine.inOut' });
          // Orbit inner core
          this.tweens.add({ targets: inner, angle: { from: 0, to: 360 }, duration: 1200, repeat: -1, ease: 'linear' });
          this._minionSprites.push({ id: m.id, aura, body, inner, icon, shadow, tx: m.x, ty: m.y });
        });
        this.cameras.main.flash(160, 220, 40, 40, false);
        this._showFloatingText('⚠ MINION INCOMING!', '#ff6b35', 24);
      },

      typable_minion_killed: ({ id, x, y }) => {
        const idx = this._minionSprites?.findIndex((s) => s.id === id);
        if (idx >= 0) {
          const s = this._minionSprites[idx];
          s.aura?.destroy(); s.body?.destroy(); s.inner?.destroy(); s.icon?.destroy(); s.shadow?.destroy();
          this._minionSprites.splice(idx, 1);
        }
        if (x != null && y != null) {
          // Big explosion ring
          const ring1 = this.add.circle(x, y, 18, 0xff3d00, 0).setStrokeStyle(4, 0xff6b35, 1).setBlendMode(Phaser.BlendModes.ADD).setDepth(18);
          this.tweens.add({ targets: ring1, scale: 4.5, alpha: 0, duration: 520, ease: 'cubic.out', onComplete: () => ring1.destroy() });
          const ring2 = this.add.circle(x, y, 8, 0xfbbf24, 0.6).setBlendMode(Phaser.BlendModes.ADD).setDepth(18);
          this.tweens.add({ targets: ring2, scale: 7, alpha: 0, duration: 700, ease: 'cubic.out', onComplete: () => ring2.destroy() });
          // Sparks burst
          for (let i = 0; i < 18; i++) {
            const a = (i / 18) * Math.PI * 2;
            const d = 40 + Math.random() * 60;
            const spark = this.add.circle(x, y, 3 + Math.random() * 3, Math.random() < 0.5 ? 0xff6b35 : 0xfbbf24, 0.95).setBlendMode(Phaser.BlendModes.ADD).setDepth(19);
            this.tweens.add({ targets: spark, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, alpha: 0, scale: 0.15, duration: 380 + Math.random() * 160, ease: 'cubic.out', onComplete: () => spark.destroy() });
          }
          this.cameras.main.shake(120, 0.009);
        }
      },

      typable_minions_update: ({ minions }) => {
        // Sync minion positions from backend chase AI
        (minions || []).forEach((m) => {
          const s = (this._minionSprites || []).find((sp) => sp.id === m.id);
          if (!s) return;
          s.tx = m.x; s.ty = m.y;
        });
      },

      minion_hit: ({ id, x, y, damage }) => {
        // Minion reached the player — flash screen and show damage
        this.cameras.main.flash(250, 220, 40, 40, false);
        this.cameras.main.shake(200, 0.012);
        this._showFloatingText(`MINION -${damage}`, '#ef4444', 28);
        // Remove the sprite locally too
        const idx = this._minionSprites?.findIndex((s) => s.id === id);
        if (idx >= 0) {
          const s = this._minionSprites[idx];
          s.aura?.destroy(); s.body?.destroy(); s.inner?.destroy(); s.icon?.destroy(); s.shadow?.destroy();
          this._minionSprites.splice(idx, 1);
        }
      },

      typable_minions_cleared: () => {
        (this._minionSprites || []).forEach((s) => { s.aura?.destroy(); s.body?.destroy(); s.inner?.destroy(); s.icon?.destroy(); s.shadow?.destroy(); });
        this._minionSprites = [];
        this.cameras.main.flash(200, 80, 255, 120, false);
        this._showFloatingText('MINIONS CLEARED', '#4ade80', 22);
      },

      typable_pillars_spawn: ({ pillars }) => {
        // Clear any old pillar sprites
        (this._pillarSprites || []).forEach((p) => { p.col?.destroy(); p.glow?.destroy(); p.core?.destroy(); p.warn?.destroy(); p.label?.destroy(); });
        this._pillarSprites = [];
        (pillars || []).forEach((pil) => {
          const px = pil.x, py = 300;
          const colH = 380;
          // Warning column background (full height)
          const col = this.add.graphics().setDepth(13);
          col.fillStyle(0xc084fc, 0.12);
          col.fillRect(px - 35, 60, 70, colH);
          col.lineStyle(2, 0xc084fc, 0.65);
          col.strokeRect(px - 35, 60, 70, colH);
          // Inner glow column
          const glow = this.add.graphics().setDepth(14).setBlendMode(Phaser.BlendModes.ADD);
          glow.fillStyle(0xa855f7, 0.25);
          glow.fillRect(px - 18, 60, 36, colH);
          // Pulsing energy core
          const core = this.add.graphics().setDepth(15).setBlendMode(Phaser.BlendModes.ADD);
          core.fillStyle(0xe879f9, 0.7);
          core.fillRoundedRect(px - 7, 60, 14, colH, 4);
          // Pulse the core
          this.tweens.add({ targets: core, alpha: { from: 0.8, to: 0.25 }, duration: 480, yoyo: true, repeat: -1, ease: 'sine.inOut' });
          // Warning text label at top of pillar
          const label = this.add.text(px, 52, '⚡ PILLAR', {
            fontFamily: FONT, fontSize: '12px', color: '#f0abfc', fontStyle: 'bold',
            backgroundColor: 'rgba(88,28,135,0.85)', padding: { x: 6, y: 3 },
          }).setOrigin(0.5, 1).setDepth(16);
          this.tweens.add({ targets: label, alpha: { from: 1, to: 0.35 }, duration: 500, yoyo: true, repeat: -1 });
          // Diamond gem at center
          const warn = this.add.graphics().setDepth(15);
          warn.fillStyle(0xe879f9, 0.9);
          warn.fillTriangle(px, py - 24, px - 14, py, px + 14, py);
          warn.fillTriangle(px, py + 24, px - 14, py, px + 14, py);
          this.tweens.add({ targets: warn, scale: { from: 1, to: 1.18 }, duration: 600, yoyo: true, repeat: -1, ease: 'sine.inOut' });
          this._pillarSprites.push({ id: pil.id, x: pil.x, col, glow, core, warn, label });
          // Also show column warning overlay
          this._showColumnWarning({ x: pil.x, width: 70, color: 0xc084fc, durationMs: pil.warnMs || 4000 });
        });
        this._showFloatingText('⚡ TYPE TO BREAK PILLARS!', '#c084fc', 22);
      },

      typable_pillars_cleared: () => {
        (this._pillarSprites || []).forEach((p) => { p.col?.destroy(); p.glow?.destroy(); p.core?.destroy(); p.warn?.destroy(); p.label?.destroy(); });
        this._pillarSprites = [];
        this.cameras.main.flash(200, 180, 80, 255, false);
        this._showFloatingText('PILLARS CLEARED', '#4ade80', 22);
      },

      typable_pillar_destroyed: ({ id, x }) => {
        // Remove matching pillar sprite
        const idx = (this._pillarSprites || []).findIndex((p) => p.id === id || p.x === x);
        if (idx >= 0) {
          const s = this._pillarSprites[idx];
          s.col?.destroy(); s.glow?.destroy(); s.core?.destroy(); s.warn?.destroy(); s.label?.destroy();
          this._pillarSprites.splice(idx, 1);
        }
        if (x != null) {
          // Crystal shatter effect
          const shatter = this.add.circle(x, 300, 22, 0xe879f9, 0.9).setBlendMode(Phaser.BlendModes.ADD).setDepth(18);
          this.tweens.add({ targets: shatter, scale: 5, alpha: 0, duration: 450, ease: 'cubic.out', onComplete: () => shatter.destroy() });
          for (let i = 0; i < 14; i++) {
            const a = (i / 14) * Math.PI * 2;
            const shard = this.add.circle(x, 300, 4, 0xc084fc, 0.95).setBlendMode(Phaser.BlendModes.ADD).setDepth(18);
            this.tweens.add({ targets: shard, x: x + Math.cos(a) * (50 + Math.random() * 60), y: 300 + Math.sin(a) * (50 + Math.random() * 60), alpha: 0, scale: 0.15, duration: 400 + Math.random() * 150, ease: 'cubic.out', onComplete: () => shard.destroy() });
          }
        }
        this._showFloatingText('PILLAR SHATTERED!', '#c084fc', 20);
      },

      typable_pillar_fire: ({ x }) => {
        // Destroy matching pillar sprite when it fires
        const idx = (this._pillarSprites || []).findIndex((p) => p.x === x);
        if (idx >= 0) {
          const s = this._pillarSprites[idx];
          s.col?.destroy(); s.glow?.destroy(); s.core?.destroy(); s.warn?.destroy(); s.label?.destroy();
          this._pillarSprites.splice(idx, 1);
        }
        this._showColumnFire({ x, width: 70, color: 0xff4444, durationMs: 500 });
      },

      shield_word_start: () => this._showFloatingText("BREAK SHIELD!", "#38bdf8", 24),
      shield_word_broken: () => {
        this._showFloatingText("SHIELD DOWN!", "#4ade80", 28);
        this.cameras.main.flash(200, 56, 189, 248, false);
      },

      paralyze_windup: ({ durationMs }) => this._showParalyzeWindup(durationMs || 2200),

      player_stun_start: () => this._startParalyzeVisual(),
      player_stun_cleared: () => {
        this._endParalyzeVisual();
        this._showFloatingText("FREE!", "#4ade80", 24);
        this.cameras.main.flash(150, 80, 255, 120, false);
      },

      laser_beam_start: ({ x, width, warnMs, color }) => {
        this._showColumnWarning({ x, width: width || 72, color: color || 0xff2244, durationMs: warnMs || 1100 });
        this._laserX = x;
        this._laserW = width;
      },
      laser_beam_fire: ({ x, width, color }) => {
        this._laserGfx?.destroy();
        this._laserGfx = this.add.rectangle(x, 300, width || 72, 520, color || 0xff2244, 0.35)
          .setDepth(8).setBlendMode(Phaser.BlendModes.ADD);
      },
      laser_beam_end: () => {
        this._laserGfx?.destroy();
        this._laserGfx = null;
      },

      mirror_word_start: ({ source, reversed }) => {
        this._showFloatingText(`MIRROR: ${source} →`, "#c084fc", 20);
        this.expectedWord = reversed;
        this.localTypedProgress = 0;
        this._renderWord(reversed, 0);
      },
      mirror_word_cleared: () => this._showFloatingText("MIRROR CLEAR", "#4ade80", 22),

      chain_cancel_start: ({ chainTotal }) => {
        this._showFloatingText(`CHAIN — TYPE ${chainTotal || 3} WORDS!`, "#fbbf24", 24);
        this.cameras.main.flash(160, 255, 180, 60, false);
      },
      chain_cancel_progress: ({ completed, total }) => {
        this._showFloatingText(`CHAIN ${completed}/${total}`, "#fbbf24", 20);
      },

      safe_zone_start: ({ x, y, radius, word }) => {
        this._safeZoneGfx?.destroy();
        this._safeZoneGfx = this.add.circle(x, y, radius, 0x22d3ee, 0.2)
          .setStrokeStyle(3, 0x4ef0d4, 0.9).setDepth(7);
        this._showFloatingText(`SAFE ZONE — ${word}`, "#4ef0d4", 20);
      },
      safe_zone_shield: ({ x, y, radius }) => {
        this._safeZoneGfx?.destroy();
        this._safeZoneGfx = this.add.circle(x, y, radius, 0x4ef0d4, 0.35)
          .setStrokeStyle(4, 0xffffff, 1).setDepth(7);
        this._showFloatingText("SHIELD UP!", "#4ade80", 26);
      },
      map_blast: ({ damage, safe }) => {
        if (!safe) {
          this.cameras.main.shake(500, 0.025);
          this.cameras.main.flash(400, 255, 60, 60, false);
          this._showFloatingText(`MAP BLAST -${damage}`, "#ef4444", 32);
        } else {
          this._showFloatingText("SAFE!", "#4ade80", 28);
        }
        this._safeZoneGfx?.destroy();
        this._safeZoneGfx = null;
      },

      typo_bomb: ({ damage }) => {
        this.cameras.main.shake(350, 0.018);
        this._showFloatingText(`TYPO BOMB -${damage}`, "#84cc16", 30);
      },

      weapon_ultimate_ready: ({ name, phrase, weaponRage, currentWordPhase }) => {
        this.ultimateMode = true;
        this.currentWordPhase = currentWordPhase || "ultimate";
        if (weaponRage != null) this.weaponRage = weaponRage;
        this._drawRageBar(this.weaponRage, true);
        this._showFloatingText(`${name} — GÕ CÂU VÀNG!`, "#fbbf24", 30);
        this.expectedWord = phrase;
        this.localTypedProgress = 0;
        if (this.gatlingGridTxt) this.gatlingGridTxt.setVisible(false);
        this._renderWord(phrase, 0);
        this.typedTxt.setColor("#fef3c7");
        this.typedTxt.setStroke("#78350f", 2);
        this.typedTxt.setShadow(0, 0, "#fbbf24", 20, false, true);
      },

      typo_backlash: ({ socketId, damage }) => {
        if (socketId === this.localSocketId) {
          this._shakeWord();
          this.cameras.main.flash(120, 180, 40, 40, false);
          this._showFloatingText(`TYPO -${damage}`, "#ef4444", 28);
        }
      },

      boss_transform: ({ displayName, visualKey, bossHP, bossMaxHP, message }) => {
        const vis = BOSS_VISUALS[visualKey] || this.bossVisual;
        this.bossVisual = vis;
        const label = (displayName || vis.label).toUpperCase();
        if (this.bossLabel) this.bossLabel.setText(label);
        this.bossHP = bossHP ?? this.bossHP;
        this.bossMaxHP = bossMaxHP ?? this.bossMaxHP;
        this.bossPhaseIdx = 0;
        this._drawBossShape(false, true);
        this._drawBossHpBar(this.bossHP, this.bossMaxHP);
        this.cameras.main.flash(500, 34, 211, 238, false);
        this.cameras.main.shake(320, 0.012);
        if (message) this._showFloatingText(message, "#22d3ee", 22);
      },

      weapon_ult_swift_start: ({ bossX, bossY }) => {
        const col = parseInt(String(getWeapon("swift_blade").color || "#22d3ee").replace("#", ""), 16);
        if (bossX != null) this.bossX = bossX;
        if (bossY != null) this.bossY = bossY;
        this._spawnSwiftStormUltimate(0, col);
      },

      weapon_ult_swift_stab: ({ bossX, bossY, angle, damage, hit, totalHits, finale }) => {
        const col = parseInt(String(getWeapon("swift_blade").color || "#22d3ee").replace("#", ""), 16);
        const bx = bossX ?? this.bossX;
        const by = bossY ?? this.bossY;
        const h = hit || 1;
        const t = totalHits || 12;
        if (finale || h === t) {
          this._spawnSwiftStormFinale(bx, by, (damage || 20) * t, col);
        } else {
          this._showSwiftStabIntoBoss(bx, by, angle, damage, col, h, t);
        }
      },

      gatling_shot: ({ letter, damage, stunBonus, bossX, bossY }) => {
        if (letter) {
          this.expectedWord = letter;
          this.localTypedProgress = 0;
          this._renderGatlingBoard(letter);
          this.tweens.add({
            targets: this.typedTxt, scale: 1.2, duration: 50, yoyo: true,
            onComplete: () => this.typedTxt?.setScale(1),
          });
        }
        this._spawnGatlingShot(damage || 1, Boolean(stunBonus));
        if (bossX != null && bossY != null) {
          this.bossFlash?.clear();
          this.bossFlash?.fillStyle(0xeab308, 0.25);
          this.bossFlash?.fillCircle(bossX, bossY, 18);
        }
      },

      weapon_ult_gatling_start: ({ bossX, bossY }) => {
        if (bossX != null) this.bossX = bossX;
        if (bossY != null) this.bossY = bossY;
        this._spawnGatlingLeadStormIntro();
      },

      weapon_ult_gatling_rain: ({ spawnX, spawnY, damage, hit, totalHits, bossX, bossY, finale }) => {
        const col = parseInt(String(getWeapon("gatling_gun").color || "#eab308").replace("#", ""), 16);
        const bx = bossX ?? this.bossX;
        const by = bossY ?? this.bossY;
        const h = hit || 1;
        const t = totalHits || 56;
        if (finale || h === t) {
          this._spawnGatlingLeadStormFinale(bx, by, (damage || 8) * t, col);
        } else {
          this._showGatlingRainBullet(spawnX ?? W / 2, spawnY ?? 30, bx, by, col);
          if (h % 8 === 0) this.cameras.main.shake(55, 0.004);
        }
      },

      word_completed: (payload) => {
        if (!payload) return;
        const {
          by, word, damage, minionKilled, pillarDestroyed, paralyzeCleared, windupCancelled,
          chainProgress, stunBonus, healed, weaponTypeId, weaponStreak, ultimate, ultimateName,
          weaponRage, book, bookMeta, aborted,
        } = payload;
        if (aborted) return;
        if (weaponTypeId) this.weaponTypeId = weaponTypeId;
        if (weaponStreak != null) {
          this.weaponStreak = weaponStreak;
          if (weaponStreak === 0 && this.weaponTypeId === "fury_axe") this._updateFuryOverlay(false);
        }
        if (weaponRage != null) this.weaponRage = weaponRage;
        if (book) this._applyBookState(book);
        if (bookMeta?.transformed) this._playBookTransform(bookMeta.transformed);
        if (ultimate) this.ultimateMode = false;
        this._drawRageBar(this.weaponRage, this.ultimateMode);
        if (ultimate) {
          this._showFloatingText(`${ultimateName || "ULTIMATE"}! −${damage}`, "#fbbf24", 36);
          this.cameras.main.shake(280, 0.015);
        }
        if (minionKilled) this._showFloatingText("MINION DOWN!", "#a3e635", 20);
        if (pillarDestroyed) this._showFloatingText("PILLAR DOWN!", "#c084fc", 20);
        if (paralyzeCleared) this._showFloatingText("PARALYZE BROKEN!", "#4ade80", 22);
        if (windupCancelled) this._showFloatingText("CANCELLED!", "#4ade80", 24);
        if (chainProgress && !windupCancelled) {
          this._showFloatingText(`CHAIN ${chainProgress.completed}/${chainProgress.total}`, "#fbbf24", 18);
        }
        this._applyWeaponTypingStyle();
        if (by && word) {
          const extra = paralyzeCleared ? " → free"
            : windupCancelled ? " → cancel"
            : chainProgress ? ` → chain ${chainProgress.completed}/${chainProgress.total}`
            : minionKilled ? " → minion"
            : pillarDestroyed ? " → pillar" : "";
          const dmgLabel = damage > 0 ? `−${damage}` : minionKilled || pillarDestroyed ? "✓" : "−0";
          this.flashTxt.setText(`${by} typed "${word}"  ${dmgLabel}${stunBonus ? " ×2" : ""}${extra}`).setColor(stunBonus ? "#fbbf24" : "#86efac").setAlpha(1);
          this.flashTxt.y = 260;
          this.tweens.add({ targets: this.flashTxt, y: 220, alpha: 0, duration: 850, ease: "cubic.out" });
          if (ultimate) {
            const wid = weaponTypeId || this.weaponTypeId;
            this._playUltimateCutscene(wid, damage, ultimateName);
          } else {
            this._spawnWeaponAttack(weaponTypeId || this.weaponTypeId, damage, Boolean(stunBonus));
          }

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

      roles_swapped: ({ players, weaponTypeId, weaponHeld }) => {
        if (this.isSolo) return;
        this._setCharLabels(players);
        const lp = players.find(p => p.socketId === this.localSocketId);
        if (lp) {
          this.isRunner = lp.role === "runner";
          this.canType  = lp.role === "typer";
          this._updateRoleBadge();
          this._bindKeyboard();
        }
        const teamWeapon = weaponTypeId || players?.find((p) => p.weaponTypeId)?.weaponTypeId;
        if (teamWeapon) {
          this.weaponTypeId = teamWeapon;
          this._applyWeaponTypingStyle();
          if (weaponHeld) this._updateWeaponHeldBadge();
        }
        this._drawBossShape(false, false);
      },

      toxic_pool_placed: ({ x, y, radius, durationMs }) => this._showHazardZone(x, y, radius, durationMs, "toxic"),
      slow_field_placed: ({ x, y, radius, durationMs }) => this._showHazardZone(x, y, radius, durationMs, "slow"),
      delayed_marker:    ({ x, y, detonateMs }) => this._showDelayedMarker(x, y, detonateMs),
      book_pair_offer: ({ good, evil, goodProgress, evilProgress }) => {
        this.bookAlignment = "neutral";
        this.bookTemptation = null;
        this.bookCommitted = false;
        this.bookNeutralPrefix = "";
        this.bookOfferGood = good;
        this.bookOfferEvil = evil;
        this.bookGoodProgress = goodProgress ?? 0;
        this.bookEvilProgress = evilProgress ?? 0;
        this.expectedWord = "";
        this.localTypedProgress = 0;
        this._renderBookNeutralPair(0);
      },
      book_commit: ({ pool, currentWord, typedProgress }) => {
        this.bookCommitted = true;
        this.expectedWord = currentWord;
        this.localTypedProgress = typedProgress || 0;
        this._renderBookNeutralPair(this.localTypedProgress);
      },
      book_transform: ({ alignment, currentWord, temptation }) => {
        this.bookAlignment = alignment;
        this.bookCommitted = true;
        this.bookTemptation = temptation || null;
        this.expectedWord = currentWord || "";
        this.localTypedProgress = 0;
        this._playBookTransform(alignment);
        this._renderWord(this.expectedWord, 0);
        if (temptation) {
          const hint = alignment === "demon" ? "từ thánh" : "từ ác";
          this._showFloatingText(`SPACE×2 bỏ ${hint} khi gặp!`, "#94a3b8", 16);
        }
      },
      book_temptation_skipped: ({ currentWord, typedProgress, book }) => {
        this.expectedWord = currentWord || "";
        this.localTypedProgress = typedProgress || 0;
        if (book) this._applyBookState(book);
        this._renderWord(this.expectedWord, this.localTypedProgress);
        this._showFloatingText("Đã bỏ từ cám dỗ!", "#4ade80", 18);
      },
      book_fall_neutral: () => {
        this._showFloatingText("TRUNG LẬP — chọn lại!", "#94a3b8", 28);
        this.bookAlignment = "neutral";
        this.bookCommitted = false;
        this.bookNeutralPrefix = "";
        this.bookGoodProgress = 0;
        this.bookEvilProgress = 0;
        this.bookTemptation = null;
      },
      book_aegis_block: () => this._showFloatingText("AEGIS!", "#fde68a", 22),
      book_sanctuary_block: () => this._showFloatingText("SANCTUARY", "#fde68a", 24),
      book_sanctuary_start: () => this._showFloatingText("SANCTUARY PSALM", "#fde68a", 30),
      book_demon_typo: ({ damage }) => this._showFloatingText(`SELF -${damage}`, "#ef4444", 22),

      depth_charge_warn: ({ x, warnMs }) => this._showDepthChargeWarn(x, warnMs ?? 900),
      whirlpool_start:   ({ x, y, durationMs }) => this._showWhirlpoolWarn(x, y, durationMs ?? 3500),
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
        const blast = this.add.circle(x, y, radius, color || 0xff3d9f, 0.35).setBlendMode(Phaser.BlendModes.ADD).setDepth(18);
        this.tweens.add({ targets: blast, scale: 1.4, alpha: 0, duration: 450, onComplete: () => blast.destroy() });
        this.cameras.main.shake(220, 0.014);
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

      boss_ultimate_start: ({ specialName, windUpMs, color }) => this._spawnUltimateEffect(specialName, windUpMs, color),

      boss_ult_reaper_start: ({ color }) => this._showFloatingText("HARVEST MOON", `#${(color || 0xa855f7).toString(16).padStart(6, "0")}`, 26),
      boss_ult_reaper_sweep: ({ y, color }) => this._showBossUltSweep(y, color),
      boss_ult_reaper_telegraph: (d) => this._showBossUltTelegraph(d),

      boss_ult_matron_start: ({ color }) => this._showFloatingText("ANVIL DESCENT", `#${(color || 0xb45309).toString(16).padStart(6, "0")}`, 26),
      boss_ult_matron_anvil: ({ x, y, color }) => {
        const g = this.add.graphics().setDepth(17);
        g.fillStyle(color || 0xb45309, 0.5);
        g.fillRect(x - 40, y - 80, 80, 80);
        this.tweens.add({ targets: g, alpha: 0, y: y + 30, duration: 400, onComplete: () => g.destroy() });
        this.cameras.main.shake(160, 0.012);
      },
      boss_ult_matron_telegraph: (d) => this._showBossUltTelegraph(d),

      boss_ult_serpent_start: ({ color }) => this._showFloatingText("SERPENT COIL", `#${(color || 0x6366f1).toString(16).padStart(6, "0")}`, 26),
      boss_ult_serpent_coil: ({ color }) => {
        const ring = this.add.circle(W / 2, H / 2, 280, color || 0x6366f1, 0)
          .setStrokeStyle(3, color || 0x6366f1, 0.7).setDepth(15);
        this.tweens.add({ targets: ring, scale: 0.85, alpha: 0, duration: 1200, onComplete: () => ring.destroy() });
      },

      boss_ult_cinder_start: ({ color }) => this._showFloatingText("CROWN OF CINDERS", `#${(color || 0xff6600).toString(16).padStart(6, "0")}`, 26),
      boss_ult_cinder_crown: (d) => this._showBossUltCrown(d.x, d.y, d.radius, d.color, d.shrinkMs),
      boss_ult_cinder_telegraph: (d) => this._showBossUltTelegraph(d),

      boss_ult_glitch_start: ({ color }) => this._showFloatingText("KERNEL PANIC", `#${(color || 0xe879f9).toString(16).padStart(6, "0")}`, 26),
      boss_ult_glitch_bars: ({ color, durationMs }) => {
        const g = this.add.graphics().setDepth(15);
        g.fillStyle(color || 0xe879f9, 0.08);
        g.fillRect(0, 0, W, H);
        this.tweens.add({ targets: g, alpha: 0, duration: durationMs || 2800, onComplete: () => g.destroy() });
      },
      boss_ult_glitch_column_warn: ({ x, width, color, durationMs }) => this._showColumnWarning({ x, width: width || 70, color, durationMs }),
      boss_ult_glitch_column_fire: ({ x, color }) => this._showColumnFire({ x, width: 70, color, durationMs: 280 }),

      boss_ult_entity_start: ({ color }) => this._showFloatingText("REALITY TEAR", `#${(color || 0x22d3ee).toString(16).padStart(6, "0")}`, 26),
      boss_ult_entity_tear: ({ fromX, fromY, toX, toY, color, real }) => {
        const g = this.add.graphics().setDepth(17);
        g.lineStyle(real ? 8 : 3, color || 0x22d3ee, real ? 0.95 : 0.35);
        g.lineBetween(fromX, fromY, toX, toY);
        this.tweens.add({ targets: g, alpha: 0, duration: real ? 500 : 350, onComplete: () => g.destroy() });
        if (real) this.cameras.main.shake(180, 0.012);
      },
      boss_ult_entity_telegraph: (d) => this._showBossUltTelegraph(d),

      boss_ult_leech_start: ({ color }) => this._showFloatingText("BLOOD TITHE", `#${(color || 0x84cc16).toString(16).padStart(6, "0")}`, 26),
      boss_ult_leech_drain: (d) => this._showBossUltDrain(d.bossX, d.bossY, d.charX, d.charY, d.color, d.durationMs),

      boss_ult_warden_start: ({ color }) => this._showFloatingText("WARD COLLAPSE", `#${(color || 0x0ea5e9).toString(16).padStart(6, "0")}`, 26),
      boss_ult_warden_laser: ({ color, durationMs }) => {
        const ring = this.add.circle(this.bossX, this.bossY, 50, color || 0x0ea5e9, 0.25)
          .setBlendMode(Phaser.BlendModes.ADD).setDepth(16);
        this.tweens.add({ targets: ring, scale: 2.5, alpha: 0, duration: durationMs || 2000, onComplete: () => ring.destroy() });
      },
      boss_ult_warden_cross_warn: ({ color, durationMs }) => {
        const g = this.add.graphics().setDepth(16);
        g.lineStyle(3, color || 0x0ea5e9, 0.5);
        g.beginPath();
        g.moveTo(W / 2, 60); g.lineTo(W / 2, H - 60);
        g.moveTo(80, H / 2); g.lineTo(W - 80, H / 2);
        g.strokePath();
        this.tweens.add({ targets: g, alpha: 0, duration: durationMs || 900, onComplete: () => g.destroy() });
      },
      boss_ult_warden_cross_fire: ({ color }) => this._showBossUltCross(color),

      boss_ult_cataclysm_start: ({ color }) => this._showFloatingText("SEQUENTIAL SIEGE", `#${(color || 0xf97316).toString(16).padStart(6, "0")}`, 26),
      boss_ult_cataclysm_lane: ({ y, color }) => this._showBossUltLane(y, color),
      boss_ult_cataclysm_telegraph: (d) => this._showBossUltTelegraph(d),

      boss_ult_oblivion_start: ({ color }) => this._showFloatingText("ECHO FALL", `#${(color || 0x6366f1).toString(16).padStart(6, "0")}`, 26),
      boss_ult_oblivion_echo: ({ x, y, color }) => {
        const ghost = this.add.circle(x, y, 40, color || 0x6366f1, 0.25)
          .setStrokeStyle(3, color || 0x6366f1, 0.8).setDepth(16).setBlendMode(Phaser.BlendModes.ADD);
        this.tweens.add({ targets: ghost, scale: 2.2, alpha: 0, duration: 900, onComplete: () => ghost.destroy() });
      },
      boss_ult_oblivion_telegraph: (d) => this._showBossUltTelegraph(d),

      boss_ult_omega_start: ({ color }) => this._showFloatingText("NULL GENESIS", "#f8fafc", 28),
      boss_ult_omega_safe: ({ x, y, radius, color }) => {
        this._safeZoneGfx?.destroy();
        this._safeZoneGfx = this.add.circle(x, y, radius, color || 0xf8fafc, 0.12)
          .setStrokeStyle(4, color || 0xf8fafc, 0.85).setDepth(16);
      },
      boss_ult_omega_genesis: ({ color, safe }) => {
        const blast = this.add.rectangle(W / 2, H / 2, W, H, color || 0xf8fafc, safe ? 0.04 : 0.22)
          .setBlendMode(Phaser.BlendModes.ADD).setDepth(18);
        this.tweens.add({ targets: blast, alpha: 0, duration: 500, onComplete: () => blast.destroy() });
        if (!safe) this.cameras.main.shake(320, 0.02);
        else this._showFloatingText("SAFE!", "#4ade80", 24);
        this._safeZoneGfx?.destroy();
        this._safeZoneGfx = null;
      },

      game_over: ({ winner, bossHP, killingAttack }) => {
        const won = winner === "players";
        this.overlayTxt.setColor(won ? "#4ade80" : "#ff6b6b").setFontSize(56).setText(won ? "VICTORY!\nBOSS DEFEATED" : "DEFEATED\nBOSS WINS").setVisible(true);
        this.subOverlayTxt.setVisible(false);
        this.cameras.main.flash(750, won ? 60 : 220, won ? 240 : 50, won ? 180 : 80);
        if (this.bossPulse) this.bossPulse.stop();
        this.bossHP = bossHP ?? this.bossHP;
        this._drawBossHpBar(this.bossHP, this.bossMaxHP);
        this._hideWindUpBar();

        // ── "Killed by" badge on defeat ──────────────────────────────────────
        if (!won && killingAttack?.label) {
          const cx = W / 2;
          const cy = H / 2 + 60;

          // Glow backing
          const glow = this.add.circle(cx, cy, 80, 0xff3030, 0).setBlendMode(Phaser.BlendModes.ADD).setDepth(58);
          this.tweens.add({ targets: glow, scale: { from: 0.4, to: 1.6 }, alpha: { from: 0.5, to: 0 }, duration: 1200, ease: "cubic.out", onComplete: () => glow.destroy() });

          // Dark pill background
          const pill = this.add.rectangle(cx, cy, 340, 54, 0x1a0808, 0.92).setStrokeStyle(2, 0xff4444, 0.9).setDepth(59);
          pill.setAlpha(0);
          this.tweens.add({ targets: pill, alpha: 1, duration: 400, delay: 200, ease: "cubic.out" });

          // "KILLED BY" label
          const lbl = this.add.text(cx, cy - 10, "☠  KILLED BY", {
            fontFamily: FONT, fontSize: "11px", color: "#ff8888", fontStyle: "bold",
            letterSpacing: 3,
          }).setOrigin(0.5).setDepth(60).setAlpha(0);
          this.tweens.add({ targets: lbl, alpha: 1, duration: 400, delay: 250, ease: "cubic.out" });

          // Attack name
          const nameTxt = this.add.text(cx, cy + 13, killingAttack.label.toUpperCase(), {
            fontFamily: FONT, fontSize: "20px", color: "#ffffff", fontStyle: "bold",
            stroke: "#ff0000", strokeThickness: 2,
          }).setOrigin(0.5).setDepth(60).setAlpha(0);
          this.tweens.add({ targets: nameTxt, alpha: 1, y: cy + 11, duration: 500, delay: 300, ease: "back.out" });

          // Pulse red flicker on the name
          this.time.delayedCall(800, () => {
            if (!nameTxt.active) return;
            this.tweens.add({ targets: nameTxt, alpha: { from: 1, to: 0.55 }, duration: 320, yoyo: true, repeat: 4 });
          });
        }

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
    const canMove = !this.gamePaused && (this.isSolo ? Boolean(this.cursors) : Boolean(this.isRunner && this.keys));
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

    // ── Minion smooth chase interpolation (60fps) ─────────────────────────────
    const MINION_LERP = 0.18;
    (this._minionSprites || []).forEach((s) => {
      if (!s.tx && !s.ty) return;
      const nx = Phaser.Math.Linear(s.aura?.x ?? s.tx, s.tx, MINION_LERP);
      const ny = Phaser.Math.Linear(s.aura?.y ?? s.ty, s.ty, MINION_LERP);
      [s.aura, s.body, s.inner, s.icon, s.shadow].forEach((obj) => {
        if (!obj) return;
        obj.x = nx;
        obj.y = (obj === s.shadow) ? ny + 6 : ny;
      });
      s.aura.x  = nx; s.aura.y  = ny;
    });

    // ── Stun wind-up telegraph (beam from boss → player, shrinking reticle) ────
    if (this.paralyzeWindupActive) {
      const now = Date.now();
      if (now >= this.paralyzeWindupExpires) {
        this._clearStunTelegraph();
      } else {
        const progress = 1 - Math.max(0, (this.paralyzeWindupExpires - now) / Math.max(1, this.paralyzeWindupExpires - (this.paralyzeWindupExpires - 2200)));
        const cx = this.charX, cy = this.charY;
        const bx = this.bossX, by = this.bossY;
        const alpha = 0.55 + 0.35 * Math.sin(now / 80);

        // Beam from boss to player
        this.paralyzeBeamGfx.clear();
        this.paralyzeBeamGfx.lineStyle(3, 0xf472b6, alpha * 0.85);
        this.paralyzeBeamGfx.lineBetween(bx, by, cx, cy);
        this.paralyzeBeamGfx.lineStyle(1.2, 0xfdf4ff, alpha * 0.45);
        this.paralyzeBeamGfx.lineBetween(bx, by, cx, cy);

        // Shrinking target reticle on player — tightens as wind-up nears completion
        const baseR = 60, minR = 20;
        const r = baseR - (baseR - minR) * progress;
        this.paralyzeWindupGfx.clear();
        this.paralyzeWindupGfx.lineStyle(2.5, 0xf472b6, alpha);
        this.paralyzeWindupGfx.strokeCircle(cx, cy, r);
        // Crosshair ticks
        const TICK = 12;
        [[cx - r, cy, cx - r + TICK, cy], [cx + r - TICK, cy, cx + r, cy],
         [cx, cy - r, cx, cy - r + TICK], [cx, cy + r - TICK, cx, cy + r]].forEach(([x1, y1, x2, y2]) => {
          this.paralyzeWindupGfx.lineBetween(x1, y1, x2, y2);
        });
        // Corner brackets
        const BK = 8;
        [[cx - r * 0.7, cy - r * 0.7], [cx + r * 0.7, cy - r * 0.7],
         [cx - r * 0.7, cy + r * 0.7], [cx + r * 0.7, cy + r * 0.7]].forEach(([lx, ly], i) => {
          const sx = i % 2 === 0 ? 1 : -1;
          const sy = i < 2 ? 1 : -1;
          this.paralyzeWindupGfx.lineBetween(lx, ly, lx + sx * BK, ly);
          this.paralyzeWindupGfx.lineBetween(lx, ly, lx, ly + sy * BK);
        });
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
    this.groundTelegraphGfx?.clear();
    if (this.weaponBobTween) { this.weaponBobTween.stop(); this.weaponBobTween = null; }
    if (this.bossPulse) { this.bossPulse.stop(); this.bossPulse = null; }
    if (this.furyTween) { this.furyTween.stop(); this.furyTween = null; }
    this.furyOverlay?.setVisible(false);
    if (this._typoRestoreTimer) { this._typoRestoreTimer.remove(false); this._typoRestoreTimer = null; }
    // Clean up minion sprites
    (this._minionSprites || []).forEach((s) => { s.aura?.destroy(); s.body?.destroy(); s.inner?.destroy(); s.icon?.destroy(); s.shadow?.destroy(); });
    this._minionSprites = [];
    // Clean up pillar sprites
    (this._pillarSprites || []).forEach((p) => { p.col?.destroy(); p.glow?.destroy(); p.core?.destroy(); p.warn?.destroy(); p.label?.destroy(); });
    this._pillarSprites = [];
    // Clean up rage bar
    this.rageBarBack?.clear();
    this.rageBarFill?.clear();
    // Clean up stun telegraph
    this._clearStunTelegraph?.();
  }

  // keep Phaser happy — public alias used by scene.add & scene.start
  shutdown() { this._shutdown(); }
}
