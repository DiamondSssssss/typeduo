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
};

/** Lobby-facing boss list (mirrors backend). */
export const BOSS_LIST = [
  { id: "watcher",     name: "The Watcher",  tagline: "An ancient arcane entity that sees all.",      difficulty: 2, color: "#ff6b9d" },
  { id: "storm_drake", name: "Storm Drake",  tagline: "Rider of storms, herald of lightning.",         difficulty: 2, color: "#38bdf8" },
  { id: "void_crawler",name: "Void Crawler", tagline: "From the space between stars.",                 difficulty: 3, color: "#a855f7" },
  { id: "inferno",     name: "Inferno",      tagline: "The living pyre. Heat incarnate.",              difficulty: 2, color: "#ff6600" },
  { id: "glacier",     name: "Glacier",      tagline: "Cold, patient, inevitable.",                    difficulty: 3, color: "#7dd3fc" },
];
