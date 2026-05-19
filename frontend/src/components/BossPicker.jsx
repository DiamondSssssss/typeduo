import { useMemo, useState } from "react";
import { BOSS_LIST, DIFFICULTY_LABELS } from "../game/bosses/bossConfigs";

function DifficultyStars({ n }) {
  const stars = Math.max(1, Math.min(5, n || 1));
  return (
    <span className="boss-diff" aria-label={`Difficulty ${stars} of 5`}>
      {"★".repeat(stars)}
      <span className="boss-diff__empty">{"☆".repeat(5 - stars)}</span>
    </span>
  );
}

export default function BossPicker({ selectedId, onSelect, disabled = false }) {
  const [filter, setFilter] = useState("all");

  const filtered = useMemo(() => {
    if (filter === "all") return BOSS_LIST;
    const d = Number(filter);
    return BOSS_LIST.filter((b) => b.difficulty === d);
  }, [filter]);

  const selected = BOSS_LIST.find((b) => b.id === selectedId) || BOSS_LIST[0];

  const filters = [
    { id: "all", label: "All" },
    { id: "1", label: "★" },
    { id: "2", label: "★★" },
    { id: "3", label: "★★★" },
    { id: "4", label: "★★★★" },
    { id: "5", label: "★★★★★" },
  ];

  return (
    <div className="boss-picker">
      <div className="boss-picker__toolbar">
        <p className="boss-picker__label">Choose your boss</p>
        <div className="boss-picker__filters" role="tablist" aria-label="Filter by difficulty">
          {filters.map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={filter === f.id}
              className={`boss-picker__filter${filter === f.id ? " boss-picker__filter--active" : ""}`}
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
            <span className="boss-picker__preview-pill boss-picker__preview-pill--hp">{selected.maxHP} HP</span>
          </div>
        </div>
      </div>

      <div className="boss-picker__grid">
        {filtered.map((boss) => {
          const isSelected = boss.id === selectedId;
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
                <span>{boss.maxHP} HP</span>
              </span>
              {isSelected ? <span className="boss-picker__card-check" aria-hidden="true">✓</span> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
