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
    <div className="card hud-card">
      <h2 className="title">Game Session</h2>
      <p className="subtle-row">Shared HP: {sharedHP}</p>
      <p className="subtle-row">Boss HP: {bossHP}</p>
      <p className="subtle-row">Boss State: {bossState}</p>
      <p className="subtle-row">
        Word: [{typed}]
        {remaining}
      </p>
      {gameOver ? (
        <p className="game-over">
          Game Over - Winner: {gameOver.winner} (HP: {gameOver.sharedHP} | Boss:{" "}
          {gameOver.bossHP})
        </p>
      ) : null}
      <div className="players-box">
        <strong>Players</strong>
        <ul className="players-list">
          {players.map((player) => (
            <li key={player.socketId}>
              {player.username} - role: {player.role}
            </li>
          ))}
        </ul>
      </div>
      <p className="subtle-row">
        Phaser playground is active below.
      </p>
      <div id="game-root" className="game-root" />
    </div>
  );
}

export default GameHUD;
