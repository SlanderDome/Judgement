import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { currentTurnPlayer, seatedPlayers } from "../lib/seats.js";
import { useCountdown } from "../lib/useCountdown.js";

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

  const endsAt = isBidding ? roomState.timer?.endsAt ?? null : null;
  const durationMs = roomState.timer?.durationMs ?? 30000;
  const remainingMs = useCountdown(endsAt);

  // Keyboard: number keys 0–9 submit that bid, exactly like clicking the chip.
  // Bids above 9 (large rounds) must still be clicked. Skips forbidden / out-of-range.
  const bidKbRef = useRef({});
  bidKbRef.current = { roomState, clientPlayerId, onSubmitBid };
  useEffect(() => {
    function handleKey(event) {
      if (event.defaultPrevented || event.repeat || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      const target = event.target;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }
      if (!/^[0-9]$/.test(event.key) || document.querySelector(".overlay")) {
        return;
      }
      const { roomState: rs, clientPlayerId: me, onSubmitBid: submit } = bidKbRef.current;
      if (rs.status !== "BIDDING") {
        return;
      }
      if (currentTurnPlayer(rs)?.playerId !== me) {
        return;
      }
      const bidEndsAt = rs.timer?.endsAt ?? null;
      if (bidEndsAt != null && bidEndsAt - Date.now() <= 0) {
        return; // timer expired — auto-bid is taking over
      }
      const bid = Number(event.key);
      const max = rs.gameConfig.cardsInRound;
      if (bid > max) {
        return;
      }
      const placed = Object.values(rs.currentRound?.bids ?? {});
      const forbidden =
        rs.currentRound?.forbiddenBidForFinalPlayer ??
        (seatedPlayers(rs).length - 1 === placed.length
          ? max - placed.reduce((sum, value) => sum + value, 0)
          : null);
      if (forbidden !== null && bid === forbidden) {
        return;
      }
      event.preventDefault();
      submit(bid);
    }

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  if (!isBidding || !ready) {
    return null;
  }

  const cardsInRound = roomState.gameConfig.cardsInRound;
  const bids = Object.values(roomState.currentRound?.bids ?? {});
  const bidTotal = bids.reduce((sum, bid) => sum + bid, 0);
  const currentPlayer = currentTurnPlayer(roomState);
  const isMyTurn = currentPlayer?.playerId === clientPlayerId;
  const forbiddenBid =
    roomState.currentRound?.forbiddenBidForFinalPlayer ??
    (seatedPlayers(roomState).length - 1 === bids.length ? cardsInRound - bidTotal : null);
  const bidOptions = Array.from({ length: cardsInRound + 1 }, (_value, index) => index);

  const secondsLeft = endsAt ? Math.ceil(remainingMs / 1000) : null;
  const expired = endsAt != null && remainingMs <= 0;
  const urgency = secondsLeft == null ? "" : secondsLeft <= 5 ? "is-urgent" : secondsLeft <= 10 ? "is-warm" : "is-calm";
  const span = durationMs > 0 ? durationMs : 30000;
  const progress = endsAt ? Math.max(0, Math.min(1, remainingMs / span)) : 0;

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
          <h3>
            {isMyTurn
              ? expired
                ? "Time's up — auto-bidding…"
                : "Call your bid"
              : `${currentPlayer?.nickname ?? "Waiting"} is bidding`}
          </h3>
        </div>
        <div className="bidding-head-right">
          {secondsLeft != null && (
            <span
              className={`bid-timer ${urgency}`}
              role="timer"
              aria-label={`${Math.max(0, secondsLeft)} seconds to bid`}
            >
              <span className="bid-timer-count">{Math.max(0, secondsLeft)}</span>
              <span className="bid-timer-unit">sec</span>
              <span className="bid-timer-track" aria-hidden="true">
                <span className="bid-timer-fill" style={{ transform: `scaleX(${progress})` }} />
              </span>
            </span>
          )}
          <span className="chip">
            Table total <strong>{bidTotal}</strong>
          </span>
        </div>
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
              disabled={!isMyTurn || isForbidden || expired}
            >
              {bid}
            </button>
          );
        })}
      </div>
    </motion.section>
  );
}
