import { motion } from "framer-motion";
import { useEffect, useState } from "react";

export function BiddingOverlay({ roomState, clientPlayerId, onSubmitBid }) {
  const [ready, setReady] = useState(false);
  const isBidding = roomState.status === "BIDDING";

  useEffect(() => {
    if (!isBidding) {
      setReady(false);
      return undefined;
    }

    const timerId = window.setTimeout(() => setReady(true), 400);
    return () => window.clearTimeout(timerId);
  }, [isBidding]);

  if (!isBidding || !ready) {
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
    <motion.section
      className="bidding-panel"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 320, damping: 30 }}
      aria-live="polite"
    >
      <div className="bidding-head">
        <div>
          <p className="eyebrow">Bidding</p>
          <h3>{isMyTurn ? "Call your bid" : `${currentPlayer?.nickname ?? "Waiting"} is bidding`}</h3>
        </div>
        <span className="chip">
          Table total <strong>{bidTotal}</strong>
        </span>
      </div>

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
              {bid}
            </button>
          );
        })}
      </div>
    </motion.section>
  );
}
