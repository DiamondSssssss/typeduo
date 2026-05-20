import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Phaser from "phaser";
import { io } from "socket.io-client";
import Login from "./components/Login";
import HomeScreen from "./components/HomeScreen";
import RoomLobby from "./components/RoomLobby";
import SoloLobby from "./components/SoloLobby";
import BossAlmanac from "./components/BossAlmanac";
import GameHUD from "./components/GameHUD";
import { phaserConfig } from "./game/phaserConfig";
import MainScene from "./game/MainScene";
import TutorialScene from "./game/TutorialScene";
import { RAGE_MAX } from "./game/weapons";

const STORED_USER_KEY = "typeduo_user";
const ACTIVE_GAME_KEY = "typeduo_active_game";

const saveActiveGame = (roomCode, username) => {
  try {
    sessionStorage.setItem(ACTIVE_GAME_KEY, JSON.stringify({ roomCode, username }));
  } catch (_e) { /* ignore */ }
};

const clearActiveGame = () => {
  try { sessionStorage.removeItem(ACTIVE_GAME_KEY); } catch (_e) { /* ignore */ }
};

const readActiveGame = () => {
  try {
    const raw = sessionStorage.getItem(ACTIVE_GAME_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.roomCode && parsed?.username) return parsed;
  } catch (_e) { /* ignore */ }
  return null;
};

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
  const [playAgainVotes, setPlayAgainVotes] = useState(null);
  const [playAgainPending, setPlayAgainPending] = useState(false);
  const [connectionNotice, setConnectionNotice] = useState("");
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
    return io(socketUrl, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });
  }, [currentUser, socketUrl]);

  const tryResumeGame = useCallback(() => {
    if (!socket?.connected || !currentUser) return;
    const saved = readActiveGame();
    if (!saved) return;

    setConnectionNotice("Reconnecting to your game…");
    socket.emit("resume_game", saved, (res) => {
      if (res?.ok) {
        setConnectionNotice("");
        return;
      }
      clearActiveGame();
      setConnectionNotice(res?.message || "Could not resume game.");
      if (res?.message?.includes("expired") || res?.message?.includes("No active")) {
        setGamePayload(null);
        setAppView("home");
      }
    });
  }, [socket, currentUser]);

  useEffect(() => {
    if (!socket) return undefined;
    const onConnect = () => {
      setSocketConnected(true);
      setConnectionNotice("");
      tryResumeGame();
    };
    const onDisconnect = (reason) => {
      setSocketConnected(false);
      if (readActiveGame()) {
        setConnectionNotice(reason === "io server disconnect"
          ? "Disconnected from server — reconnecting…"
          : "Connection lost — reconnecting…");
      }
    };
    const onRoomUpdate = (payload) => setRoomState(payload);
    const onGameState = (payload) => {
      setConnectionNotice("");
      setGamePayload((prev) => ({ ...(prev || {}), ...payload }));
    };
    const onTypingProgress = (payload) => {
      setGamePayload((prev) => ({
        ...(prev || {}),
        currentWord: payload.currentWord ?? prev?.currentWord,
        typedProgress: payload.typedProgress ?? prev?.typedProgress,
        weaponStreak: payload.weaponStreak ?? prev?.weaponStreak,
        wordExpiresAt: payload.wordExpiresAt ?? prev?.wordExpiresAt,
        weaponTypeId: payload.weaponTypeId ?? prev?.weaponTypeId,
        weaponRage: payload.weaponRage ?? prev?.weaponRage,
        ultimateMode: payload.ultimateMode ?? prev?.ultimateMode,
        currentWordPhase: payload.currentWordPhase ?? prev?.currentWordPhase,
      }));
    };
    const onUltimateReady = (payload) => {
      setGamePayload((prev) => ({
        ...(prev || {}),
        weaponRage: payload.weaponRage ?? RAGE_MAX,
        ultimateMode: true,
        currentWord: payload.currentWord ?? payload.phrase ?? prev?.currentWord,
        typedProgress: payload.typedProgress ?? 0,
        currentWordPhase: "ultimate",
        weaponTypeId: payload.weaponTypeId ?? prev?.weaponTypeId,
      }));
    };
    const onWordCompleted = (payload) => {
      setGamePayload((prev) => ({
        ...(prev || {}),
        weaponRage: payload.weaponRage ?? prev?.weaponRage,
        ultimateMode: payload.ultimate ? false : prev?.ultimateMode,
        bossHP: payload.bossHP ?? prev?.bossHP,
      }));
    };
    const onGameOver = (payload) => {
      clearActiveGame();
      setPlayAgainVotes(null);
      setPlayAgainPending(false);
      setGamePayload((prev) => ({ ...(prev || {}), gameOver: payload }));
    };
    const onStartGame = (payload) => {
      const username = currentUser?.username || currentUser?.email;
      if (payload?.roomCode && username) saveActiveGame(payload.roomCode, username);
      setPlayAgainVotes(null);
      setPlayAgainPending(false);
      setGamePayload(payload);
      setConnectionNotice("");
    };
    const onRematchLobby = (room) => {
      clearActiveGame();
      setPlayAgainVotes(null);
      setPlayAgainPending(false);
      setGamePayload(null);
      setRoomState(room);
      setAppView("coop");
      setConnectionNotice("");
    };
    const onPlayAgainUpdate = (payload) => setPlayAgainVotes(payload);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("room_update", onRoomUpdate);
    socket.on("game_state", onGameState);
    socket.on("typing_progress", onTypingProgress);
    socket.on("weapon_ultimate_ready", onUltimateReady);
    socket.on("word_completed", onWordCompleted);
    socket.on("game_over", onGameOver);
    socket.on("startGame", onStartGame);
    socket.on("rematch_lobby", onRematchLobby);
    socket.on("play_again_update", onPlayAgainUpdate);

    if (socket.connected) onConnect();

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("room_update", onRoomUpdate);
      socket.off("game_state", onGameState);
      socket.off("typing_progress", onTypingProgress);
      socket.off("weapon_ultimate_ready", onUltimateReady);
      socket.off("word_completed", onWordCompleted);
      socket.off("game_over", onGameOver);
      socket.off("startGame", onStartGame);
      socket.off("rematch_lobby", onRematchLobby);
      socket.off("play_again_update", onPlayAgainUpdate);
      socket.disconnect();
    };
  }, [socket, currentUser, tryResumeGame]);

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

  const handlePlayAgain = useCallback(() => {
    const code = gamePayload?.roomCode || roomState?.code;
    if (!socket?.connected || !code) return;
    setPlayAgainPending(true);
    socket.emit("play_again", { code }, (res) => {
      if (!res?.ok) {
        setPlayAgainPending(false);
        setConnectionNotice(res?.message || "Không thể chơi lại.");
        return;
      }
      if (res.rematchLobby && res.room) {
        clearActiveGame();
        setPlayAgainVotes(null);
        setGamePayload(null);
        setRoomState(res.room);
        setAppView("coop");
        setConnectionNotice("");
      }
    });
  }, [socket, gamePayload, roomState]);

  const handleLeaveRoom = useCallback(() => {
    const code = roomState?.code || gamePayload?.roomCode;
    const finish = () => {
      clearActiveGame();
      setConnectionNotice("");
      setRoomState(null);
      setGamePayload(null);
      setAppView("home");
    };
    if (!socket || !code) { finish(); return; }
    socket.emit("leave_room", { code }, finish);
  }, [socket, roomState, gamePayload]);

  useEffect(() => {
    const onLeave = () => handleLeaveRoom();
    const onPlayAgain = () => handlePlayAgain();
    window.addEventListener("typeduo_leave_room", onLeave);
    window.addEventListener("typeduo_play_again", onPlayAgain);
    return () => {
      window.removeEventListener("typeduo_leave_room", onLeave);
      window.removeEventListener("typeduo_play_again", onPlayAgain);
    };
  }, [handleLeaveRoom, handlePlayAgain]);

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
    <main className={`app-shell${!inGame && appView !== "home" ? " app-shell--lobby" : ""}${appView === "almanac" ? " app-shell--almanac" : ""}`}>
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
          <GameHUD
            gamePayload={gamePayload}
            socketConnected={socketConnected}
            connectionNotice={connectionNotice}
            playAgainVotes={playAgainVotes}
            playAgainPending={playAgainPending}
            onPlayAgain={handlePlayAgain}
            onLeaveRoom={handleLeaveRoom}
          />
        </div>
      ) : appView === "tutorial" ? (
        <div className="game-layout">
          <div id="tutorial-root" className="game-root" />
          <p className="tutorial-hint card card-wide">
            Same cyan letter glow &amp; particles as co-op. Complete 7 steps (includes Nộ / ultimate) or skip via the top-right button.
          </p>
        </div>
      ) : appView === "almanac" ? (
        <BossAlmanac onBack={() => setAppView("home")} />
      ) : appView === "solo" ? (
        <SoloLobby
          socket={socket}
          currentUser={currentUser}
          onBack={() => setAppView("home")}
          onOpenAlmanac={() => setAppView("almanac")}
        />
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
