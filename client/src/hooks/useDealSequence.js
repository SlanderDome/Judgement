import { useEffect, useRef, useState } from "react";
import { isRoundActive } from "../lib/seats.js";
import { DEAL_MS } from "../components/TableDeck.jsx";

// Drives the once-per-round dealing animation.
//   "idle"    – no round in progress (lobby / game over)
//   "dealing" – cards are flying out from the dealer (~DEAL_MS)
//   "settled" – deck is resting, hands are up
//
// Only plays when this client witnessed the round begin (fresh PRE_BIDDING
// timer). Reconnecting or joining mid-round snaps straight to "settled", as does
// prefers-reduced-motion.
export function useDealSequence(roomState) {
  const status = roomState.status;
  const round = roomState.gameConfig?.roundNumber ?? 0;
  const timerEndsAt = roomState.timer?.endsAt ?? null;
  const durationMs = roomState.timer?.durationMs ?? 0;

  const [phase, setPhase] = useState("idle");
  const dealtRoundRef = useRef(null);
  const timeoutRef = useRef(null);

  useEffect(() => {
    if (!isRoundActive(status)) {
      dealtRoundRef.current = null;
      window.clearTimeout(timeoutRef.current);
      setPhase("idle");
      return;
    }

    if (dealtRoundRef.current === round) {
      return;
    }
    dealtRoundRef.current = round;

    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    // "Fresh" = we're near the start of the pre-bidding window, so this client
    // witnessed the round begin rather than reconnecting into it. Generous grace
    // (8s) so a slightly late first render still gets the deal; a reconnect
    // mid-round has far less time left than this and correctly snaps to settled.
    const fresh =
      status === "PRE_BIDDING" &&
      timerEndsAt != null &&
      durationMs > 0 &&
      timerEndsAt - Date.now() > durationMs - 8000;

    window.clearTimeout(timeoutRef.current);
    if (fresh && !reduced) {
      setPhase("dealing");
      timeoutRef.current = window.setTimeout(() => setPhase("settled"), DEAL_MS + 250);
    } else {
      setPhase("settled");
    }
  }, [status, round, timerEndsAt, durationMs]);

  useEffect(() => () => window.clearTimeout(timeoutRef.current), []);

  return phase;
}
