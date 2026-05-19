/** Visual presets for ground hazards — distinct color + particle style per type. */
export const HAZARD_PRESETS = {
  rune: {
    color: 0x7c3aed,
    glow: 0xa855f7,
    fillAlpha: 0.2,
    ringWidth: 3,
    particles: {
      interval: 260,
      burst: 3,
      sizeMin: 2,
      sizeMax: 5,
      drift: "rise",
      colors: [0x7c3aed, 0xa855f7, 0xc4b5fd],
    },
  },
  fire: {
    color: 0xff6600,
    glow: 0xffaa33,
    fillAlpha: 0.26,
    ringWidth: 3,
    particles: {
      interval: 200,
      burst: 4,
      sizeMin: 2,
      sizeMax: 6,
      drift: "ember",
      colors: [0xff6600, 0xff3300, 0xfbbf24, 0xff9500],
    },
  },
  toxic: {
    color: 0x65a30d,
    glow: 0x84cc16,
    fillAlpha: 0.22,
    ringWidth: 2.5,
    particles: {
      interval: 320,
      burst: 2,
      sizeMin: 3,
      sizeMax: 7,
      drift: "bubble",
      colors: [0x84cc16, 0x4d7c0f, 0xbef264, 0xa3e635],
    },
  },
  slow: {
    color: 0x38bdf8,
    glow: 0x7dd3fc,
    fillAlpha: 0.16,
    ringWidth: 2.5,
    particles: {
      interval: 380,
      burst: 2,
      sizeMin: 2,
      sizeMax: 5,
      drift: "drift",
      colors: [0x38bdf8, 0x64748b, 0xbae6fd, 0x0ea5e9],
    },
  },
};

export function resolveHazardPreset(type, serverColor) {
  const key = type && HAZARD_PRESETS[type] ? type : "rune";
  const base = HAZARD_PRESETS[key];
  if (!serverColor) return base;
  return { ...base, color: serverColor };
}
