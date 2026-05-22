/**
 * Weapon types — each defines typing rules, damage, and word pool key.
 */
const WEAPON_TYPES = {
  swift_blade: {
    id: "swift_blade",
    name: "Swift Blade",
    nameVi: "Kiếm Tốc",
    icon: "⚡",
    color: "#22d3ee",
    damageMult: 1.08,
    wordPool: "swift",
    wordTimer: true,
    timerBaseMs: 980,
    timerPerCharMs: 175,
    description: "Short words with a timer — type fast or the word resets.",
    descriptionVi: "Từ ngắn có đếm giờ — gõ chậm là mất từ.",
  },
  shortsword: {
    id: "shortsword",
    name: "Shortsword",
    nameVi: "Kiếm Ngắn",
    icon: "🗡",
    color: "#94a3b8",
    damageMult: 0.68,
    wordPool: "balanced",
    description: "Easy words, steady pace — lower damage per hit.",
    descriptionVi: "Từ dễ, nhịp bình thường — sát thương thấp.",
  },
  greatsword: {
    id: "greatsword",
    name: "Greatsword",
    nameVi: "Đại Kiếm",
    icon: "⚔",
    color: "#f97316",
    damageMult: 1.55,
    wordPool: "heavy",
    description: "Long, difficult words — huge damage when you land them.",
    descriptionVi: "Từ dài, khó — sát thương rất cao khi gõ trúng.",
  },
  lifestaff: {
    id: "lifestaff",
    name: "Life Staff",
    nameVi: "Gậy Hồi",
    icon: "💚",
    color: "#4ade80",
    damageMult: 0.88,
    wordPool: "steady",
    healOnWord: 7,
    description: "Moderate damage — each completed word heals the team.",
    descriptionVi: "Sát thương vừa — mỗi từ gõ xong hồi máu đội.",
  },
  fury_axe: {
    id: "fury_axe",
    name: "Fury Axe",
    nameVi: "Rìu Cuồng",
    icon: "🔥",
    color: "#ef4444",
    damageMult: 0.92,
    wordPool: "fury",
    streakDamage: true,
    streakBonusPerStack: 0.11,
    streakCap: 15,
    description: "Damage ramps with consecutive words — typos reset your ramp.",
    descriptionVi: "Càng gõ liên tục càng đau — gõ sai mất chuỗi.",
  },
  animous_codex: {
    id: "animous_codex",
    name: "Animous Codex",
    nameVi: "Thiên Ma Lục",
    icon: "📖",
    color: "#a78bfa",
    damageMult: 1.0,
    wordPool: "book",
    bookWeapon: true,
    description: "Neutral: pick Good or Evil words to transform. Holy shields; Demon strikes hard.",
    descriptionVi: "Trung lập: chọn từ Thiện/Ác để biến hình. Thánh miễn đòn; Quỷ sát thương cao.",
  },
};

const DEFAULT_WEAPON_ID = "shortsword";

const getWeapon = (id) => WEAPON_TYPES[id] || WEAPON_TYPES[DEFAULT_WEAPON_ID];

const WEAPON_LIST = Object.values(WEAPON_TYPES);

module.exports = {
  WEAPON_TYPES,
  WEAPON_LIST,
  DEFAULT_WEAPON_ID,
  getWeapon,
};
