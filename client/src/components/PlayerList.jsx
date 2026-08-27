export function PlayerList({ players, adminPlayerId }) {
  return (
    <div className="panel player-list">
      <div className="panel-header">
        <p className="eyebrow">Players</p>
        <span>{players.length} seated</span>
      </div>
      <div className="player-grid">
        {players.map((player) => (
          <div key={player.playerId} className="player-card">
            <div>
              <strong>{player.nickname}</strong>
              <p>{player.playerId === adminPlayerId ? "Table admin" : "Player"}</p>
            </div>
            <span className={`presence ${player.isOnline ? "online" : "offline"}`}>
              {player.isOnline ? "Online" : "Offline"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
