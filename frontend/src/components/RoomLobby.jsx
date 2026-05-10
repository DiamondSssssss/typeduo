import { useEffect, useState } from "react";

function RoomLobby({
  socket,
  currentUser,
  roomState,
  onRoomUpdate,
  onGameStarted,
  onLeaveRoom,
}) {
  const [roomCodeInput, setRoomCodeInput] = useState("");
  const [status, setStatus] = useState("");
  const [copied, setCopied] = useState(false);
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);

  const canInteract = Boolean(socket?.connected);
  const inRoom = Boolean(roomState?.code);
  const players = roomState?.players || [];
  const playersCount = players.length;
  const username = currentUser?.username || currentUser?.email;

  useEffect(() => {
    if (!socket) return;
    const handleStartGame = (payload) => {
      setStatus("2 players connected. Starting battle...");
      onGameStarted(payload);
    };
    socket.on("startGame", handleStartGame);
    return () => socket.off("startGame", handleStartGame);
  }, [onGameStarted, socket]);

  useEffect(() => {
    if (!copied) return undefined;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  const createRoom = () => {
    if (!socket || !canInteract || creating) return;
    setStatus("");
    setCreating(true);
    socket.emit("create_room", { username }, (response) => {
      setCreating(false);
      if (!response?.ok) {
        setStatus(response?.message || "Failed to create room.");
        return;
      }
      if (response.room && typeof onRoomUpdate === "function") {
        onRoomUpdate(response.room);
      }
      setStatus(`Room created. Share the code with a friend.`);
    });
  };

  const joinRoom = () => {
    if (!socket || !canInteract || joining) return;
    const code = roomCodeInput.trim().toUpperCase();
    if (!code) return;
    setStatus("");
    setJoining(true);
    socket.emit("join_room", { code, username }, (response) => {
      setJoining(false);
      if (!response?.ok) {
        setStatus(response?.message || "Failed to join room.");
        return;
      }
      if (response.room && typeof onRoomUpdate === "function") {
        onRoomUpdate(response.room);
      }
      setStatus(`Joined room ${response.room.code}.`);
    });
  };

  const leaveRoom = () => {
    setStatus("");
    setRoomCodeInput("");
    if (typeof onLeaveRoom === "function") {
      onLeaveRoom();
    }
  };

  const copyRoomCode = async () => {
    if (!roomState?.code) return;
    try {
      await navigator.clipboard.writeText(roomState.code);
      setCopied(true);
    } catch (_error) {
      const textarea = document.createElement("textarea");
      textarea.value = roomState.code;
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand("copy");
        setCopied(true);
      } catch (_inner) {
        /* ignore */
      }
      document.body.removeChild(textarea);
    }
  };

  if (inRoom) {
    return (
      <section className="card card-wide" aria-label="Active room">
        <div className="hud-state-row">
          <h2 className="title">Room Lobby</h2>
          <span className={`role-badge role-badge--${players.find((p) => p.socketId === socket?.id)?.role || "typer"}`}>
            You · {players.find((p) => p.socketId === socket?.id)?.role || "typer"}
          </span>
        </div>

        <div className="room-code-display">
          <p className="room-code-label">Room Code</p>
          <div className="room-code-row">
            <span className="room-code-value">{roomState.code}</span>
            <button
              type="button"
              className={`copy-button${copied ? " copy-button--success" : ""}`}
              onClick={copyRoomCode}
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>

        <div className="players-row">
          {players.map((p) => (
            <span
              key={p.socketId}
              className={`player-chip player-chip--${p.role}`}
              title={`${p.username} · ${p.role}`}
            >
              <span className="player-dot" />
              <strong>{p.username}</strong>
              <span style={{ color: "var(--text-muted)" }}>{p.role}</span>
            </span>
          ))}
        </div>

        {playersCount < 2 ? (
          <div className="spinner-row">
            <span className="spinner" aria-hidden="true" />
            <span>Waiting for player {playersCount + 1} of 2 to join...</span>
          </div>
        ) : (
          <p className="status-text">Both players ready. Starting battle...</p>
        )}

        <p className="lobby-helper">
          The <strong style={{ color: "var(--accent-cyan)" }}>Runner</strong> dodges with WASD.
          The <strong style={{ color: "var(--accent-purple)" }}>Typer</strong> defeats the boss
          by typing words. Roles swap when the boss roars at HP thresholds.
        </p>

        {status ? <p className="status-text">{status}</p> : null}

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button type="button" className="btn btn-danger" onClick={leaveRoom}>
            Leave Room
          </button>
        </div>
      </section>
    );
  }

  return (
    <>
      <div className="lobby-status">
        <span className="lobby-status-label">Lobby</span>
        <span className="status-text">
          Socket{" "}
          <span className={canInteract ? "online" : "offline"}>
            {canInteract ? "connected" : "disconnected"}
          </span>{" "}
          · Players in room: {playersCount}/2
        </span>
      </div>

      <section className="lobby-grid" aria-label="Create or join a room">
        <article className="lobby-panel">
          <div className="lobby-panel-header">
            <span className="lobby-panel-icon lobby-panel-icon--cyan">+</span>
            <h3>Create Room</h3>
          </div>
          <p className="lobby-helper">
            Spin up a new battle and share the room code with a teammate. You'll start as the Runner.
          </p>
          <button
            className="btn btn-primary"
            onClick={createRoom}
            disabled={!canInteract || creating}
          >
            {creating ? "Creating..." : "Create New Room"}
          </button>
        </article>

        <article className="lobby-panel">
          <div className="lobby-panel-header">
            <span className="lobby-panel-icon">→</span>
            <h3>Join Room</h3>
          </div>
          <p className="lobby-helper">
            Got a room code from a friend? Enter it below to join as the Typer.
          </p>
          <input
            className="input input-monospace"
            value={roomCodeInput}
            onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
            placeholder="ABC123"
            maxLength={6}
            spellCheck={false}
            autoComplete="off"
            onKeyDown={(e) => {
              if (e.key === "Enter") joinRoom();
            }}
          />
          <button
            className="btn btn-secondary"
            onClick={joinRoom}
            disabled={!canInteract || joining || !roomCodeInput.trim()}
          >
            {joining ? "Joining..." : "Join Room"}
          </button>
        </article>
      </section>

      {status ? <p className="status-text" style={{ textAlign: "center" }}>{status}</p> : null}
    </>
  );
}

export default RoomLobby;
