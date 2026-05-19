import { WEAPON_LIST } from "../game/weapons";

export default function WeaponPicker({ selectedId, onSelect, disabled }) {
  return (
    <section className="weapon-picker solo-lobby__section" aria-label="Choose weapon">
      <header className="weapon-picker__head">
        <h3 className="solo-lobby__section-label">Chọn vũ khí</h3>
        <p className="weapon-picker__sub">Mỗi vũ khí có cơ chế gõ và sát thương riêng.</p>
      </header>
      <div className="weapon-picker__grid">
        {WEAPON_LIST.map((w) => (
          <button
            key={w.id}
            type="button"
            disabled={disabled}
            className={`weapon-card${selectedId === w.id ? " weapon-card--active" : ""}`}
            style={{ "--weapon-color": w.color }}
            onClick={() => onSelect(w.id)}
          >
            <span className="weapon-card__icon" aria-hidden="true">{w.icon}</span>
            <span className="weapon-card__name">{w.nameVi}</span>
            <span className="weapon-card__tag">{w.tag}</span>
            <span className="weapon-card__desc">{w.description}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
