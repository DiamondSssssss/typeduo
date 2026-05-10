import { useEffect, useRef, useState } from "react";

function clampPct(value, max) {
  const safeMax = Math.max(1, max || 1);
  return Math.max(0, Math.min(1, (value || 0) / safeMax));
}

function HPBar({ label, hp, maxHP, variant = "team" }) {
  const pct = clampPct(hp, maxHP);
  const prevHpRef = useRef(hp);
  const [flashing, setFlashing] = useState(false);
  const [healing, setHealing] = useState(false);
  const flashTimer = useRef();
  const healTimer = useRef();

  useEffect(() => {
    const prev = prevHpRef.current;
    if (hp < prev) {
      setFlashing(true);
      clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setFlashing(false), 360);
    } else if (hp > prev) {
      setHealing(true);
      clearTimeout(healTimer.current);
      healTimer.current = setTimeout(() => setHealing(false), 600);
    }
    prevHpRef.current = hp;
    return () => {
      clearTimeout(flashTimer.current);
      clearTimeout(healTimer.current);
    };
  }, [hp]);

  let fillClass = "hp-bar-fill";
  if (variant === "boss") {
    fillClass += " hp-bar-fill--boss";
  } else if (pct < 0.25) {
    fillClass += " hp-bar-fill--danger";
  } else if (pct < 0.5) {
    fillClass += " hp-bar-fill--warning";
  }

  const wrapperClass = [
    "hp-bar-wrapper",
    flashing ? "hp-bar-wrapper--flash" : "",
    healing ? "hp-bar-wrapper--heal" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="hp-stack">
      <div className="hp-meta">
        <span>{label}</span>
        <span className="hp-meta-value">
          {Math.round(hp)} / {maxHP}
        </span>
      </div>
      <div
        className={wrapperClass}
        role="meter"
        aria-valuemin={0}
        aria-valuemax={maxHP}
        aria-valuenow={hp}
      >
        <div className={fillClass} style={{ width: `${pct * 100}%` }} />
      </div>
    </div>
  );
}

const formatElapsed = (ms) => {
  if (typeof ms !== "number" || ms < 0) return "—";
  const seconds = Math.floor(ms / 1000);
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
};

const phaseLabel = (phase) => {
  if (phase === "short") return "Phase 1 · short";
  if (phase === "medium") return "Phase 2 · medium";
  if (phase === "hard") return "Phase 3 · hard";
  return "Phase 1";
};

function GameHUD({ gamePayload, onLeaveRoom }) {
  const players = gamePayload?.players || [];
  const sharedHP = gamePayload?.sharedHP ?? 100;
  const sharedMaxHP = gamePayload?.sharedMaxHP ?? 100;
  const bossHP = gamePayload?.bossHP ?? 100;
  const bossMaxHP = gamePayload?.bossMaxHP ?? 100;
  const bossState = gamePayload?.bossState || "countdown";
  const phase = gamePayload?.currentWordPhase || "short";
  const streak = gamePayload?.streak || 0;
  const countdownRemaining = gamePayload?.countdownRemaining || 0;
  const gameOver = gamePayload?.gameOver;
  const winner = gameOver?.winner;
  const playersWon = winner === "players";

  const orderedPlayers = [...players].sort((a, b) => {
    if (a.role === b.role) return 0;
    return a.role === "runner" ? -1 : 1;
  });

  return (
    <section className="card card-wide hud-card" aria-label="Game HUD">
      <div className="hud-state-row">
        <h2 className="title">Boss Battle</h2>
        <div className="hud-pills">
          <span className={`boss-state boss-state--${bossState}`}>
            <span
              className="player-dot"
              style={{ background: "currentColor", boxShadow: "0 0 10px currentColor" }}
            />
            Boss · {bossState}
          </span>
          <span className={`phase-pill phase-pill--${phase}`}>{phaseLabel(phase)}</span>
          {streak >= 2 ? (
            <span className="streak-pill">Streak ×{streak}</span>
          ) : null}
        </div>
      </div>

      {bossState === "countdown" && !gameOver ? (
        <div className="callout callout--countdown">
          Battle starts in {Math.max(1, Math.ceil(countdownRemaining / 1000))}s — get ready!
        </div>
      ) : null}

      {bossState === "stunned" && !gameOver ? (
        <div className="callout callout--stun">
          Boss stunned! Type now for <strong>2× damage</strong>.
        </div>
      ) : null}

      {bossState === "roar" && !gameOver ? (
        <div className="callout callout--roar">
          Boss is roaring — typing locked, brace for role swap!
        </div>
      ) : null}

      <div className="hud-grid">
        <HPBar label="Team HP" hp={sharedHP} maxHP={sharedMaxHP} />
        <HPBar label="Boss HP" hp={bossHP} maxHP={bossMaxHP} variant="boss" />
      </div>

      <div className="players-row">
        {orderedPlayers.map((p) => (
          <span
            key={p.socketId}
            className={`player-chip player-chip--${p.role}`}
            title={`${p.username} · ${p.role}`}
          >
            <span className="player-dot" />
            <strong>{p.username}</strong>
            <span
              className={`role-badge role-badge--${p.role}`}
              style={{ padding: "2px 8px", fontSize: "0.66rem" }}
            >
              {p.role}
            </span>
            <span className="player-chip-stat">{p.wordsTyped || 0} words</span>
          </span>
        ))}
      </div>

      {gameOver ? (
        <div className={`game-over-banner${playersWon ? " game-over-banner--win" : ""}`}>
          <p
            className={`game-over-headline ${
              playersWon ? "game-over-headline--win" : "game-over-headline--lose"
            }`}
          >
            {playersWon ? "Victory! Boss defeated." : "Defeat. The boss prevailed."}
          </p>
          <p className="status-text">
            Time {formatElapsed(gameOver.elapsedMs)} · Total words {gameOver.totalWordsTyped ?? "—"}
          </p>

          {Array.isArray(gameOver.players) && gameOver.players.length > 0 ? (
            <div className="stats-grid">
              {gameOver.players.map((p) => (
                <div className="stat-card" key={p.socketId}>
                  <p className="stat-card-name">{p.username}</p>
                  <div className="stat-row">
                    <span>Words typed</span>
                    <strong>{p.wordsTyped}</strong>
                  </div>
                  <div className="stat-row">
                    <span>Damage dealt</span>
                    <strong>{p.damageDealt}</strong>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {typeof onLeaveRoom === "function" ? (
            <div style={{ display: "flex", justifyContent: "center" }}>
              <button type="button" className="btn btn-primary" onClick={onLeaveRoom}>
                Return to Lobby
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export default GameHUD;
