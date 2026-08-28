import { motion } from "framer-motion";

export function PlayerSeat({ player, isClient = false, isTurn = false, isDimmed = false, showScore = false, position = 0, isDealer = false }) {
  const hue = (player.seatIndex * 137.508) % 360;
  const cardCount = player.handCount ?? player.hand?.length ?? 0;

  return (
    <motion.div
      className={[
        "seat",
        isClient ? "seat--self" : "",
        isTurn ? "seat--turn" : "",
        isDimmed ? "seat--dim" : ""
      ].join(" ")}
      style={{ "--seat-hue": hue }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 320, damping: 28 }}
      layout
    >
      <span className="seat-avatar" aria-hidden="true">
        {player.nickname.slice(0, 2).toUpperCase()}
      </span>
      <span className="seat-name">{player.nickname}</span>
      <span className="seat-meta">
        {isDealer && <span className="bid-tag">Dealer</span>}
        {player.currentBid != null && <span className="bid-tag">Bid {player.currentBid}</span>}
        <span>{cardCount} cards</span>
        {showScore && <span>Score {player.score}</span>}
      </span>
      <span className="seat-order" aria-hidden="true">{position}</span>
      {isClient && <span className="seat-badge">You</span>}
      <span
        className={`presence-dot seat-presence ${player.isOnline ? "online" : "offline"}`}
        aria-label={player.isOnline ? "Online" : "Offline"}
        title={player.isOnline ? "Online" : "Offline"}
      />
    </motion.div>
  );
}
