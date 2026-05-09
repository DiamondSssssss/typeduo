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
    <div className="card">
      <h2 className="title">Room Lobby</h2>
      <p className="subtle-row">
        Socket: {canInteract ? "connected" : "disconnected"} | Players:{" "}
        {playersCount}/2
      </p>
      {roomState?.code ? <p className="subtle-row">Room Code: {roomState.code}</p> : null}
      {!inRoom ? (
        <>
          <button className="btn btn-primary" onClick={createRoom} disabled={!canInteract}>
            Create Room
          </button>
          <input
            className="input"
            value={roomCodeInput}
            onChange={(e) => setRoomCodeInput(e.target.value)}
            placeholder="Enter room code"
            maxLength={6}
          />
          <button
            className="btn btn-secondary"
            onClick={joinRoom}
            disabled={!canInteract || !roomCodeInput.trim()}
          >
            Join Room
          </button>
        </>
      ) : (
        <p className="subtle-row">Waiting for room to fill...</p>
      )}
      {status ? <p className="status-text">{status}</p> : null}
    </div>
  );
}

export default RoomLobby;
