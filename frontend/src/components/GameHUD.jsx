import { useEffect, useRef, useState, useCallback } from "react";

/** Animated fill bar that drains down as remainMs counts toward 0. */
function WindUpBar({ remainMs, label }) {
  const [pct, setPct] = useState(1);
  const startRef = useRef(Date.now());
  const totalRef = useRef(remainMs);
  useEffect(() => {
    startRef.current = Date.now();
    totalRef.current = remainMs;
    const raf = () => {
      const elapsed = Date.now() - startRef.current;
      const p = Math.max(0, 1 - elapsed / Math.max(1, totalRef.current));
      setPct(p);
      if (p > 0) requestAnimationFrame(raf);
    };
    const id = requestAnimationFrame(raf);
    return () => cancelAnimationFrame(id);
  }, [remainMs]);
  return (
    <div className="windup-bar-wrap">
      <span className="windup-bar-label">{label}</span>
      <div className="windup-bar-track">
        <div className="windup-bar-fill" style={{ width: `${pct * 100}%` }} />
      </div>
    </div>
  );
}

function clampPct(value, max) {
  const safeMax = Math.max(1, max || 1);
  return Math.max(0, Math.min(1, (value || 0) / safeMax));
}

function HPBar({ label, hp, maxHP, variant = "team", prominent = false }) {
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
    prominent ? "hp-bar-wrapper--prominent" : "",
    flashing ? "hp-bar-wrapper--flash" : "",
    healing ? "hp-bar-wrapper--heal" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={["hp-stack", prominent ? "hp-stack--prominent" : ""].filter(Boolean).join(" ")}>
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

import { ATTACK_LABELS } from "../game/bosses/bossConfigs";

import { getWeapon, RAGE_MAX } from "../game/weapons";

function WordTimerBar({ expiresAt }) {
  const [pct, setPct] = useState(1);
  const totalRef = useRef(0);
  const startRef = useRef(0);
  useEffect(() => {
    if (!expiresAt) return undefined;
    const now = Date.now();
    totalRef.current = Math.max(400, expiresAt - now);
    startRef.current = now;
    const tick = () => {
      const p = Math.max(0, 1 - (Date.now() - startRef.current) / totalRef.current);
      setPct(p);
      if (p > 0) requestAnimationFrame(tick);
    };
    const id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [expiresAt]);
  if (!expiresAt) return null;
  return (
    <div className="weapon-timer-track">
      <div className="weapon-timer-fill" style={{ width: `${pct * 100}%` }} />
    </div>
  );
}

function WeaponHudPanel({ weaponTypeId, weaponHeld, weaponStreak, wordExpiresAt, weaponRage = 0, ultimateMode = false }) {
  const weapon = getWeapon(weaponTypeId);
  const ragePct = Math.min(100, Math.round((weaponRage / RAGE_MAX) * 100));
  const rageFull = ragePct >= 100 || ultimateMode;
  if (!weaponHeld) {
    return (
      <div className="weapon-hud">
        <span className="weapon-hud__tag">Nhặt vũ khí trên map để bắt đầu gõ</span>
      </div>
    );
  }
  return (
    <div className={`weapon-hud${rageFull ? " weapon-hud--rage-full" : ""}`} style={{ "--weapon-color": weapon.color }}>
      <div className="weapon-hud__row">
        <span className="weapon-hud__icon">{weapon.icon}</span>
        <span className="weapon-hud__name">{weapon.nameVi}</span>
        <span className="weapon-hud__tag">{weapon.tag}</span>
        {weapon.healOnWord ? <span className="weapon-hud__tag">+{weapon.healOnWord} HP/từ</span> : null}
        {weapon.streakDamage && weaponStreak > 0 ? (
          <span className="weapon-hud__tag">Chuỗi ×{weaponStreak}</span>
        ) : null}
      </div>
      {weapon.wordTimer ? <WordTimerBar expiresAt={wordExpiresAt} /> : null}
      {weapon.streakDamage ? (
        <div className="weapon-streak-bar">
          {Array.from({ length: 10 }, (_, i) => (
            <span key={i} className={`weapon-streak-dot${weaponStreak > i ? " weapon-streak-dot--lit" : ""}`} />
          ))}
        </div>
      ) : null}
      <div className={`weapon-rage-row${rageFull ? " weapon-rage-row--full" : ""}`}>
        <span className="weapon-rage-label">⚡ NỘ</span>
        <div className="weapon-rage-track">
          <div
            className="weapon-rage-fill"
            style={{ width: `${ragePct}%` }}
          />
        </div>
        <span className="weapon-rage-pct">{ragePct}%</span>
        {rageFull ? (
          <span className="weapon-hud__tag weapon-hud__tag--ult">
            {ultimateMode ? "GÕ CÂU VÀNG!" : "SẴN SÀNG!"}
          </span>
        ) : (
          <span className="weapon-rage-hint">Gõ từ → tích Nộ</span>
        )}
      </div>
      {ultimateMode && weapon.ultimateName ? (
        <p className="weapon-ult-hint">
          Chiêu cuối <strong>{weapon.ultimateName}</strong> — gõ hết câu vàng trên màn hình game
        </p>
      ) : null}
    </div>
  );
}

function GameHUD({
  gamePayload,
  socketConnected = true,
  connectionNotice = "",
  playAgainVotes = null,
  playAgainPending = false,
  isHost = false,
  onPlayAgain,
  onLeaveRoom,
}) {
  const players = gamePayload?.players || [];
  const sharedHP = gamePayload?.sharedHP ?? 100;
  const sharedMaxHP = gamePayload?.sharedMaxHP ?? 100;
  const bossHP = gamePayload?.bossHP ?? 100;
  const bossMaxHP = gamePayload?.bossMaxHP ?? 100;
  const bossState = gamePayload?.bossState || "countdown";
  const phase = gamePayload?.currentWordPhase || "short";
  const weaponTypeId = gamePayload?.weaponTypeId || "shortsword";
  const weaponStreak = gamePayload?.weaponStreak || 0;
  const wordExpiresAt = gamePayload?.wordExpiresAt || 0;
  const countdownRemaining = gamePayload?.countdownRemaining || 0;
  const gameOver = gamePayload?.gameOver;
  const winner = gameOver?.winner;
  const playersWon = winner === "players";
  const weaponHeld = gamePayload?.weaponHeld || false;
  const bossAttack = gamePayload?.boss?.attackType || "normal";
  const laserState = gamePayload?.boss?.laserState;
  const windingUp  = gamePayload?.boss?.windingUp || false;
  const windUpAttack = gamePayload?.boss?.windUpAttack;
  const windUpRemaining = gamePayload?.boss?.windUpRemaining || 0;
  const bossId = gamePayload?.bossId || "watcher";
  const gameMode = gamePayload?.gameMode || gameOver?.gameMode || "coop";
  const isSolo = gameMode === "solo";
  const roomCode = gamePayload?.roomCode || gameOver?.roomCode;
  const iVotedPlayAgain = playAgainPending;
  const waitingNames = (playAgainVotes?.voted || [])
    .filter((v) => v.connected && !v.wantsPlayAgain)
    .map((v) => v.username);
  const columnState = gamePayload?.boss?.columnState;
  const bossShield = gamePayload?.bossShield ?? 0;
  const bossShieldMax = gamePayload?.bossShieldMax ?? 0;
  const poisoned = gamePayload?.poisoned;
  const slowed = gamePayload?.slowed;
  const weaponRage = gamePayload?.weaponRage ?? 0;
  const ultimateMode = gamePayload?.ultimateMode ?? false;
  const ultWeapon = getWeapon(weaponTypeId);

  const orderedPlayers = [...players].sort((a, b) => {
    if (a.role === "solo") return -1;
    if (b.role === "solo") return 1;
    if (a.role === b.role) return 0;
    return a.role === "runner" ? -1 : 1;
  });

  return (
    <section className="card card-wide hud-card hud-card--compact" aria-label="Game HUD">
      {(!socketConnected || connectionNotice) && !gameOver ? (
        <div className="connection-banner" role="status">
          <span className="connection-banner__dot" aria-hidden="true" />
          {connectionNotice || "Reconnecting…"}
        </div>
      ) : null}
      <div className="hud-state-row">
        <h2 className="title" style={{ fontSize: "1rem", margin: 0 }}>
          {isSolo ? "Solo Battle" : "Boss Battle"}
        </h2>
        <span
          className={`weapon-badge${weaponHeld ? " weapon-badge--held" : " weapon-badge--dropped"}`}
          style={weaponHeld ? { borderColor: getWeapon(weaponTypeId).color } : undefined}
        >
          {weaponHeld ? `${getWeapon(weaponTypeId).icon} ${getWeapon(weaponTypeId).nameVi}` : "⚔ Nhặt vũ khí!"}
        </span>
        <div className="hud-pills">
          <span className={`boss-state boss-state--${bossState}`}>
            <span
              className="player-dot"
              style={{ background: "currentColor", boxShadow: "0 0 10px currentColor" }}
            />
            Boss · {bossState}
          </span>
          <span className={`phase-pill phase-pill--${phase}`}>{phaseLabel(phase)}</span>
          {bossState === "attack" && !windingUp && (
            <span className="attack-badge" data-type={bossAttack} title={`Boss attack: ${bossAttack}`}>
              {ATTACK_LABELS[bossAttack] || bossAttack}
            </span>
          )}
          {windingUp && windUpAttack && (
            <span className="attack-badge attack-badge--windup" title="Boss is charging...">
              ⚡ CHARGING {ATTACK_LABELS[windUpAttack] || windUpAttack}
            </span>
          )}
        </div>
      </div>

      {bossState === "countdown" && !gameOver ? (
        <div className="callout callout--countdown">
          Battle starts in {Math.max(1, Math.ceil(countdownRemaining / 1000))}s — get ready!
        </div>
      ) : null}

      {bossState === "stunned" && !gameOver ? (
        <div className="callout callout--stun">
          Boss stunned! Gõ ngay để gây <strong>2× sát thương</strong>
        </div>
      ) : null}

      {bossState === "roar" && !gameOver ? (
        <div className="callout callout--roar">
          {isSolo ? "Boss is roaring — typing locked, then stunned!" : "Boss is roaring — typing locked, brace for role swap!"}
        </div>
      ) : null}

      {windingUp && windUpAttack && !gameOver ? (
        <div className="callout callout--windup">
          <WindUpBar remainMs={windUpRemaining} label={`Charging: ${ATTACK_LABELS[windUpAttack] || windUpAttack}`} />
        </div>
      ) : null}

      {bossShield > 0 && !gameOver ? (
        <div className="callout callout--shield">🛡 Boss shield: {Math.round(bossShield)} / {bossShieldMax}</div>
      ) : null}
      {poisoned && !gameOver ? <div className="callout callout--poison">☣ Poisoned</div> : null}
      {slowed && !gameOver ? <div className="callout callout--slow">🐌 Slowed</div> : null}

      {(columnState === "warning" || laserState === "warning") && !gameOver ? (
        <div className="callout callout--laser">⚠ COLUMN INCOMING — move out of the beam!</div>
      ) : null}
      {(columnState === "active" || laserState === "active") && !gameOver ? (
        <div className="callout callout--laser callout--laser-active">⚡ FIRING!</div>
      ) : null}

      <div className="hud-grid">
        <HPBar label="♥ Team HP" hp={sharedHP} maxHP={sharedMaxHP} prominent />
        <HPBar label="Boss HP" hp={bossHP} maxHP={bossMaxHP} variant="boss" />
      </div>

      {weaponHeld && !gameOver && ultimateMode ? (
        <div className="callout callout--ultimate">
          <strong>CHIÊU CUỐI SẴN SÀNG!</strong> Gõ câu vàng <em>{ultWeapon.ultimatePhrase}</em> để dùng{" "}
          <strong>{ultWeapon.ultimateName}</strong>
        </div>
      ) : null}

      {weaponHeld && !gameOver && !ultimateMode && weaponRage >= 75 ? (
        <div className="callout callout--rage">
          Nộ {Math.round(weaponRage)}% — gõ thêm vài từ nữa để kích hoạt chiêu cuối
        </div>
      ) : null}

      <WeaponHudPanel
        weaponTypeId={weaponTypeId}
        weaponHeld={weaponHeld}
        weaponStreak={weaponStreak}
        wordExpiresAt={wordExpiresAt}
        weaponRage={weaponRage}
        ultimateMode={ultimateMode}
      />

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

          {roomCode ? (
            <p className="game-over-room-code">
              Phòng <strong>{roomCode}</strong> — chơi lại giữ nguyên mã phòng
            </p>
          ) : null}

          {typeof onPlayAgain === "function" ? (
            <div className="game-over-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={onPlayAgain}
                disabled={playAgainPending && isSolo}
              >
                {isSolo
                  ? (playAgainPending ? "Đang tải trận mới…" : "Chơi lại")
                  : isHost
                    ? "Chơi lại (về lobby)"
                    : iVotedPlayAgain
                      ? "Đã sẵn sàng — chờ đồng đội/host"
                      : "Chơi lại (cùng phòng)"}
              </button>
              {typeof onLeaveRoom === "function" ? (
                <button type="button" className="btn btn-ghost" onClick={onLeaveRoom}>
                  Rời phòng
                </button>
              ) : null}
            </div>
          ) : null}

          {!isSolo && isHost ? (
            <p className="status-text game-over-waiting">
              Bạn là host — bấm <strong>Chơi lại</strong> để cả phòng về lobby (không cần chờ đồng đội).
            </p>
          ) : null}

          {!isSolo && !isHost && iVotedPlayAgain && waitingNames.length > 0 ? (
            <p className="status-text game-over-waiting">
              Đang chờ: <strong>{waitingNames.join(", ")}</strong> (hoặc host bấm chơi lại)
            </p>
          ) : null}

          {!isSolo && playAgainVotes?.allVoted ? (
            <p className="status-text">Cả hai đã bấm chơi lại — quay về lobby…</p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export default GameHUD;
