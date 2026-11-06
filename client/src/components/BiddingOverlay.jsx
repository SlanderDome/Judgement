import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { currentTurnPlayer, seatedPlayers } from "../lib/seats.js";
import { useCountdown } from "../lib/useCountdown.js";
import { canConfirmBid, getBidChoices, getForbiddenBid } from "../lib/bidding.js";

export function BiddingOverlay({ roomState, clientPlayerId, onSubmitBid, isConnected = true }) {
  const [selection, setSelection] = useState(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const panelRef = useRef(null);
  const chipsRef = useRef(null);
  const inFlight = useRef(false);
  const attempt = useRef(0);
  const keyboard = useRef(null);
  const reduced = useReducedMotion();
  const actor = currentTurnPlayer(roomState);
  const turnKey = `${roomState.roomId}:${roomState.gameConfig.roundNumber}:${roomState.status}:${actor?.playerId}`;
  const selectedBid = selection?.turnKey === turnKey ? selection.value : null;
  const currentTurnKey = useRef(turnKey);
  currentTurnKey.current = turnKey;
  const isBidder = actor?.playerId === clientPlayerId;
  const paused = roomState.paused === true;
  const remaining = useCountdown(paused ? null : roomState.timer?.endsAt);
  const seconds = Math.max(0, Math.ceil((paused ? roomState.timer?.remainingMs ?? 0 : remaining) / 1000));
  const expired = !paused && roomState.timer?.endsAt != null && roomState.timer.endsAt <= Date.now();
  const choices = getBidChoices(roomState);
  const forbidden = getForbiddenBid(roomState);
  const legal = choices.filter(bid => bid !== forbidden);
  const bids = roomState.currentRound?.bids ?? {};
  const total = Object.values(bids).reduce((sum, bid) => sum + bid, 0);
  const locked = pending || !isConnected || paused || expired;

  useEffect(() => {
    attempt.current += 1; inFlight.current = false;
    setPending(false); setSelection(null); setError("");
    if (chipsRef.current) chipsRef.current.scrollLeft = 0;
    return () => { attempt.current += 1; };
  }, [turnKey, isConnected]);

  function revealChoice(bid, focus = false) {
    const chip = chipsRef.current?.querySelector(`[data-bid="${bid}"]`);
    if (!chip) return;
    if (focus) chip.querySelector("input")?.focus({ preventScroll: true });
    const container = chipsRef.current;
    const bounds = chip.getBoundingClientRect(), viewport = container.getBoundingClientRect();
    if (bounds.left < viewport.left + 5) container.scrollLeft += bounds.left - viewport.left - 5;
    else if (bounds.right > viewport.right - 5) container.scrollLeft += bounds.right - viewport.right + 5;
  }

  function select(bid, focus = false) {
    if (!canConfirmBid(roomState, clientPlayerId, bid, isConnected, inFlight.current)) return;
    setSelection({ turnKey, value: bid }); setError(""); revealChoice(bid, focus);
  }

  async function confirm() {
    if (!canConfirmBid(roomState, clientPlayerId, selectedBid, isConnected, inFlight.current)) return;
    inFlight.current = true; setPending(true); setError("");
    const id = ++attempt.current;
    try {
      const result = await onSubmitBid(selectedBid, {
        expectedRound: roomState.gameConfig.roundNumber,
        expectedStatus: "BIDDING",
        expectedTurnIndex: roomState.gameConfig.currentTurnIndex
      });
      if (attempt.current !== id || currentTurnKey.current !== turnKey) return;
      if (!result?.success) setError(result?.message ?? "Your bid was not confirmed. Please try again.");
    } catch {
      if (attempt.current === id) setError("Unable to confirm this bid. Check your connection and try again.");
    } finally {
      if (attempt.current === id) { inFlight.current = false; setPending(false); }
    }
  }

  keyboard.current = { select, confirm, legal, selectedBid, locked, isBidder, isConnected };
  useEffect(() => {
    function handleKey(event) {
      const current = keyboard.current;
      const target = event.target;
      if (!current?.isBidder || current.locked || !current.isConnected || event.defaultPrevented || event.repeat || event.metaKey || event.ctrlKey || event.altKey ||
          document.querySelector(".overlay") || target?.closest?.(".room-navbar, [inert]") ||
          target?.isContentEditable || ["TEXTAREA", "SELECT"].includes(target?.tagName) ||
          (target?.tagName === "INPUT" && target.type !== "radio")) return;
      if (/^[0-9]$/.test(event.key)) {
        const bid = Number(event.key);
        if (current.legal.includes(bid)) { event.preventDefault(); current.select(bid, true); }
      } else if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
        event.preventDefault();
        const options = current.legal;
        const index = options.indexOf(current.selectedBid);
        const next = event.key === "Home" ? options[0] : event.key === "End" ? options.at(-1)
          : options[index < 0 ? event.key === "ArrowRight" ? 0 : options.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + options.length) % options.length];
        if (next !== undefined) current.select(next, true);
      } else if (event.key === "Enter" && (!target?.closest?.("button") || panelRef.current?.contains(target))) {
        event.preventDefault(); current.confirm();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  if (roomState.status !== "BIDDING") return null;
  return <motion.form
    ref={panelRef}
    className={`bidding-panel room-bidding ${isBidder ? "bidding-panel--action" : "bidding-panel--waiting"}`}
    aria-labelledby="room-bid-heading"
    aria-busy={pending}
    initial={reduced ? false : { opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: .25, ease: "easeOut" }}
    onSubmit={event => { event.preventDefault(); confirm(); }}>
    <div className="room-bid-head"><h3 id="room-bid-heading" title={paused ? "Game paused" : isBidder ? "Make your call." : `${actor?.nickname ?? "Waiting"} is bidding`}><span className="room-bid-heading-full">{paused ? "Game paused" : isBidder ? "Make your call." : `${actor?.nickname ?? "Waiting"} is bidding`}</span><span className="room-bid-heading-short">{paused ? "Paused" : isBidder ? "Your bid" : actor?.nickname ?? "Waiting"}</span></h3><span className={`room-bid-clock ${seconds <= 5 && !paused ? "is-urgent" : ""}`} role="timer" aria-live="off" aria-label={`${paused ? "Paused, " : ""}${seconds} seconds to bid`}>{seconds}s</span></div>
    <p className="room-bid-intro">{roomState.gameConfig.cardsInRound} cards. {isBidder ? "How many tricks?" : "Your hand stays private."} {selectedBid !== null && isBidder && <strong>{selectedBid} {selectedBid === 1 ? "trick" : "tricks"}</strong>}</p>
    {isBidder && <>
      <fieldset className="room-bid-scroll" ref={chipsRef} disabled={locked}>
        <legend className="room-sr-only">Choose your bid</legend>
        {choices.map(bid => <label className={`room-bid-choice ${bid === forbidden ? "is-forbidden" : ""}`} data-bid={bid} key={bid} title={bid === forbidden ? `${bid} is unavailable for the final bidder` : `Choose ${bid} tricks`}>
          <input type="radio" name="room-bid" value={bid} checked={selectedBid === bid} disabled={locked || bid === forbidden} aria-label={`${bid} tricks${bid === forbidden ? ", unavailable" : ""}`} aria-describedby={bid === forbidden ? "room-bid-rule" : undefined} onChange={() => select(bid)} onFocus={() => revealChoice(bid)} />
          <span>{bid}</span>
        </label>)}
      </fieldset>
      <button type="submit" className="btn-primary room-bid-confirm" disabled={locked || selectedBid === null}>{pending ? "Confirming bid…" : selectedBid === null ? "Choose your bid" : `Lock bid: ${selectedBid}`}</button>
    </>}
    <p className="room-bid-rule" id="room-bid-rule"><span className="room-bid-rule-full">{!isConnected ? "Reconnecting. Bids unlock once the table is synchronized." : paused ? "The bidding clock is paused." : expired ? "Time is up. Waiting for the automatic bid." : isBidder && forbidden !== null && choices.includes(forbidden) ? `Last to bid: ${forbidden} is out. Total bids cannot equal ${roomState.gameConfig.cardsInRound}.` : isBidder ? "Choose with arrows or 0-9. Enter locks your bid." : "Waiting for the current player to lock their bid."}</span><span className="room-bid-rule-short">{!isConnected ? "Reconnecting…" : paused ? "Clock paused" : expired ? "Time is up" : !isBidder ? "Waiting for their bid" : forbidden !== null && choices.includes(forbidden) ? `No ${forbidden}. Total ≠ ${roomState.gameConfig.cardsInRound}` : "Scroll to choose"}</span></p>
    {error && <p className="room-bid-error" role="alert">{error}</p>}
    {isBidder && selectedBid !== null && !error && <span className="room-sr-only" role="status">{pending ? `Confirming bid ${selectedBid}` : `${selectedBid} selected. Confirm to lock your bid.`}</span>}
    <div className="room-bid-history" aria-label="Bidding progress"><span>{Object.keys(bids).length}/{seatedPlayers(roomState).length} bids</span><span>Table total <b>{total}</b></span>{isBidder && choices.length > 5 && <span>Swipe for more</span>}</div>
  </motion.form>;
}
