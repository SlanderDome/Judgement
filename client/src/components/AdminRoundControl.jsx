import { useEffect, useRef, useState } from "react";
import { RoomCountdown } from "./RoomCountdown.jsx";

const SUITS = [
  ["SPADES", "♠ Spades"], ["DIAMONDS", "♦ Diamonds"], ["CLUBS", "♣ Clubs"], ["HEARTS", "♥ Hearts"]
];

export function AdminRoundControl({ roomState, isConnected, busy = false, externalError = "", onStartGame, onSetPaused, onKickPlayer, onAdmitPlayer, onNextRound, onConfigureNextRound, onRematch, onClose }) {
  const { status, players, gameConfig } = roomState;
  const lobby = status === "LOBBY";
  const summary = status === "ROUND_SUMMARY";
  const gameOver = status === "GAME_OVER";
  const paused = roomState.paused === true;
  const context = { expectedRound: gameConfig.roundNumber, expectedStatus: status };
  const occupied = players.filter(player => Number.isInteger(player.seatIndex));
  const seated = occupied.filter(player => !player.pendingNextRound);
  const approved = occupied.filter(player => player.pendingNextRound);
  const waiting = players.filter(player => !Number.isInteger(player.seatIndex));
  const maxCards = roomState.nextRoundSetup?.maxCards ?? Math.max(1, Math.floor(52 / Math.max(1, occupied.length)));
  const nextCount = roomState.nextRoundSetup?.playerCount ?? occupied.length;
  const defaultCards = lobby ? 1 : roomState.nextRoundSetup?.cardsInRound ?? 1;
  const defaultSuit = lobby ? "SPADES" : roomState.nextRoundSetup?.trumpSuit ?? "SPADES";
  const [cards, setCards] = useState(defaultCards);
  const [suit, setSuit] = useState(defaultSuit);
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const inFlight = useRef(false);
  const mounted = useRef(false);
  const closeRef = useRef(null);
  const confirmCancelRef = useRef(null);
  const errorRef = useRef(null);

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    setCards(defaultCards); setSuit(defaultSuit); setDirty(false);
    setConfirmId(null); setError(""); setNotice("");
  }, [roomState.roomId, gameConfig.roundNumber, status]);
  useEffect(() => { if (confirmId) confirmCancelRef.current?.focus({ preventScroll: true }); }, [confirmId]);
  useEffect(() => { if (error) errorRef.current?.focus({ preventScroll: true }); }, [error]);
  useEffect(() => { if (confirmId && !players.some(player => player.playerId === confirmId)) setConfirmId(null); }, [players, confirmId]);

  const locked = !!pending || busy || !isConnected;
  const canRemove = lobby || summary;
  const canAdmit = !lobby && !gameOver;
  const full = occupied.length >= (roomState.seatCount ?? 8);
  const invalidCards = !Number.isInteger(Number(cards)) || Number(cards) < 1 || Number(cards) > maxCards;
  const finishMatch = summary && !dirty && roomState.nextRoundSetup?.cardsInRound === null;
  const setupError = dirty ? (invalidCards ? `Choose a whole number from 1 to ${maxCards}.` : null) : roomState.nextRoundSetup?.configurationError;
  const canStart = nextCount >= 2 && !invalidCards && !setupError;

  async function run(key, action, successMessage = "", close = false) {
    if (inFlight.current || locked) return;
    inFlight.current = true; setPending(key); setError(""); setNotice("");
    try {
      const result = await action();
      if (!mounted.current) return;
      if (!result?.success) { setError(result?.message ?? "The server did not confirm this change."); return; }
      setConfirmId(null); setNotice(successMessage);
      if (key === "save" || key === "resume") setDirty(false);
      if (close) onClose?.();
      else if (key.startsWith("remove:") || key.startsWith("admit:")) closeRef.current?.focus({ preventScroll: true });
    } catch {
      if (mounted.current) setError("Unable to confirm this change. Check your connection and try again.");
    } finally {
      inFlight.current = false;
      if (mounted.current) setPending(null);
    }
  }

  const roundOptions = () => ({ ...context, cardsInRound: Number(cards), trumpSuit: suit });
  async function resume() {
    if (summary && dirty) {
      const result = await onConfigureNextRound(roundOptions());
      if (!result.success) return result;
    }
    return onSetPaused(false, context);
  }

  function renderPlayer(player, group) {
    const host = player.playerId === roomState.adminPlayerId;
    const detail = group === "approved" ? `Seat ${player.seatIndex + 1} reserved / ${player.isOnline ? "Connected" : "Offline"}. Joins at the next deal.`
      : `${Number.isInteger(player.seatIndex) ? `Seat ${player.seatIndex + 1} / ` : ""}${player.isOnline ? "Connected" : "Offline"}${host ? " / Host" : ""}`;
    return <div className="host-player" key={player.playerId} data-player-id={player.playerId}>
      <div className="host-player__row">
        <div className="host-player__identity"><strong title={player.nickname}>{player.nickname}{host ? " (host)" : ""}</strong><small>{detail}</small></div>
        {group === "waiting" && <button type="button" className="btn-ghost" disabled={locked || !canAdmit || full || !player.isOnline} onClick={() => run(`admit:${player.playerId}`, () => onAdmitPlayer(player.playerId, context), `${player.nickname} is approved for the next round.`)} aria-label={`Admit ${player.nickname} next round`}>{pending === `admit:${player.playerId}` ? "Admitting…" : "Admit next round"}</button>}
        {!host && <button type="button" className="btn-danger" disabled={locked || !canRemove} title={canRemove ? `Remove ${player.nickname}` : "Players can only be removed between rounds"} onClick={() => setConfirmId(player.playerId)} aria-label={`Remove ${player.nickname}`}>Remove</button>}
      </div>
      {group === "waiting" && !player.isOnline && <p className="host-hint">This player must reconnect before admission.</p>}
      {confirmId === player.playerId && <div className="host-confirm" role="group" aria-label={`Confirm removal of ${player.nickname}`}>
        <p>Remove <strong>{player.nickname}</strong> from the room? Their seat will become available.</p>
        <div><button type="button" className="btn-ghost" ref={confirmCancelRef} disabled={locked} onClick={() => setConfirmId(null)}>Cancel</button><button type="button" className="btn-danger" disabled={locked || !canRemove} onClick={() => run(`remove:${player.playerId}`, () => onKickPlayer(player.playerId, context), `${player.nickname} was removed.`)}>{pending === `remove:${player.playerId}` ? "Removing…" : `Confirm remove ${player.nickname}`}</button></div>
      </div>}
    </div>;
  }

  return <div className="overlay-card admin-card host-management" aria-busy={!!pending || busy}>
    <div className="host-management__head"><h2 id="room-host-title">Host controls</h2><button type="button" className="btn-ghost" ref={closeRef} onClick={onClose} aria-label="Close host controls">×</button></div>
    <p className="host-description">Keep the table moving. New arrivals join at the next deal.</p>
    <div className="host-phase">
      <strong role="status">{lobby ? "Waiting to start" : gameOver ? "Match complete" : summary ? paused ? "Next round paused" : "Next round starts in" : paused ? "Game paused" : status === "PRE_BIDDING" ? "Bidding begins in" : status === "BIDDING" ? "Bidding in progress" : status === "TRICK_COMPLETE" ? "Trick complete" : "Round in progress"}</strong>
      {!lobby && !gameOver && <RoomCountdown timer={roomState.timer} paused={paused} />}
    </div>
    {(externalError || error) && <p className="host-error" role="alert" ref={errorRef} tabIndex={-1}>{error || externalError}</p>}
    {!isConnected && <p className="host-error" role="status">Reconnecting. Host actions are unavailable until the table is synchronized.</p>}
    {notice && <p className="host-notice" role="status">{notice}</p>}
    {busy && <p className="host-notice" role="status">Confirming the pause with the server…</p>}
    <div className="host-phase-actions">
      {!lobby && !gameOver && <button type="button" className="btn-ghost" disabled={locked || (paused && summary && (!canStart || !!setupError))} aria-pressed={paused} onClick={() => run(paused ? "resume" : "pause", paused ? resume : () => onSetPaused(true, context), paused ? "Countdown resumed." : "Paused. Closing this panel will not resume the game.")}>{pending === "pause" || pending === "resume" ? "Confirming…" : summary ? paused ? "Resume countdown" : "Pause next round" : paused ? "Resume game" : "Pause game"}</button>}
      {summary && <button type="button" className="btn-primary" disabled={locked || (!finishMatch && !canStart)} onClick={() => run("next", () => onNextRound(finishMatch ? { ...context, action: "end_game" } : dirty ? roundOptions() : context), "", true)}>{pending === "next" ? "Starting…" : finishMatch ? "Finish match now" : "Start next round now"}</button>}
      {gameOver && <button type="button" className="btn-primary" disabled={locked} onClick={() => run("rematch", onRematch, "", true)}>{pending === "rematch" ? "Resetting…" : "Rematch"}</button>}
    </div>
    {summary && <p className="host-hint">{paused ? "The remaining time is frozen. Close the panel without resuming to keep managing later." : "The countdown is running. Pause it before editing the next round."}</p>}
    {!canRemove && !gameOver && <p className="host-hint">Player removal unlocks after the round ends. Admissions reserve a seat for the next deal.</p>}
    {summary && nextCount < 2 && <p className="host-error">Admit another player before starting or resuming. At least two players are required.</p>}
    <section className="host-roster" aria-labelledby="host-table-heading"><h3 id="host-table-heading">At the table <span>{seated.length}/{roomState.seatCount ?? 8}</span></h3>{seated.map(player => renderPlayer(player, "seated"))}{!seated.length && <p className="host-hint">No players are seated yet.</p>}</section>
    <section className="host-roster" aria-labelledby="host-waiting-heading"><h3 id="host-waiting-heading">Waiting to join <span>{waiting.length}</span></h3>
      {lobby && <p className="host-hint">Players can choose their own seats before the match starts.</p>}
      {gameOver && <p className="host-hint">Start a rematch to open the seats again.</p>}
      {full && waiting.length > 0 && <p className="host-hint">All eight seats are occupied or reserved. Free a seat between rounds first.</p>}
      {waiting.map(player => renderPlayer(player, "waiting"))}{!waiting.length && <p className="host-hint">Nobody is waiting.</p>}
    </section>
    <section className="host-roster" aria-labelledby="host-approved-heading"><h3 id="host-approved-heading">Joining next round <span>{approved.length}</span></h3>{approved.map(player => renderPlayer(player, "approved"))}{!approved.length && <p className="host-hint">No seats are reserved for the next round.</p>}</section>
    {(lobby || summary) && <details className="host-setup" open={lobby ? true : undefined}>
      <summary>{lobby ? "First-round setup" : "Next-round setup"}</summary>
      {summary && !paused && <p className="host-hint">Pause the countdown to edit this setup.</p>}
      <div className="host-setup__fields"><label>Cards per player<input type="number" min="1" max={maxCards} value={cards} disabled={locked || (summary && !paused)} aria-describedby="host-card-limit" aria-invalid={dirty && invalidCards} onChange={event => { setCards(event.target.value); setDirty(true); }} /></label><label>Trump suit<select aria-label="Trump suit" value={suit} disabled={locked || (summary && !paused)} onChange={event => { setSuit(event.target.value); setDirty(true); }}>{SUITS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label></div>
      <p className="host-hint" id="host-card-limit">{nextCount} players for the next deal. Up to {maxCards} cards each.</p>
      {setupError && <p className="host-error" role="alert">{setupError}</p>}
      {summary && <button type="button" className="btn-ghost" disabled={locked || !paused || !dirty || invalidCards} onClick={() => run("save", () => onConfigureNextRound(roundOptions()), "Next-round setup saved. It will be used when the countdown finishes.")}>{pending === "save" ? "Saving…" : "Save next-round setup"}</button>}
      {lobby && <button type="button" className="btn-primary" disabled={locked || !canStart || invalidCards} onClick={() => run("start", () => onStartGame(roundOptions()), "", true)}>{pending === "start" ? "Starting…" : "Start game"}</button>}
    </details>}
    {summary && <button type="button" className="btn-danger host-end-match" disabled={locked} onClick={() => run("end", () => onNextRound({ ...context, action: "end_game" }), "", true)}>End game</button>}
  </div>;
}
