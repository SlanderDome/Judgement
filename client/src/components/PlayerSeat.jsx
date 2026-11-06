import { memo } from "react";
import { motion } from "framer-motion";
import { TurnTimerBar } from "./TurnTimerBar.jsx";

function PlayerSeatComponent({
  player,
  isClient = false,
  isTurn = false,
  isDimmed = false,
  isDealer = false,
  isHost = false,
  isRecentlyActed = false,
  timerEndsAt = null,
  timerDurationMs = null
}) {
  const hue = ((player.seatIndex ?? 0) * 137.508) % 360;
  const hasBid = player.currentBid != null;
  const isOffline = !player.isOnline;
  const isPending = player.pendingNextRound || player.isActiveInGame === false;
  const seatStatus = isOffline
    ? "Offline"
    : isPending
      ? "Next round"
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
      aria-label={`${player.nickname}${isClient ? ", you" : ""}${isHost ? ", host" : ""}${isDealer ? ", dealer" : ""}${seatStatus ? `, ${seatStatus}` : ""}${hasBid ? `, bid ${player.currentBid}, ${player.tricksWon ?? 0} tricks won` : ""}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
    >
      <div className="seat-avatar-wrap">
        <span className="seat-avatar" aria-hidden="true">
          {player.nickname.slice(0, 1).toUpperCase()}
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
        <span className="seat-name" title={player.nickname}>{player.nickname}</span>
        {seatStatus ? <span className="seat-status">{seatStatus}</span> : hasBid ? (
          <span
            className="seat-bid-badge"
            title={`Bid: ${player.currentBid}, Tricks won: ${player.tricksWon}`}
          >
            Bid {player.currentBid} · {player.tricksWon ?? 0} won
          </span>
        ) : <span className="seat-status">{isClient ? "You" : isHost ? "Host" : "Seated"}</span>}
      </div>
      {isHost && <span className="seat-host" aria-label="Host">H</span>}
    </motion.div>
  );
}

export const PlayerSeat = memo(PlayerSeatComponent);
