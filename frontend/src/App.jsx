import { useEffect, useMemo, useState } from "react";
import Phaser from "phaser";
import { io } from "socket.io-client";
import Login from "./components/Login";
import RoomLobby from "./components/RoomLobby";
import GameHUD from "./components/GameHUD";
import { phaserConfig } from "./game/phaserConfig";
import MainScene from "./game/MainScene";

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [roomState, setRoomState] = useState(null);
  const [gamePayload, setGamePayload] = useState(null);

  const socketUrl = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

  const socket = useMemo(() => {
    if (!currentUser) return null;
    return io(socketUrl, { transports: ["websocket"] });
  }, [currentUser, socketUrl]);

  useEffect(() => {
    if (!socket) return undefined;

    const onConnect = () => setSocketConnected(true);
    const onDisconnect = () => setSocketConnected(false);
    const onRoomUpdate = (payload) => setRoomState(payload);
    const onGameState = (payload) => {
      setGamePayload((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          ...payload,
        };
      });
    };
    const onGameOver = (payload) => {
      setGamePayload((prev) => (prev ? { ...prev, gameOver: payload } : prev));
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("room_update", onRoomUpdate);
    socket.on("game_state", onGameState);
    socket.on("game_over", onGameOver);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("room_update", onRoomUpdate);
      socket.off("game_state", onGameState);
      socket.off("game_over", onGameOver);
      socket.disconnect();
    };
  }, [socket]);

  useEffect(() => {
    if (!socket || !gamePayload) return undefined;

    const game = new Phaser.Game({
      ...phaserConfig,
      scene: MainScene,
    });
    game.scene.start("MainScene", {
      socket,
      gamePayload,
    });

    return () => {
      game.destroy(true);
    };
  }, [socket, gamePayload]);

  if (!currentUser) {
    return (
      <main style={styles.main}>
        <h1>TypeDuo</h1>
        <Login onAuthSuccess={setCurrentUser} />
      </main>
    );
  }

  return (
    <main style={styles.main}>
      <h1>TypeDuo</h1>
      <p style={{ marginTop: 0 }}>
        Signed in as <strong>{currentUser.username || currentUser.email}</strong> | Socket:{" "}
        {socketConnected ? "connected" : "connecting..."}
      </p>
      {!gamePayload ? (
        <RoomLobby
          socket={socket}
          currentUser={currentUser}
          roomState={roomState}
          onGameStarted={setGamePayload}
        />
      ) : (
        <GameHUD gamePayload={gamePayload} />
      )}
    </main>
  );
}

const styles = {
  main: {
    minHeight: "100vh",
    maxWidth: 900,
    margin: "0 auto",
    padding: 20,
    fontFamily: "Arial, sans-serif",
  },
};

export default App;
