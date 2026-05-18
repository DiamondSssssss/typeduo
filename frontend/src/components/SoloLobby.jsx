import { useState } from "react";
import { BOSS_LIST } from "../game/bosses/bossConfigs";

function DifficultyStars({ n }) {
  return <span className="boss-diff">{"★".repeat(n)}{"☆".repeat(3 - n)}</span>;
}

function SoloLobby({ socket, currentUser, onGameStarted, onBack }) {
  const [selectedBoss, setSelectedBoss] = useState("rust_golem");
  const [difficulty, setDifficulty] = useState("normal");
  const [starting, setStarting] = useState(false);
  const [status, setStatus] = useState("");
  const username = currentUser?.username || currentUser?.email;

  const startSolo = () => {
    if (!socket?.connected || starting) return;
    setStarting(true);
    setStatus("");
    socket.emit("start_solo", { username, bossId: selectedBoss, difficulty }, (res) => {
      setStarting(false);
      if (!res?.ok) { setStatus(res?.message || "Could not start solo game."); return; }
    });
  };

  return (
    <section className="card card-wide solo-lobby">
      <div className="solo-lobby__head">
        <button type="button" className="btn btn-ghost btn-compact" onClick={onBack}>← Back</button>
        <h2>Solo Mode</h2>
        <p>Move with <strong>arrow keys</strong> (or WASD) and <strong>type</strong> to attack. Weapon is auto-equipped.</p>
      </div>

      <div className="solo-lobby__diff">
        <span className="solo-lobby__label">Difficulty</span>
        {["easy", "normal", "hard"].map((d) => (
          <button
            key={d}
            type="button"
            className={`btn btn-ghost ${difficulty === d ? "btn--active" : ""}`}
            onClick={() => setDifficulty(d)}
          >
            {d.charAt(0).toUpperCase() + d.slice(1)}
          </button>
        ))}
      </div>

      <div className="boss-grid boss-grid--solo">
        {BOSS_LIST.map((b) => (
          <button
            key={b.id}
            type="button"
            className={`boss-card ${selectedBoss === b.id ? "boss-card--selected" : ""}`}
            style={{ "--boss-accent": b.color }}
            onClick={() => setSelectedBoss(b.id)}
          >
            <span className="boss-card__name">{b.name}</span>
            <DifficultyStars n={b.difficulty} />
            <span className="boss-card__tag">{b.tagline}</span>
            <span className="boss-card__hp">{b.maxHP} HP</span>
          </button>
        ))}
      </div>

      {status ? <p className="form-error">{status}</p> : null}

      <button type="button" className="btn btn-primary btn-wide" disabled={starting || !socket?.connected} onClick={startSolo}>
        {starting ? "Starting…" : "Start Solo Fight"}
      </button>
    </section>
  );
}

export default SoloLobby;
