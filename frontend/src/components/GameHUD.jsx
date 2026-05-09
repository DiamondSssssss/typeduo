function GameHUD({ gamePayload }) {
  const players = gamePayload?.players || [];
  const sharedHP = gamePayload?.sharedHP ?? 100;
  const bossHP = gamePayload?.bossHP ?? 100;
  const currentWord = gamePayload?.currentWord || "-";
  const typedProgress = gamePayload?.typedProgress || 0;
  const typed = currentWord.slice(0, typedProgress);
  const remaining = currentWord.slice(typedProgress);
  const gameOver = gamePayload?.gameOver;
  const bossState = gamePayload?.bossState || "attack";

  return (
    <div style={styles.card}>
      <h2>Game Session</h2>
      <p style={{ margin: 0 }}>Shared HP: {sharedHP}</p>
      <p style={{ margin: 0 }}>Boss HP: {bossHP}</p>
      <p style={{ margin: 0 }}>Boss State: {bossState}</p>
      <p style={{ margin: 0 }}>
        Word: [{typed}]
        {remaining}
      </p>
      {gameOver ? (
        <p style={styles.gameOver}>
          Game Over - Winner: {gameOver.winner} (HP: {gameOver.sharedHP} | Boss:{" "}
          {gameOver.bossHP})
        </p>
      ) : null}
      <div>
        <strong>Players</strong>
        <ul>
          {players.map((player) => (
            <li key={player.socketId}>
              {player.username} - role: {player.role}
            </li>
          ))}
        </ul>
      </div>
      <p style={{ margin: 0, color: "#666" }}>
        Phaser playground is active below.
      </p>
      <div id="game-root" style={styles.gameRoot} />
    </div>
  );
}

const styles = {
  card: {
    maxWidth: 500,
    margin: "16px auto",
    padding: 16,
    border: "1px solid #ddd",
    borderRadius: 8,
  },
  gameRoot: {
    marginTop: 12,
    width: 960,
    maxWidth: "100%",
    minHeight: 540,
    border: "1px solid #1f2937",
    background: "#0f172a",
  },
  gameOver: {
    margin: "8px 0 0",
    color: "#b91c1c",
    fontWeight: 700,
  },
};

export default GameHUD;
