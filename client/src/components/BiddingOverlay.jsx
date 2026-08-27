export function BiddingOverlay({ roomState, clientPlayerId, onSubmitBid }) {
  if (roomState.status !== "BIDDING") {
    return null;
  }

  const cardsInRound = roomState.gameConfig.cardsInRound;
  const bids = Object.values(roomState.currentRound?.bids ?? {});
  const bidTotal = bids.reduce((sum, bid) => sum + bid, 0);
  const currentPlayer = roomState.players[roomState.gameConfig.currentTurnIndex];
  const isMyTurn = currentPlayer?.playerId === clientPlayerId;
  const forbiddenBid =
    roomState.currentRound?.forbiddenBidForFinalPlayer ??
    (roomState.players.length - 1 === bids.length ? cardsInRound - bidTotal : null);
  const bidOptions = Array.from({ length: cardsInRound + 1 }, (_value, index) => index);

  return (
    <section className="panel bidding-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Bidding</p>
          <h2>Pick a legal bid</h2>
        </div>
        <span>{isMyTurn ? "Your turn" : `${currentPlayer?.nickname ?? "Waiting"} to bid`}</span>
      </div>
      <p className="muted">
        The final bidder cannot pick the forbidden total. Current table total: {bidTotal}.
      </p>
      <div className="bid-grid">
        {bidOptions.map((bid) => {
          const isForbidden = forbiddenBid !== null && bid === forbiddenBid;

          return (
            <button
              key={bid}
              type="button"
              className={`bid-chip ${isForbidden ? "forbidden" : ""}`}
              onClick={() => onSubmitBid(bid)}
              disabled={!isMyTurn || isForbidden}
            >
              {isForbidden ? `${bid} (forbidden)` : bid}
            </button>
          );
        })}
      </div>
    </section>
  );
}
