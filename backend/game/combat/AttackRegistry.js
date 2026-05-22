/**
 * Global attack registry — add new attacks here to make them available to all bosses.
 *
 * HOW TO ADD A NEW ATTACK:
 *   1. Create a class extending BaseAttack in combat/attacks/
 *   2. Register an instance below with registerAttack()
 *   3. Reference the attack id in a boss's combatProfile.attacks array
 */
const { MeleeSwipeAttack }     = require("./attacks/MeleeSwipeAttack");
const { DashChargeAttack }     = require("./attacks/DashChargeAttack");
const { TeleportAttack }       = require("./attacks/TeleportAttack");
const { GroundHazardAttack }   = require("./attacks/GroundHazardAttack");
const {
  ReaperUltimate, MatronUltimate, SerpentUltimate, CinderUltimate,
  GlitchUltimate, EntityUltimate, LeechUltimate, WardenUltimate,
  CataclysmUltimate, OblivionUltimate, OmegaUltimate,
} = require("./attacks/bossUltimates");
const { PatternBridgeAttack }  = require("./attacks/PatternBridgeAttack");
const { ProjectileVolleyAttack } = require("./attacks/ProjectileVolleyAttack");
const { OverchargeAttack }       = require("./attacks/OverchargeAttack");
const { TypableMinionAttack }    = require("./attacks/TypableMinionAttack");
const { ShieldWordAttack }       = require("./attacks/ShieldWordAttack");
const { ParalyzeTyperAttack }    = require("./attacks/ParalyzeTyperAttack");
const { TypablePillarAttack }    = require("./attacks/TypablePillarAttack");
const { LaserBeamAttack }        = require("./attacks/LaserBeamAttack");
const { MirrorWordAttack }       = require("./attacks/MirrorWordAttack");
const { ChainCancelAttack }      = require("./attacks/ChainCancelAttack");
const { SafeZoneAttack }         = require("./attacks/SafeZoneAttack");

const _attacks = new Map();

const registerAttack = (attack) => {
  _attacks.set(attack.id, attack);
};

// ── Core move categories (examples for each) ─────────────────────────────────
registerAttack(new MeleeSwipeAttack("melee_swipe"));
registerAttack(new DashChargeAttack("boss_dash"));
registerAttack(new TeleportAttack("boss_teleport"));
registerAttack(new GroundHazardAttack("shadow_runes", { color: 0x7c3aed, hazardType: "rune" }));
registerAttack(new GroundHazardAttack("ember_pools", { color: 0xff6600, hazardType: "fire", tickDamage: 6 }));
registerAttack(new ProjectileVolleyAttack("phantom_volley", { projType: "dark_pulse" }));
registerAttack(new ProjectileVolleyAttack("frost_bolt", { projType: "ice_shard", shotCount: 4 }));

registerAttack(new OverchargeAttack("overcharge_blast", { blastDamage: 40, weight: 12 }));
registerAttack(new TypableMinionAttack("summon_typable_minions", { minionCount: 2, weight: 14 }));
registerAttack(new ShieldWordAttack("shield_word", { shieldAmount: 60, weight: 13 }));
registerAttack(new ParalyzeTyperAttack("paralyze_typer", { weight: 11 }));
registerAttack(new TypablePillarAttack("ruin_pillars", { pillarCount: 2, warnMs: 6000, weight: 13 }));
registerAttack(new LaserBeamAttack("laser_beam", { weight: 15 }));
registerAttack(new MirrorWordAttack("mirror_word", { weight: 12 }));
registerAttack(new ChainCancelAttack("chain_cancel", { weight: 14, chainLength: 3 }));
registerAttack(new SafeZoneAttack("safe_zone", { weight: 13, mapDamage: 50 }));

// ── Unique boss ultimates (Watcher keeps legacy special at 10% HP) ───────────
registerAttack(new ReaperUltimate());
registerAttack(new SerpentUltimate());
registerAttack(new CinderUltimate());
registerAttack(new MatronUltimate());
registerAttack(new GlitchUltimate());
registerAttack(new EntityUltimate());
registerAttack(new LeechUltimate());
registerAttack(new WardenUltimate());
registerAttack(new CataclysmUltimate());
registerAttack(new OblivionUltimate());
registerAttack(new OmegaUltimate());

// ── Pattern bridges (legacy projectile patterns, lower weight) ────────────────
const bridge = (id, opts = {}) => registerAttack(new PatternBridgeAttack(id, { patternId: id, weight: 8, ...opts }));

bridge("rust_shot",       { durationMs: 3000, maxRange: 9999 });
bridge("gear_spread",     { durationMs: 2800, windUpMs: 600 });
bridge("shockwave",       { durationMs: 3500, windUpMs: 700, maxRange: 250 });
bridge("magnet_pull",     { durationMs: 4000, windUpMs: 900 });
bridge("arcane_volley",   { durationMs: 3200 });
bridge("void_orb",        { durationMs: 3500, minRange: 100 });
bridge("crown_volley",    { durationMs: 3200 });
bridge("spore_burst",     { durationMs: 3000 });
bridge("sick_rain",       { durationMs: 3200 });
bridge("toxic_pool",      { durationMs: 4000, windUpMs: 600 });
bridge("plague_wave",     { durationMs: 3500 });
bridge("clock_bolt",      { durationMs: 3000 });
bridge("delayed_orb",     { durationMs: 4000 });
bridge("rewind_burst",    { durationMs: 3500 });
bridge("spray",           { durationMs: 2800 });
bridge("tidal_sweep",     { durationMs: 3500 });
bridge("depth_charge",    { durationMs: 4000 });
bridge("whirlpool",       { durationMs: 4500 });
bridge("knight_charge",   { durationMs: 3500 });
bridge("edict_zone",      { durationMs: 4000 });
bridge("judgment_beam",   { durationMs: 3200 });
bridge("ember_arc",       { durationMs: 3000 });
bridge("molten_rain",     { durationMs: 3200 });
bridge("wildfire",        { durationMs: 5000 });
bridge("ice_shard",       { durationMs: 2800 });
bridge("blizzard",        { durationMs: 3500 });
bridge("frost_ring",      { durationMs: 3000 });
bridge("avalanche",       { durationMs: 4000 });
bridge("thunder_rain",    { durationMs: 3200 });
bridge("sweep",           { durationMs: 3500 });
bridge("chain_lightning", { durationMs: 3500 });
bridge("tempest",         { durationMs: 6000 });
bridge("tendrils",        { durationMs: 3000 });
bridge("eruption",        { durationMs: 4000 });
bridge("dark_pulse",      { durationMs: 3000 });
bridge("singularity",     { durationMs: 4000 });
bridge("void_zone",       { durationMs: 4500 });

const getAttack = (id) => _attacks.get(id);
const getAllAttacks = () => _attacks;

module.exports = { registerAttack, getAttack, getAllAttacks };
