import { useMemo, useState } from "react";
import {
  BOSS_LIST,
  DIFFICULTY_LABELS,
  DIFFICULTY_MAX_STARS,
  COMING_SOON_DIFFICULTIES,
} from "../game/bosses/bossConfigs";

function DifficultyStars({ n, max = DIFFICULTY_MAX_STARS }) {
  const tier = Math.max(0, Math.min(max, n ?? 0));
  if (tier === 0) {
    return <span className="boss-diff boss-diff--training" aria-label="Training dummy">☆ Training</span>;
  }
  return (
    <span className="boss-diff" aria-label={`Difficulty ${tier} of ${max}`}>
      {"★".repeat(tier)}
      <span className="boss-diff__empty">{"☆".repeat(max - tier)}</span>
    </span>
  );
}

const COMING_SOON_PLACEHOLDERS = COMING_SOON_DIFFICULTIES.map((d) => ({
  id: `coming_soon_${d}`,
  name: DIFFICULTY_LABELS[d],
  tagline: "New challengers are being forged…",
  difficulty: d,
  maxHP: "—",
  color: "#475569",
  comingSoon: true,
}));

export default function BossPicker({
  selectedId,
  onSelect,
  disabled = false,
  lockedIds = null,
}) {
  const [filter, setFilter] = useState("all");
  const lockedSet = useMemo(
    () => (lockedIds ? new Set(lockedIds) : null),
    [lockedIds],
  );

  const filtered = useMemo(() => {
    const d = Number(filter);
    if (COMING_SOON_DIFFICULTIES.includes(d)) {
      return COMING_SOON_PLACEHOLDERS.filter((b) => b.difficulty === d);
    }
    if (filter === "all") return BOSS_LIST;
    return BOSS_LIST.filter((b) => b.difficulty === d);
  }, [filter]);

  const selected = BOSS_LIST.find((b) => b.id === selectedId) || BOSS_LIST[0];

  const filters = [
    { id: "all", label: "All" },
    { id: "0", label: "☆ Training" },
    ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((d) => ({
      id: String(d),
      label: `${"★".repeat(d)} ${DIFFICULTY_LABELS[d]}`,
    })),
    ...COMING_SOON_DIFFICULTIES.map((d) => ({
      id: String(d),
      label: `${"★".repeat(d)} Soon`,
      comingSoon: true,
    })),
  ];

  const formatHp = (boss) => {
    if (boss.comingSoon) return "—";
    if (boss.trainingMode || boss.difficulty === 0) return "∞ HP";
    if (boss.twoForms) return `${boss.maxHP} HP (2 forms)`;
    return `${boss.maxHP} HP`;
  };

            return (
              <motion.div className="boss-picker">
      <div className="boss-picker__toolbar">
        <p className="boss-picker__label">Choose your boss</p>
        <div className="boss-picker__filters" role="tablist" aria-label="Filter by difficulty">
          {filters.map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={filter === f.id}
              className={`boss-picker__filter${filter === f.id ? " boss-picker__filter--active" : ""}${f.comingSoon ? " boss-picker__filter--soon" : ""}`}
              onClick={() => setFilter(f.id)}
              disabled={disabled}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="boss-picker__preview" style={{ "--boss-color": selected.color }}>
        <div className="boss-picker__preview-orb" aria-hidden="true" />
        <div className="boss-picker__preview-body">
          <span className="boss-picker__preview-eyebrow">Selected challenger</span>
          <h3 className="boss-picker__preview-name">{selected.name}</h3>
          <p className="boss-picker__preview-tag">{selected.tagline}</p>
          <div className="boss-picker__preview-meta">
            <DifficultyStars n={selected.difficulty} />
            <span className="boss-picker__preview-pill">{DIFFICULTY_LABELS[selected.difficulty]}</span>
            <span className="boss-picker__preview-pill boss-picker__preview-pill--hp">{formatHp(selected)}</span>
          </div>
        </div>
      </div>

      <div className="boss-picker__grid">
        {filtered.map((boss) => {
          if (boss.comingSoon) {
            return (
              <motion.div
                key={boss.id}
                className="boss-picker__card boss-picker__card--soon"
                style={{ "--boss-color": boss.color }}
                aria-disabled="true"
              >
                <span className="boss-picker__card-accent" aria-hidden="true" />
                <span className="boss-picker__card-top">
                  <span className="boss-picker__card-name">{boss.name}</span>
                  <DifficultyStars n={boss.difficulty} />
                </span>
                <span className="boss-picker__card-tag">{boss.tagline}</span>
                <span className="boss-picker__card-foot">
                  <span>Coming Soon</span>
                  <span>{DIFFICULTY_LABELS[boss.difficulty]}</span>
                </span>
              </div>
            );
          }
          const isSelected = boss.id === selectedId;
          const isLocked = lockedSet?.has(boss.id);
          if (isLocked) {
            return (
              <div
                key={boss.id}
                className="boss-picker__card boss-picker__card--locked"
                style={{ "--boss-color": boss.color }}
                aria-disabled="true"
                title="Defeat the previous boss to unlock"
              >
                <span className="boss-picker__card-accent" aria-hidden="true" />
                <span className="boss-picker__card-top">
                  <span className="boss-picker__card-name">{boss.name}</span>
                  <DifficultyStars n={boss.difficulty} />
                </span>
                <span className="boss-picker__card-tag">{boss.tagline}</span>
                <span className="boss-picker__card-foot">
                  <span className="boss-picker__card-lock">🔒 Locked</span>
                  <span>{formatHp(boss)}</span>
                </span>
              </div>
            );
          }
          return (
            <button
              key={boss.id}
              type="button"
              disabled={disabled}
              className={`boss-picker__card${isSelected ? " boss-picker__card--selected" : ""}`}
              style={{ "--boss-color": boss.color }}
              onClick={() => onSelect(boss.id)}
              aria-pressed={isSelected}
            >
              <span className="boss-picker__card-accent" aria-hidden="true" />
              <span className="boss-picker__card-orb" aria-hidden="true" />
              <span className="boss-picker__card-top">
                <span className="boss-picker__card-name">{boss.name}</span>
                <DifficultyStars n={boss.difficulty} />
              </span>
              <span className="boss-picker__card-tag">{boss.tagline}</span>
              <span className="boss-picker__card-foot">
                <span>{DIFFICULTY_LABELS[boss.difficulty]}</span>
                <span>{formatHp(boss)}</span>
              </span>
              {isSelected ? <span className="boss-picker__card-check" aria-hidden="true">✓</span> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
