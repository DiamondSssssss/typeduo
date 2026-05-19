/** Weapon definitions — keep in sync with backend/game/weapons.js */
export const WEAPON_TYPES = {
  swift_blade: {
    id: "swift_blade",
    name: "Swift Blade",
    nameVi: "Kiếm Tốc",
    icon: "⚡",
    color: "#22d3ee",
    damageMult: 1.0,
    wordTimer: true,
    description: "Từ ngắn có đếm giờ — gõ chậm là mất từ.",
    tag: "Timer",
  },
  shortsword: {
    id: "shortsword",
    name: "Shortsword",
    nameVi: "Kiếm Ngắn",
    icon: "🗡",
    color: "#94a3b8",
    damageMult: 0.68,
    description: "Từ dễ, nhịp bình thường — sát thương thấp.",
    tag: "Balanced",
  },
  greatsword: {
    id: "greatsword",
    name: "Greatsword",
    nameVi: "Đại Kiếm",
    icon: "⚔",
    color: "#f97316",
    damageMult: 1.55,
    description: "Từ dài, khó — sát thương rất cao.",
    tag: "Heavy",
  },
  lifestaff: {
    id: "lifestaff",
    name: "Life Staff",
    nameVi: "Gậy Hồi",
    icon: "💚",
    color: "#4ade80",
    damageMult: 0.88,
    healOnWord: 7,
    description: "Mỗi từ gõ xong hồi máu đội.",
    tag: "Heal",
  },
  fury_axe: {
    id: "fury_axe",
    name: "Fury Axe",
    nameVi: "Rìu Cuồng",
    icon: "🔥",
    color: "#ef4444",
    damageMult: 0.92,
    streakDamage: true,
    description: "Chuỗi gõ liên tục tăng sát thương.",
    tag: "Streak DMG",
  },
};

export const DEFAULT_WEAPON_ID = "shortsword";
export const WEAPON_LIST = Object.values(WEAPON_TYPES);

export const getWeapon = (id) => WEAPON_TYPES[id] || WEAPON_TYPES[DEFAULT_WEAPON_ID];
