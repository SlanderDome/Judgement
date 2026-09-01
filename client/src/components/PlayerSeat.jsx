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
  const hasBid = player.currentBid != null;
  const isOffline = !player.isOnline;
  const seatStatus = isOffline
    ? "Offline"
    : isTurn && !isClient
      ? "Acting"
      : null;

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
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
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
        <span className="seat-name">{player.nickname}</span>
        {isClient && <span className="seat-you">You</span>}
        {seatStatus && <span className="seat-status">{seatStatus}</span>}
        {!isOffline && hasBid && (
          <span
            className="seat-bid-badge"
            title={`Bid: ${player.currentBid}, Tricks won: ${player.tricksWon}`}
          >
            Bid {player.currentBid} · {player.tricksWon} won
          </span>
        )}
      </div>
    </motion.div>
  );
}

export const PlayerSeat = memo(PlayerSeatComponent);
