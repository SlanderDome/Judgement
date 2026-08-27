export function PlayerSeat({ player, isActive }) {
  return (
    <div className={`seat-card ${isActive ? "active" : ""}`}>
      <div className="seat-row">
        <strong>{player.nickname}</strong>
        <span className={`presence ${player.isOnline ? "online" : "offline"}`}>
          {player.isOnline ? "Online" : "Offline"}
        </span>
      </div>
      <div className="seat-row muted">
        <span>Bid: {player.currentBid ?? "-"}</span>
        <span>Tricks: {player.tricksWon}</span>
        <span>Score: {player.score}</span>
      </div>
    </div>
  );
}
