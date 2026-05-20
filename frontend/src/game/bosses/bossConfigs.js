/**
 * Visual definitions for each boss.
 * Imported by MainScene to drive drawing and colour palettes.
 */

export const BOSS_VISUALS = {
  watcher: {
    id:    "watcher",
    label: "THE WATCHER",
    shape: "hex",          // hexagon body
    size:  { body: 60, border: 78, aura: 92 },
    phases: [
      { body: 0x5b1130, outer: 0x8b1a4f, border: 0xff6b9d, eye: 0xff9ec8, core: 0xff6b9d },
      { body: 0x6a1d00, outer: 0xaa3300, border: 0xff8844, eye: 0xffbb88, core: 0xff8844 },
      { body: 0x350006, outer: 0x7a0015, border: 0xff3333, eye: 0xffffff, core: 0xff9999 },
    ],
    roar:  { body: 0xcc1144, outer: 0xff2266, border: 0xffffff, eye: 0xffffff, core: 0xffffff },
    stun:  { body: 0x0a2244, outer: 0x1a4488, border: 0x4ef0d4, eye: 0x4ef0d4,  core: 0x4ef0d4  },
    auraColors: [0xff6b9d, 0xff8844, 0xff3333],
    windUpColor: 0xff3399,
  },

  storm_drake: {
    id:    "storm_drake",
    label: "STORM DRAKE",
    shape: "diamond",      // 8-point star/diamond
    size:  { body: 58, border: 76, aura: 90 },
    phases: [
      { body: 0x0a2848, outer: 0x174880, border: 0x38bdf8, eye: 0xfde68a, core: 0x7dd3fc },
      { body: 0x162040, outer: 0x2d4a80, border: 0x60a5fa, eye: 0xfde047, core: 0x93c5fd },
      { body: 0x0e0e2e, outer: 0x1c1c5a, border: 0xe0f2fe, eye: 0xffffff, core: 0xbae6fd },
    ],
    roar:  { body: 0x0c2a5c, outer: 0x1a4d99, border: 0xfde68a, eye: 0xffffff, core: 0xfde68a },
    stun:  { body: 0x0a2244, outer: 0x1a4488, border: 0x4ef0d4, eye: 0x4ef0d4,  core: 0x4ef0d4  },
    auraColors: [0x38bdf8, 0x60a5fa, 0xe0f2fe],
    windUpColor: 0xfde68a,
  },

  void_crawler: {
    id:    "void_crawler",
    label: "VOID CRAWLER",
    shape: "spider",       // circle with radial tendrils
    size:  { body: 52, border: 70, aura: 88 },
    phases: [
      { body: 0x1a0b2e, outer: 0x381c5c, border: 0xa855f7, eye: 0xd8b4fe, core: 0xa855f7 },
      { body: 0x120a24, outer: 0x2d1550, border: 0x7c3aed, eye: 0xc4b5fd, core: 0x7c3aed },
      { body: 0x0d0616, outer: 0x1f0d3a, border: 0xff3d9f, eye: 0xffffff, core: 0xff85c2 },
    ],
    roar:  { body: 0x2d0a56, outer: 0x5b1a9e, border: 0xffffff, eye: 0xffffff, core: 0xffffff },
    stun:  { body: 0x0a2244, outer: 0x1a4488, border: 0x4ef0d4, eye: 0x4ef0d4,  core: 0x4ef0d4  },
    auraColors: [0xa855f7, 0x7c3aed, 0xff3d9f],
    windUpColor: 0xd946ef,
  },

  inferno: {
    id:    "inferno",
    label: "INFERNO",
    shape: "flame",        // amorphous molten blob
    size:  { body: 58, border: 76, aura: 94 },
    phases: [
      { body: 0x7a1a00, outer: 0xcc3300, border: 0xff6600, eye: 0xffdd00, core: 0xff9900 },
      { body: 0x8c2200, outer: 0xe03800, border: 0xff8c00, eye: 0xfff176, core: 0xffb300 },
      { body: 0x4a0800, outer: 0xaa1800, border: 0xff3300, eye: 0xffffff, core: 0xff8800 },
    ],
    roar:  { body: 0xcc3300, outer: 0xff5500, border: 0xffffff, eye: 0xffffff, core: 0xffffff },
    stun:  { body: 0x0a2244, outer: 0x1a4488, border: 0x4ef0d4, eye: 0x4ef0d4,  core: 0x4ef0d4  },
    auraColors: [0xff6600, 0xff8c00, 0xff3300],
    windUpColor: 0xffdd00,
  },

  rust_golem: {
    id: "rust_golem", label: "RUST GOLEM", shape: "hex",
    size: { body: 64, border: 82, aura: 98 },
    phases: [
      { body: 0x3d2b1a, outer: 0x6b4423, border: 0xb45309, eye: 0xfbbf24, core: 0xd97706 },
      { body: 0x2d1f12, outer: 0x5c3d1e, border: 0xea580c, eye: 0xfde68a, core: 0xf97316 },
      { body: 0x1a1208, outer: 0x422006, border: 0xff6b00, eye: 0xffffff, core: 0xffaa00 },
    ],
    roar: { body: 0x7c4a12, outer: 0xb45309, border: 0xffffff, eye: 0xffffff, core: 0xffffff },
    stun: { body: 0x0a2244, outer: 0x1a4488, border: 0x4ef0d4, eye: 0x4ef0d4, core: 0x4ef0d4 },
    auraColors: [0xb45309, 0xea580c, 0xff6b00], windUpColor: 0xfbbf24,
  },
  plague_herald: {
    id: "plague_herald", label: "PLAGUE HERALD", shape: "spider",
    size: { body: 56, border: 74, aura: 90 },
    phases: [
      { body: 0x142410, outer: 0x1e3d16, border: 0x84cc16, eye: 0xd9f99d, core: 0x65a30d },
      { body: 0x0f1a0c, outer: 0x166534, border: 0x4ade80, eye: 0xbbf7d0, core: 0x22c55e },
      { body: 0x0a1208, outer: 0x14532d, border: 0xa3e635, eye: 0xffffff, core: 0x86efac },
    ],
    roar: { body: 0x1a4d12, outer: 0x3d7a1e, border: 0xffffff, eye: 0xffffff, core: 0xffffff },
    stun: { body: 0x0a2244, outer: 0x1a4488, border: 0x4ef0d4, eye: 0x4ef0d4, core: 0x4ef0d4 },
    auraColors: [0x84cc16, 0x4ade80, 0xa3e635], windUpColor: 0x86efac,
  },
  chronarch: {
    id: "chronarch", label: "CHRONARCH", shape: "diamond",
    size: { body: 58, border: 76, aura: 92 },
    phases: [
      { body: 0x1e1b4b, outer: 0x3730a3, border: 0xfbbf24, eye: 0xfef08a, core: 0xf59e0b },
      { body: 0x18163a, outer: 0x2e2a6e, border: 0xfcd34d, eye: 0xfffbeb, core: 0xeab308 },
      { body: 0x0f0d24, outer: 0x1e1b4b, border: 0xffffff, eye: 0xffffff, core: 0xfbbf24 },
    ],
    roar: { body: 0x3730a3, outer: 0x6366f1, border: 0xffffff, eye: 0xffffff, core: 0xffffff },
    stun: { body: 0x0a2244, outer: 0x1a4488, border: 0x4ef0d4, eye: 0x4ef0d4, core: 0x4ef0d4 },
    auraColors: [0xfbbf24, 0xfcd34d, 0xffffff], windUpColor: 0xfbbf24,
  },
  leviathan: {
    id: "leviathan", label: "ABYSS LEVIATHAN", shape: "crystal",
    size: { body: 66, border: 84, aura: 100 },
    phases: [
      { body: 0x0c2340, outer: 0x155e75, border: 0x22d3ee, eye: 0xa5f3fc, core: 0x06b6d4 },
      { body: 0x0a1e36, outer: 0x0e4d6e, border: 0x38bdf8, eye: 0xe0f2fe, core: 0x0ea5e9 },
      { body: 0x060e1a, outer: 0x0c2b42, border: 0x7dd3fc, eye: 0xffffff, core: 0x22d3ee },
    ],
    roar: { body: 0x0e3a5c, outer: 0x1e6a9e, border: 0xffffff, eye: 0xffffff, core: 0xffffff },
    stun: { body: 0x0a2244, outer: 0x1a4488, border: 0x4ef0d4, eye: 0x4ef0d4, core: 0x4ef0d4 },
    auraColors: [0x22d3ee, 0x38bdf8, 0x7dd3fc], windUpColor: 0x22d3ee,
  },
  phantom_reaper: {
    id: "phantom_reaper", label: "PHANTOM REAPER", shape: "spider",
    size: { body: 54, border: 72, aura: 88 },
    phases: [
      { body: 0x1e1035, outer: 0x3b1f5c, border: 0xc084fc, eye: 0xe9d5ff, core: 0xa855f7 },
      { body: 0x150c28, outer: 0x2d1550, border: 0xd946ef, eye: 0xfae8ff, core: 0xc026d3 },
      { body: 0x0a0616, outer: 0x1a0a30, border: 0xffffff, eye: 0xffffff, core: 0xff85c2 },
    ],
    roar: { body: 0x3b1f5c, outer: 0x6b21a8, border: 0xffffff, eye: 0xffffff, core: 0xffffff },
    stun: { body: 0x0a2244, outer: 0x1a4488, border: 0x4ef0d4, eye: 0x4ef0d4, core: 0x4ef0d4 },
    auraColors: [0xc084fc, 0xd946ef, 0xffffff], windUpColor: 0xc084fc,
  },
  cinder_maw: {
    id: "cinder_maw", label: "CINDER MAW", shape: "flame",
    size: { body: 62, border: 80, aura: 96 },
    phases: [
      { body: 0x5c1a06, outer: 0x9a3412, border: 0xf97316, eye: 0xfed7aa, core: 0xea580c },
      { body: 0x431407, outer: 0x7c2d12, border: 0xfb923c, eye: 0xffedd5, core: 0xf97316 },
      { body: 0x2a0a04, outer: 0x5c1a06, border: 0xff4500, eye: 0xffffff, core: 0xff6600 },
    ],
    roar: { body: 0x9a3412, outer: 0xea580c, border: 0xffffff, eye: 0xffffff, core: 0xffffff },
    stun: { body: 0x0a2244, outer: 0x1a4488, border: 0x4ef0d4, eye: 0x4ef0d4, core: 0x4ef0d4 },
    auraColors: [0xf97316, 0xfb923c, 0xff4500], windUpColor: 0xfbbf24,
  },
  iron_matron: {
    id: "iron_matron", label: "IRON MATRON", shape: "hex",
    size: { body: 58, border: 76, aura: 90 },
    phases: [
      { body: 0x334155, outer: 0x475569, border: 0x94a3b8, eye: 0xe2e8f0, core: 0x64748b },
      { body: 0x1e293b, outer: 0x334155, border: 0xcbd5e1, eye: 0xf8fafc, core: 0x94a3b8 },
      { body: 0x0f172a, outer: 0x1e293b, border: 0xffffff, eye: 0xffffff, core: 0xe2e8f0 },
    ],
    roar: { body: 0x475569, outer: 0x64748b, border: 0xffffff, eye: 0xffffff, core: 0xffffff },
    stun: { body: 0x0a2244, outer: 0x1a4488, border: 0x4ef0d4, eye: 0x4ef0d4, core: 0x4ef0d4 },
    auraColors: [0x94a3b8, 0xcbd5e1, 0xffffff], windUpColor: 0x94a3b8,
  },
  void_serpent: {
    id: "void_serpent", label: "VOID SERPENT", shape: "spider",
    size: { body: 68, border: 86, aura: 104 },
    phases: [
      { body: 0x1e1b4b, outer: 0x312e81, border: 0x6366f1, eye: 0xc7d2fe, core: 0x4f46e5 },
      { body: 0x15123a, outer: 0x3730a3, border: 0x818cf8, eye: 0xe0e7ff, core: 0x6366f1 },
      { body: 0x0a0820, outer: 0x1e1b4b, border: 0xffffff, eye: 0xffffff, core: 0xa5b4fc },
    ],
    roar: { body: 0x312e81, outer: 0x4f46e5, border: 0xffffff, eye: 0xffffff, core: 0xffffff },
    stun: { body: 0x0a2244, outer: 0x1a4488, border: 0x4ef0d4, eye: 0x4ef0d4, core: 0x4ef0d4 },
    auraColors: [0x6366f1, 0x818cf8, 0xffffff], windUpColor: 0x818cf8,
  },

  the_glitch: {
    id: "the_glitch", label: "THE GLITCH", shape: "diamond",
    size: { body: 56, border: 74, aura: 90 },
    phases: [
      { body: 0x2e1065, outer: 0x6b21a8, border: 0xe879f9, eye: 0xfae8ff, core: 0xd946ef },
      { body: 0x1e0a3c, outer: 0x581c87, border: 0xff3d9f, eye: 0xffffff, core: 0xf472b6 },
      { body: 0x0f0518, outer: 0x3b0764, border: 0xffffff, eye: 0x22d3ee, core: 0xff85c2 },
    ],
    roar: { body: 0x6b21a8, outer: 0xc026d3, border: 0xffffff, eye: 0xffffff, core: 0xffffff },
    stun: { body: 0x0a2244, outer: 0x1a4488, border: 0x4ef0d4, eye: 0x4ef0d4, core: 0x4ef0d4 },
    auraColors: [0xe879f9, 0xff3d9f, 0x22d3ee], windUpColor: 0xe879f9,
  },

  the_entity: {
    id: "the_entity", label: "THE ENTITY", shape: "hex",
    size: { body: 62, border: 80, aura: 96 },
    phases: [
      { body: 0x042f2e, outer: 0x0f766e, border: 0x22d3ee, eye: 0xccfbf1, core: 0x2dd4bf },
      { body: 0x022c22, outer: 0x115e59, border: 0x5eead4, eye: 0xffffff, core: 0x22d3ee },
      { body: 0x011a18, outer: 0x134e4a, border: 0xffffff, eye: 0x67e8f9, core: 0xffffff },
    ],
    roar: { body: 0x0f766e, outer: 0x14b8a6, border: 0xffffff, eye: 0xffffff, core: 0xffffff },
    stun: { body: 0x0a2244, outer: 0x1a4488, border: 0x4ef0d4, eye: 0x4ef0d4, core: 0x4ef0d4 },
    auraColors: [0x22d3ee, 0x5eead4, 0xffffff], windUpColor: 0x22d3ee,
  },

  feedback_leech: {
    id: "feedback_leech", label: "FEEDBACK LEECH", shape: "spider",
    size: { body: 54, border: 72, aura: 88 },
    phases: [
      { body: 0x1a2e05, outer: 0x365314, border: 0x84cc16, eye: 0xd9f99d, core: 0x65a30d },
      { body: 0x14240a, outer: 0x3f6212, border: 0xa3e635, eye: 0xfef9c3, core: 0x84cc16 },
      { body: 0x0a1405, outer: 0x1a2e05, border: 0xdc2626, eye: 0xffffff, core: 0xef4444 },
    ],
    roar: { body: 0x365314, outer: 0x65a30d, border: 0xffffff, eye: 0xffffff, core: 0xffffff },
    stun: { body: 0x0a2244, outer: 0x1a4488, border: 0x4ef0d4, eye: 0x4ef0d4, core: 0x4ef0d4 },
    auraColors: [0x84cc16, 0xa3e635, 0xef4444], windUpColor: 0x84cc16,
  },

  sovereign: {
    id: "sovereign", label: "THE SOVEREIGN", shape: "hex",
    size: { body: 68, border: 86, aura: 102 },
    phases: [
      { body: 0x3b0764, outer: 0x6b21a8, border: 0xfbbf24, eye: 0xfef3c7, core: 0xeab308 },
      { body: 0x2e0555, outer: 0x581c87, border: 0xf59e0b, eye: 0xfffbeb, core: 0xfbbf24 },
      { body: 0x1a032e, outer: 0x3b0764, border: 0xffffff, eye: 0xffffff, core: 0xfbbf24 },
    ],
    roar: { body: 0x6b21a8, outer: 0x9333ea, border: 0xffffff, eye: 0xffffff, core: 0xffffff },
    stun: { body: 0x0a2244, outer: 0x1a4488, border: 0x4ef0d4, eye: 0x4ef0d4, core: 0x4ef0d4 },
    auraColors: [0xfbbf24, 0xf59e0b, 0xffffff], windUpColor: 0xfbbf24,
  },

  glacier: {
    id:    "glacier",
    label: "GLACIER",
    shape: "crystal",      // sharp octagonal crystal
    size:  { body: 62, border: 80, aura: 96 },
    phases: [
      { body: 0x0c2d4a, outer: 0x155e75, border: 0x7dd3fc, eye: 0xe0f2fe, core: 0x38bdf8 },
      { body: 0x0a2538, outer: 0x0e4d6e, border: 0xbae6fd, eye: 0xffffff, core: 0x7dd3fc },
      { body: 0x060e1a, outer: 0x0c2b42, border: 0xe0f2fe, eye: 0xffffff, core: 0xa5f3fc },
    ],
    roar:  { body: 0x0e3a5c, outer: 0x1e6a9e, border: 0xffffff, eye: 0xffffff, core: 0xffffff },
    stun:  { body: 0x0a2244, outer: 0x1a4488, border: 0x4ef0d4, eye: 0x4ef0d4,  core: 0x4ef0d4  },
    auraColors: [0x7dd3fc, 0xbae6fd, 0xe0f2fe],
    windUpColor: 0xa5f3fc,
  },
};

/** Projectile render hints per type. */
export const PROJ_VISUALS = {
  normal:         { color: 0xffb454, glow: 0xfff5d6, r: 8 },
  aimed:          { color: 0xff8844, glow: 0xffd5b0, r: 8 },
  spread:         { color: 0xc084fc, glow: 0xe9d5ff, r: 7 },
  rain:           { color: 0x93c5fd, glow: 0xdbeafe, r: 5 },
  circle:         { color: 0xff6b6b, glow: 0xffd5d5, r: 9 },
  spiral:         { color: 0xa3e635, glow: 0xecfccb, r: 6 },
  thunder_rain:   { color: 0xfde68a, glow: 0xfef9c3, r: 5 },
  sweep:          { color: 0x38bdf8, glow: 0xe0f2fe, r: 7 },
  chain_lightning:{ color: 0xfde68a, glow: 0xfffbeb, r: 8 },
  void_orb:       { color: 0xa855f7, glow: 0xe9d5ff, r: 11, homing: true },
  tendrils:       { color: 0x7c3aed, glow: 0xede9fe, r: 7 },
  eruption:       { color: 0xff3d9f, glow: 0xfce7f3, r: 8 },
  dark_pulse:     { color: 0x8b5cf6, glow: 0xf5f3ff, r: 8 },
  singularity:    { color: 0xd946ef, glow: 0xfae8ff, r: 10, homing: true },
  hell:           { color: 0xff4444, glow: 0xffcccc, r: 7 },
  // Inferno
  ember_arc:      { color: 0xff7700, glow: 0xffcc66, r: 9 },
  molten_rain:    { color: 0xff4400, glow: 0xff9966, r: 10 },
  wildfire:       { color: 0xff6600, glow: 0xffcc00, r: 8 },
  fire_pillar:    { color: 0xff6600, glow: 0xffcc00, r: 8 },
  // Glacier
  ice_shard:      { color: 0x7dd3fc, glow: 0xe0f2fe, r: 8 },
  blizzard:       { color: 0xbae6fd, glow: 0xf0f9ff, r: 5 },
  frost_ring:     { color: 0xa5f3fc, glow: 0xecfeff, r: 7 },
  freeze_ray:     { color: 0x38bdf8, glow: 0xe0f2fe, r: 7 },
  avalanche:      { color: 0x7dd3fc, glow: 0xe0f2fe, r: 8 },
  rust_shot:      { color: 0xb45309, glow: 0xfde68a, r: 9 },
  gear_spread:    { color: 0xd97706, glow: 0xfef3c7, r: 8 },
  shockwave:      { color: 0xea580c, glow: 0xffedd5, r: 10 },
  spore_burst:    { color: 0x84cc16, glow: 0xd9f99d, r: 7 },
  sick_rain:      { color: 0x65a30d, glow: 0xecfccb, r: 6 },
  plague_wave:    { color: 0x4ade80, glow: 0xd1fae5, r: 9 },
  clock_bolt:     { color: 0xfbbf24, glow: 0xfffbeb, r: 8 },
  delayed_orb:    { color: 0xf59e0b, glow: 0xfff7ed, r: 10, homing: true },
  rewind_burst:   { color: 0xeab308, glow: 0xfef9c3, r: 9, homing: true },
  spray:          { color: 0x22d3ee, glow: 0xcffafe, r: 7 },
  tidal_wave:     { color: 0x0ea5e9, glow: 0xe0f2fe, r: 9 },
  depth_charge:   { color: 0x0284c7, glow: 0x7dd3fc, r: 11 },
  whirlpool:      { color: 0x38bdf8, glow: 0xe0f2fe, r: 10, homing: true },
  crown_volley:   { color: 0xfbbf24, glow: 0xfffbeb, r: 8 },
  knight_charge:  { color: 0xf59e0b, glow: 0xfff7ed, r: 10 },
  judgment_beam:  { color: 0xc026d3, glow: 0xfae8ff, r: 9 },
  minion_orb:     { color: 0xd946ef, glow: 0xfae8ff, r: 8, homing: true },
};

/** Human-readable attack labels for the HUD. */
export const ATTACK_LABELS = {
  normal:          "Normal",
  aimed:           "Aimed",
  spread:          "⚡ Spread",
  rain:            "☔ Rain",
  circle:          "🔴 Circle",
  spiral:          "🌀 Spiral",
  laser:           "☢ Laser",
  hell:            "💀 Hell",
  arcane_volley:   "✨ Arcane Volley",
  thunder_rain:    "⛈ Thunder Rain",
  sweep:           "💨 Sweep",
  lightning_bolt:  "⚡ Lightning Bolt",
  chain_lightning: "🔗 Chain Lightning",
  tempest:         "🌪 Tempest",
  void_orb:        "🟣 Void Orb",
  tendrils:        "🕷 Tendrils",
  eruption:        "💥 Eruption",
  dark_pulse:      "🌑 Dark Pulse",
  singularity:     "🕳 Singularity",
  void_zone:       "🔮 Void Zone",
  // Inferno
  ember_arc:       "🔥 Ember Arc",
  molten_rain:     "🌋 Molten Rain",
  wildfire:        "🔥 Wildfire",
  fire_pillar:     "🔥 Fire Pillar",
  eruption_burst:  "🌋 Eruption Burst",
  // Glacier
  ice_shard:       "❄ Ice Shard",
  blizzard:        "🌨 Blizzard",
  frost_ring:      "❄ Frost Ring",
  freeze_ray:      "🧊 Freeze Ray",
  avalanche:       "🏔 Avalanche",
  permafrost:      "❄ Permafrost",
  rust_shot:       "⚙ Rust Shot",
  gear_spread:     "⚙ Gear Spread",
  shockwave:       "💥 Shockwave",
  magnet_pull:     "🧲 Magnet Pull",
  spore_burst:     "🦠 Spore Burst",
  sick_rain:       "☣ Sick Rain",
  toxic_pool:      "☣ Toxic Pool",
  plague_wave:     "🦠 Plague Wave",
  clock_bolt:      "🕐 Clock Bolt",
  delayed_orb:     "⏳ Delayed Orb",
  slow_field:      "🐌 Slow Field",
  rewind_burst:    "⏪ Rewind Burst",
  spray:           "🌊 Spray",
  tidal_sweep:     "🌊 Tidal Sweep",
  depth_charge:    "💧 Depth Charge",
  whirlpool:       "🌀 Whirlpool",
  crown_volley:    "👑 Crown Volley",
  knight_charge:   "⚔ Knight Charge",
  edict_zone:      "📜 Edict Zone",
  judgment_beam:   "⚖ Judgment",
  scrap_beam:      "🔩 Scrap Beam",
  time_slice:      "⏱ Time Slice",
  royal_lance:     "👑 Royal Lance",
  melee_swipe:     "⚔ Melee Swipe",
  boss_dash:       "💨 Dash Charge",
  boss_teleport:   "✨ Teleport",
  shadow_runes:    "🔮 Shadow Runes",
  ember_pools:     "🔥 Ember Pools",
  phantom_volley:  "👻 Phantom Volley",
  reaper_ultimate: "🌙 Harvest Moon",
  serpent_ultimate:"🐍 Abyss Maw",
  cinder_ultimate: "👑 Inferno Crown",
  matron_ultimate: "⚖ Iron Judgment",
  glitch_ultimate: "💥 System Crash",
  entity_ultimate: "🕳 Null Collapse",
  leech_ultimate:  "🩸 Hemorrhage Pulse",
  frost_bolt:      "❄ Frost Bolt",
};

/** Star tier names (1–10). Tiers 7–10 are reserved for future bosses. */
export const DIFFICULTY_LABELS = {
  1:  "Beginner",
  2:  "Easy",
  3:  "Medium",
  4:  "Hard",
  5:  "Nightmare",
  6:  "Mythic",
  7:  "Abyssal",
  8:  "Cataclysm",
  9:  "Oblivion",
  10: "Omega",
};

export const DIFFICULTY_MAX_STARS = 10;
export const COMING_SOON_DIFFICULTIES = [7, 8, 9, 10];

/** Lobby-facing boss list (mirrors backend /api/bosses). */
export const BOSS_LIST = [
  { id: "iron_matron",    name: "Iron Matron",      tagline: "Forged in wrath, tempered in battle.",           difficulty: 1, maxHP: 520,  color: "#94a3b8" },
  { id: "rust_golem",     name: "Rust Golem",       tagline: "Ancient iron that never rests.",                difficulty: 2, maxHP: 580,  color: "#b45309" },
  { id: "watcher",        name: "The Watcher",      tagline: "An ancient arcane entity that sees all.",       difficulty: 3, maxHP: 550,  color: "#ff6b9d" },
  { id: "storm_drake",    name: "Storm Drake",      tagline: "Rider of storms, herald of lightning.",          difficulty: 3, maxHP: 620,  color: "#38bdf8" },
  { id: "inferno",        name: "Inferno",          tagline: "The living pyre. Heat incarnate.",              difficulty: 3, maxHP: 600,  color: "#ff6600" },
  { id: "plague_herald",  name: "Plague Herald",    tagline: "Where it walks, life withers.",                 difficulty: 3, maxHP: 650,  color: "#84cc16" },
  { id: "phantom_reaper", name: "Phantom Reaper",   tagline: "Death moves faster than you can type.",         difficulty: 3, maxHP: 640,  color: "#c084fc" },
  { id: "void_crawler",   name: "Void Crawler",     tagline: "From the space between stars.",                 difficulty: 4, maxHP: 720,  color: "#a855f7" },
  { id: "glacier",        name: "Glacier",          tagline: "Cold, patient, inevitable.",                    difficulty: 4, maxHP: 760,  color: "#7dd3fc" },
  { id: "chronarch",      name: "Chronarch",        tagline: "Time is its weapon.",                           difficulty: 4, maxHP: 700,  color: "#fbbf24" },
  { id: "leviathan",      name: "Abyss Leviathan",  tagline: "The deep claims all.",                          difficulty: 4, maxHP: 780,  color: "#22d3ee" },
  { id: "cinder_maw",     name: "Cinder Maw",       tagline: "The arena becomes an oven.",                    difficulty: 4, maxHP: 720,  color: "#f97316" },
  { id: "sovereign",      name: "The Sovereign",    tagline: "Kneel or perish.",                              difficulty: 5, maxHP: 900,  color: "#eab308" },
  { id: "void_serpent",   name: "Void Serpent",     tagline: "Coils of nothingness devour the unwary.",       difficulty: 5, maxHP: 950,  color: "#6366f1" },
  { id: "the_glitch",     name: "The Glitch",       tagline: "Reality tears — death awakens The Entity.",    difficulty: 6, maxHP: 1160, color: "#e879f9", twoForms: true },
  { id: "feedback_leech", name: "Feedback Leech",   tagline: "Every typo feeds it. Type clean or bleed.",     difficulty: 6, maxHP: 900,  color: "#84cc16" },
];
