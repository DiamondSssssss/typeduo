import { useEffect, useState, useCallback } from "react";
import { BOSS_LIST } from "../game/bosses/bossConfigs";
import BossPicker from "./BossPicker";

function DifficultyStars({ n }) {
  return (
    <span className="boss-diff">
      {"★".repeat(n)}
      {"☆".repeat(3 - n)}
    </span>
  );
}

function RoomLobby({ socket, currentUser, roomState, onRoomUpdate, onGameStarted, onLeaveRoom }) {
  const [roomCodeInput, setRoomCodeInput] = useState("");
  const [status, setStatus]     = useState("");
  const [copied, setCopied]     = useState(false);
  const [creating, setCreating] = useState(false);
  const [joining,  setJoining]  = useState(false);
  const [starting, setStarting] = useState(false);

  const canInteract  = Boolean(socket?.connected);
  const inRoom       = Boolean(roomState?.code);
  const players      = roomState?.players || [];
  const playersCount = players.length;
  const username     = currentUser?.username || currentUser?.email;
  const mySocketId   = socket?.id;
  const isHost       = roomState?.hostSocketId === mySocketId;
  const selectedBoss = roomState?.selectedBoss || "watcher";
  const myPlayer     = players.find(p => p.socketId === mySocketId);
  const myRole       = myPlayer?.role;
  const myReady      = myPlayer?.ready || false;
  const nonHostPlayers = players.filter(p => p.socketId !== roomState?.hostSocketId);
  const allNonHostReady = nonHostPlayers.length > 0 && nonHostPlayers.every(p => p.ready);

  useEffect(() => {
    if (!socket) return;
    const handle = (payload) => { onGameStarted(payload); };
    socket.on("startGame", handle);
    return () => socket.off("startGame", handle);
  }, [onGameStarted, socket]);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);

  const createRoom = () => {
    if (!socket || !canInteract || creating) return;
    setStatus(""); setCreating(true);
    socket.emit("create_room", { username }, (res) => {
      setCreating(false);
      if (!res?.ok) { setStatus(res?.message || "Failed to create room."); return; }
      if (res.room && typeof onRoomUpdate === "function") onRoomUpdate(res.room);
      setStatus("Room created. Share the code with a friend.");
    });
  };

  const joinRoom = () => {
    if (!socket || !canInteract || joining) return;
    const code = roomCodeInput.trim().toUpperCase();
    if (!code) return;
    setStatus(""); setJoining(true);
    socket.emit("join_room", { code, username }, (res) => {
      setJoining(false);
      if (!res?.ok) { setStatus(res?.message || "Failed to join room."); return; }
      if (res.room && typeof onRoomUpdate === "function") onRoomUpdate(res.room);
      setStatus(`Joined room ${res.room.code}.`);
    });
  };

  const leaveRoom = () => { setStatus(""); setRoomCodeInput(""); onLeaveRoom?.(); };

  const selectBoss = (bossId) => {
    if (!socket || !isHost || !roomState?.code) return;
    socket.emit("select_boss", { code: roomState.code, bossId }, (res) => {
      if (!res?.ok) setStatus(res?.message || "Could not select boss.");
    });
  };

  const toggleReady = useCallback(() => {
    if (!socket || !roomState?.code) return;
    socket.emit("player_ready", { code: roomState.code }, (res) => {
      if (!res?.ok) setStatus(res?.message || "Could not update ready state.");
    });
  }, [socket, roomState?.code]);

  const startGame = useCallback(() => {
    if (!socket || !roomState?.code || starting) return;
    setStarting(true);
    socket.emit("start_game", { code: roomState.code }, (res) => {
      setStarting(false);
      if (!res?.ok) setStatus(res?.message || "Could not start game.");
    });
  }, [socket, roomState?.code, starting]);

  const copyCode = async () => {
    if (!roomState?.code) return;
    try { await navigator.clipboard.writeText(roomState.code); setCopied(true); }
    catch {
      const ta = document.createElement("textarea"); ta.value = roomState.code;
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); setCopied(true); } catch { /* ignore */ }
      document.body.removeChild(ta);
    }
  };

  // ── In-room view ───────────────────────────────────────────────────────────
  if (inRoom) {
    const currentBoss = BOSS_LIST.find(b => b.id === selectedBoss) || BOSS_LIST[0];
    return (
      <section className="card card-wide" aria-label="Active room">
        <div className="hud-state-row">
          <h2 className="title">Room Lobby</h2>
          {myRole && (
            <span className={`role-badge role-badge--${myRole}`}>
              You · {myRole === "runner" ? "▶ Runner" : "⌨ Typer"}
            </span>
          )}
        </div>

        {/* Boss selection — host can pick at any time before the game starts */}
        {isHost && (
          <BossPicker selectedId={selectedBoss} onSelect={selectBoss} />
        )}

        {/* Current boss for non-host players */}
        {!isHost && (
          <div className="boss-chosen-banner" style={{ "--boss-color": currentBoss.color }}>
            <span className="boss-chosen-label">Fighting</span>
            <strong className="boss-chosen-name">{currentBoss.name}</strong>
            <DifficultyStars n={currentBoss.difficulty} />
          </div>
        )}

        {/* Room code */}
        <div className="room-code-display">
          <p className="room-code-label">Room Code</p>
          <div className="room-code-row">
            <span className="room-code-value">{roomState.code}</span>
            <button type="button" className={`copy-button${copied ? " copy-button--success" : ""}`} onClick={copyCode}>
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>

        {/* Players with ready status */}
        <div className="players-row">
          {players.map(p => {
            const isThisHost = p.socketId === roomState?.hostSocketId;
            return (
              <span key={p.socketId} className={`player-chip player-chip--${p.role}`} title={`${p.username} · ${p.role}`}>
                <span className="player-dot" />
                <strong>{p.username}</strong>
                <span style={{ color: "var(--text-muted)", fontSize: "0.72rem" }}>{p.role}</span>
                {isThisHost
                  ? <span className="ready-badge ready-badge--host">HOST</span>
                  : p.ready
                  ? <span className="ready-badge ready-badge--ready">✓ Ready</span>
                  : <span className="ready-badge ready-badge--waiting">…</span>
                }
              </span>
            );
          })}
        </div>

        {/* Waiting for P2 */}
        {playersCount < 2 && (
          <div className="spinner-row">
            <span className="spinner" aria-hidden="true" />
            <span>Waiting for player 2 to join…</span>
          </div>
        )}

        {/* Ready-check phase — once both players are in */}
        {playersCount >= 2 && (
          <div className="ready-check-row">
            {/* Non-host: toggle ready */}
            {!isHost && (
              <button
                type="button"
                className={`btn ${myReady ? "btn-ready-active" : "btn-ready"}`}
                onClick={toggleReady}
              >
                {myReady ? "✓ Ready!" : "Click when ready"}
              </button>
            )}

            {/* Host: start game (enabled only when all non-host players are ready) */}
            {isHost && (
              <button
                type="button"
                className="btn btn-primary btn-start"
                onClick={startGame}
                disabled={!allNonHostReady || starting}
                title={!allNonHostReady ? "Waiting for the other player to be ready…" : ""}
              >
                {starting ? "Starting…" : allNonHostReady ? "▶ Start Game" : "Waiting for player…"}
              </button>
            )}

            {/* Non-host waiting message after they click ready */}
            {!isHost && myReady && (
              <p className="status-text" style={{ margin: 0 }}>Waiting for the host to start the game…</p>
            )}
          </div>
        )}

        {/* Concept box */}
        <div className="concept-card">
          <p className="concept-title">One character · Two roles</p>
          <p className="lobby-helper">
            Both players share <em>one character</em> on screen.
            The <strong style={{ color: "var(--accent-cyan)" }}>Runner</strong> moves it with WASD to dodge.
            The <strong style={{ color: "var(--accent-purple)" }}>Typer</strong> types words to deal damage.
            Roles swap every time the boss roars!
          </p>
        </div>

        {status ? <p className="status-text">{status}</p> : null}

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button type="button" className="btn btn-danger" onClick={leaveRoom}>Leave Room</button>
        </div>
      </section>
    );
  }

  // ── Pre-room view ──────────────────────────────────────────────────────────
  return (
    <>
      <div className="lobby-status">
        <span className="lobby-status-label">Lobby</span>
        <span className="status-text">
          Socket <span className={canInteract ? "online" : "offline"}>{canInteract ? "connected" : "disconnected"}</span>
        </span>
      </div>

      <section className="lobby-grid" aria-label="Create or join a room">
        <article className="lobby-panel">
          <div className="lobby-panel-header">
            <span className="lobby-panel-icon lobby-panel-icon--cyan">+</span>
            <h3>Create Room</h3>
          </div>
          <p className="lobby-helper">
            Spin up a new battle and share the code with a teammate.
            You start as the <strong style={{ color: "var(--accent-cyan)" }}>Runner</strong> — choose a boss and dodge with WASD.
          </p>
          <button className="btn btn-primary" onClick={createRoom} disabled={!canInteract || creating}>
            {creating ? "Creating…" : "Create New Room"}
          </button>
        </article>

        <article className="lobby-panel">
          <div className="lobby-panel-header">
            <span className="lobby-panel-icon">→</span>
            <h3>Join Room</h3>
          </div>
          <p className="lobby-helper">
            Got a room code? Enter it below to join as the <strong style={{ color: "var(--accent-purple)" }}>Typer</strong> — type words to attack.
          </p>
          <input
            className="input input-monospace"
            value={roomCodeInput}
            onChange={e => setRoomCodeInput(e.target.value.toUpperCase())}
            placeholder="ABC123"
            maxLength={6}
            spellCheck={false}
            autoComplete="off"
            onKeyDown={e => { if (e.key === "Enter") joinRoom(); }}
          />
          <button className="btn btn-secondary" onClick={joinRoom} disabled={!canInteract || joining || !roomCodeInput.trim()}>
            {joining ? "Joining…" : "Join Room"}
          </button>
        </article>
      </section>

      {status ? <p className="status-text" style={{ textAlign: "center" }}>{status}</p> : null}
    </>
  );
}

export default RoomLobby;
