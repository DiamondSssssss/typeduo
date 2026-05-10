import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Phaser from "phaser";
import { io } from "socket.io-client";
import Login from "./components/Login";
import RoomLobby from "./components/RoomLobby";
import GameHUD from "./components/GameHUD";
import { phaserConfig } from "./game/phaserConfig";
import MainScene from "./game/MainScene";

const STORED_USER_KEY = "typeduo_user";

const readStoredUser = () => {
  try {
    const raw = localStorage.getItem(STORED_USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && (parsed.username || parsed.email)) {
      return parsed;
    }
    return null;
  } catch (_error) {
    return null;
  }
};

function App() {
  const [currentUser, setCurrentUser] = useState(() => readStoredUser());
  const [socketConnected, setSocketConnected] = useState(false);
  const [roomState, setRoomState] = useState(null);
  const [gamePayload, setGamePayload] = useState(null);
  const gameRef = useRef(null);

  const socketUrl = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

  const handleAuthSuccess = useCallback((user) => {
    if (user) {
      try {
        localStorage.setItem(STORED_USER_KEY, JSON.stringify(user));
      } catch (_error) {
        /* storage might be unavailable; ignore */
      }
    }
    setCurrentUser(user);
  }, []);

  const handleSignOut = useCallback(() => {
    try {
      localStorage.removeItem(STORED_USER_KEY);
    } catch (_error) {
      /* ignore */
    }
    setRoomState(null);
    setGamePayload(null);
    setCurrentUser(null);
  }, []);

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
      setGamePayload((prev) => ({ ...(prev || {}), ...payload }));
    };
    const onGameOver = (payload) => {
      setGamePayload((prev) => ({ ...(prev || {}), gameOver: payload }));
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
    if (!socket || !gamePayload || gameRef.current) return;

    const game = new Phaser.Game(phaserConfig);
    gameRef.current = game;

    game.events.once("ready", () => {
      game.scene.add("MainScene", MainScene, true, {
        socket,
        gamePayload,
      });
    });
  }, [socket, gamePayload]);

  useEffect(() => {
    if (gamePayload || !gameRef.current) return;
    gameRef.current.destroy(true);
    gameRef.current = null;
  }, [gamePayload]);

  useEffect(() => {
    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, []);

  const handleLeaveRoom = useCallback(() => {
    if (!socket) {
      setRoomState(null);
      setGamePayload(null);
      return;
    }
    const code = roomState?.code || gamePayload?.roomCode;
    if (!code) {
      setRoomState(null);
      setGamePayload(null);
      return;
    }
    socket.emit("leave_room", { code }, () => {
      setRoomState(null);
      setGamePayload(null);
    });
  }, [socket, roomState, gamePayload]);

  if (!currentUser) {
    return (
      <main className="app-shell app-shell--centered">
        <header className="app-header">
          <h1 className="brand">TypeDuo</h1>
          <p className="brand-tagline">Cooperative typing boss battles</p>
        </header>
        <Login onAuthSuccess={handleAuthSuccess} />
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <h1 className="brand">TypeDuo</h1>
        <div className="session-line">
          <span>
            Signed in as <strong>{currentUser.username || currentUser.email}</strong>
          </span>
          <span className="session-divider" aria-hidden="true">•</span>
          <span className={socketConnected ? "online" : "offline"}>
            {socketConnected ? "connected" : "connecting..."}
          </span>
          <button
            className="btn btn-ghost btn-compact"
            type="button"
            onClick={handleSignOut}
          >
            Sign out
          </button>
        </div>
      </header>

      {!gamePayload ? (
        <RoomLobby
          socket={socket}
          currentUser={currentUser}
          roomState={roomState}
          onRoomUpdate={setRoomState}
          onGameStarted={setGamePayload}
          onLeaveRoom={handleLeaveRoom}
        />
      ) : (
        <>
          <GameHUD gamePayload={gamePayload} onLeaveRoom={handleLeaveRoom} />
          <div id="game-root" className="game-root" />
        </>
      )}
    </main>
  );
}

export default App;
