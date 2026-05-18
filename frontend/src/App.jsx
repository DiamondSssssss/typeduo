import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Phaser from "phaser";
import { io } from "socket.io-client";
import Login from "./components/Login";
import HomeScreen from "./components/HomeScreen";
import RoomLobby from "./components/RoomLobby";
import SoloLobby from "./components/SoloLobby";
import GameHUD from "./components/GameHUD";
import { phaserConfig } from "./game/phaserConfig";
import MainScene from "./game/MainScene";
import TutorialScene from "./game/TutorialScene";

const STORED_USER_KEY = "typeduo_user";

const readStoredUser = () => {
  try {
    const raw = localStorage.getItem(STORED_USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && (parsed.username || parsed.email)) return parsed;
    return null;
  } catch (_error) {
    return null;
  }
};

function App() {
  const [currentUser, setCurrentUser] = useState(() => readStoredUser());
  const [socketConnected, setSocketConnected] = useState(false);
  const [appView, setAppView] = useState("home");
  const [roomState, setRoomState] = useState(null);
  const [gamePayload, setGamePayload] = useState(null);
  const gameRef = useRef(null);
  const tutorialRef = useRef(null);

  const socketUrl = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

  const handleAuthSuccess = useCallback((user) => {
    if (user) {
      try { localStorage.setItem(STORED_USER_KEY, JSON.stringify(user)); } catch (_e) {}
    }
    setCurrentUser(user);
    setAppView("home");
  }, []);

  const handleSignOut = useCallback(() => {
    try { localStorage.removeItem(STORED_USER_KEY); } catch (_e) {}
    setRoomState(null);
    setGamePayload(null);
    setAppView("home");
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
    const onGameState = (payload) => setGamePayload((prev) => ({ ...(prev || {}), ...payload }));
    const onGameOver = (payload) => setGamePayload((prev) => ({ ...(prev || {}), gameOver: payload }));
    const onStartGame = (payload) => {
      setGamePayload(payload);
      setAppView("game");
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("room_update", onRoomUpdate);
    socket.on("game_state", onGameState);
    socket.on("game_over", onGameOver);
    socket.on("startGame", onStartGame);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("room_update", onRoomUpdate);
      socket.off("game_state", onGameState);
      socket.off("game_over", onGameOver);
      socket.off("startGame", onStartGame);
      socket.disconnect();
    };
  }, [socket]);

  useEffect(() => {
    if (!socket || !gamePayload || gameRef.current) return;
    const game = new Phaser.Game(phaserConfig);
    gameRef.current = game;
    game.events.once("ready", () => {
      game.scene.add("MainScene", MainScene, true, { socket, gamePayload });
    });
  }, [socket, gamePayload]);

  useEffect(() => {
    if (gamePayload || !gameRef.current) return;
    gameRef.current.destroy(true);
    gameRef.current = null;
  }, [gamePayload]);

  useEffect(() => {
    if (appView !== "tutorial" || tutorialRef.current) return undefined;
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      width: 1280,
      height: 720,
      backgroundColor: "#0f172a",
      parent: "tutorial-root",
    });
    tutorialRef.current = game;
    game.events.once("ready", () => {
      game.scene.add("TutorialScene", TutorialScene, true, {
        onComplete: () => {
          if (tutorialRef.current) {
            tutorialRef.current.destroy(true);
            tutorialRef.current = null;
          }
          setAppView("home");
        },
      });
    });
    return () => {
      if (tutorialRef.current) {
        tutorialRef.current.destroy(true);
        tutorialRef.current = null;
      }
    };
  }, [appView]);

  useEffect(() => () => {
    if (gameRef.current) { gameRef.current.destroy(true); gameRef.current = null; }
    if (tutorialRef.current) { tutorialRef.current.destroy(true); tutorialRef.current = null; }
  }, []);

  const handleLeaveRoom = useCallback(() => {
    const code = roomState?.code || gamePayload?.roomCode;
    const finish = () => {
      setRoomState(null);
      setGamePayload(null);
      setAppView("home");
    };
    if (!socket || !code) { finish(); return; }
    socket.emit("leave_room", { code }, finish);
  }, [socket, roomState, gamePayload]);

  useEffect(() => {
    const handler = () => handleLeaveRoom();
    window.addEventListener("typeduo_leave_room", handler);
    return () => window.removeEventListener("typeduo_leave_room", handler);
  }, [handleLeaveRoom]);

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

  const inGame = Boolean(gamePayload);

  return (
    <main className="app-shell">
      <header className="app-header">
        <h1 className="brand">TypeDuo</h1>
        <div className="session-line">
          <span>Signed in as <strong>{currentUser.username || currentUser.email}</strong></span>
          <span className="session-divider" aria-hidden="true">•</span>
          <span className={socketConnected ? "online" : "offline"}>
            {socketConnected ? "connected" : "connecting..."}
          </span>
          {!inGame && appView !== "home" ? (
            <button type="button" className="btn btn-ghost btn-compact" onClick={() => { setAppView("home"); setRoomState(null); }}>
              Main menu
            </button>
          ) : null}
          <button type="button" className="btn btn-ghost btn-compact" onClick={handleSignOut}>Sign out</button>
        </div>
      </header>

      {inGame ? (
        <div className="game-layout">
          <div id="game-root" className="game-root" />
          <GameHUD gamePayload={gamePayload} onLeaveRoom={handleLeaveRoom} />
        </div>
      ) : appView === "tutorial" ? (
        <div className="game-layout">
          <div id="tutorial-root" className="game-root" />
          <p className="tutorial-hint card card-wide">Tutorial — complete all 6 steps or click Skip in-game.</p>
        </div>
      ) : appView === "solo" ? (
        <SoloLobby socket={socket} currentUser={currentUser} onBack={() => setAppView("home")} />
      ) : appView === "coop" ? (
        <RoomLobby
          socket={socket}
          currentUser={currentUser}
          roomState={roomState}
          onRoomUpdate={setRoomState}
          onGameStarted={setGamePayload}
          onLeaveRoom={() => { setRoomState(null); setAppView("home"); }}
        />
      ) : (
        <HomeScreen onSelectMode={setAppView} />
      )}
    </main>
  );
}

export default App;
