import { memo } from "react";
import { motion } from "framer-motion";
import { TurnTimerBar } from "./TurnTimerBar.jsx";

function PlayerSeatComponent({
  player,
  isClient = false,
  isTurn = false,
  isDimmed = false,
  isDealer = false,
  isRecentlyActed = false,
  timerEndsAt = null,
  timerDurationMs = null
}) {
  const hue = ((player.seatIndex ?? 0) * 137.508) % 360;
  const cardCount = player.handCount ?? player.hand?.length ?? 0;
  const hasBid = player.currentBid != null;
  const isOffline = !player.isOnline;
  const seatStatus = isOffline
    ? "Offline"
    : isTurn
      ? isClient
        ? "Your turn"
        : "Acting"
      : isRecentlyActed
        ? "Just acted"
        : isDealer
          ? "Dealer"
          : "Waiting";

  return (
    <motion.div
      className={[
        "seat",
        isClient ? "seat--self" : "",
        isTurn ? "seat--active" : "",
        isRecentlyActed ? "seat--recent" : "",
        isOffline ? "seat--offline" : isDimmed ? "seat--dim" : "",
        isDealer ? "seat--dealer-state" : ""
      ].join(" ")}
      style={{ "--seat-hue": hue, zIndex: isTurn ? 7 : undefined }}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0, scale: isTurn ? 1.14 : 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 22 }}
    >
      <div className="seat-avatar-wrap">
        <span className="seat-avatar" aria-hidden="true">
          {player.nickname.slice(0, 2).toUpperCase()}
        </span>
        {isDealer && (
          <span className="seat-dealer" aria-label="Dealer">
            D
          </span>
        )}
        {isTurn && timerEndsAt && (
          <TurnTimerBar endsAt={timerEndsAt} durationMs={timerDurationMs ?? undefined} />
        )}
      </div>
      <div className="seat-info">
        <span className="seat-name">
          {player.nickname}
          {isClient && <em className="seat-you">you</em>}
        </span>
        <span className="seat-status">{seatStatus}</span>
        {hasBid ? (
          <span
            className="seat-bid-badge"
            title={`Bid: ${player.currentBid}, Tricks won: ${player.tricksWon}`}
          >
            Bid {player.currentBid} · {player.tricksWon} won
          </span>
        ) : (
          !isClient && (
            <span className="seat-cards">
              {cardCount} {cardCount === 1 ? "card" : "cards"}
            </span>
          )
        )}
      </div>
    </motion.div>
  );
}

export const PlayerSeat = memo(PlayerSeatComponent);
