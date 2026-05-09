import { useEffect, useState } from "react";

function RoomLobby({ socket, currentUser, roomState, onGameStarted }) {
  const [roomCodeInput, setRoomCodeInput] = useState("");
  const [status, setStatus] = useState("");

  const canInteract = Boolean(socket?.connected);
  const inRoom = Boolean(roomState?.code);
  const playersCount = roomState?.players?.length || 0;

  useEffect(() => {
    if (!socket) return;
    const handleStartGame = (payload) => {
      setStatus("2 players connected. Starting game...");
      onGameStarted(payload);
    };
    socket.on("startGame", handleStartGame);
    return () => socket.off("startGame", handleStartGame);
  }, [onGameStarted, socket]);

  const createRoom = () => {
    if (!socket || !canInteract) return;
    socket.emit(
      "create_room",
      { username: currentUser.username || currentUser.email },
      (response) => {
        if (!response?.ok) {
          setStatus(response?.message || "Failed to create room.");
          return;
        }
        setStatus(`Room created: ${response.room.code}. Waiting for player 2...`);
      }
    );
  };

  const joinRoom = () => {
    if (!socket || !canInteract) return;
    socket.emit(
      "join_room",
      {
        code: roomCodeInput.trim().toUpperCase(),
        username: currentUser.username || currentUser.email,
      },
      (response) => {
        if (!response?.ok) {
          setStatus(response?.message || "Failed to join room.");
          return;
        }
        setStatus(`Joined room ${response.room.code}.`);
      }
    );
  };

  return (
    <div style={styles.card}>
      <h2>Room Lobby</h2>
      <p style={{ margin: 0 }}>
        Socket: {canInteract ? "connected" : "disconnected"} | Players:{" "}
        {playersCount}/2
      </p>
      {roomState?.code ? <p style={{ margin: 0 }}>Room Code: {roomState.code}</p> : null}
      {!inRoom ? (
        <>
          <button onClick={createRoom} disabled={!canInteract}>
            Create Room
          </button>
          <input
            value={roomCodeInput}
            onChange={(e) => setRoomCodeInput(e.target.value)}
            placeholder="Enter room code"
            maxLength={6}
          />
          <button onClick={joinRoom} disabled={!canInteract || !roomCodeInput.trim()}>
            Join Room
          </button>
        </>
      ) : (
        <p style={{ margin: 0 }}>Waiting for room to fill...</p>
      )}
      {status ? <p style={styles.status}>{status}</p> : null}
    </div>
  );
}

const styles = {
  card: {
    maxWidth: 420,
    margin: "0 auto",
    padding: 16,
    border: "1px solid #ddd",
    borderRadius: 8,
    display: "grid",
    gap: 10,
  },
  status: {
    margin: 0,
    color: "#444",
  },
};

export default RoomLobby;
