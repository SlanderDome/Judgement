import { useEffect, useRef, useState } from "react";
import { LayoutGroup, motion } from "framer-motion";
import { AdminRoundControl } from "./AdminRoundControl.jsx";
import { BiddingOverlay } from "./BiddingOverlay.jsx";
import { CircularTable } from "./CircularTable.jsx";
import { ConfirmLeaveModal } from "./ConfirmLeaveModal.jsx";
import { RoomNavbar } from "./RoomNavbar.jsx";
import { RoomAtmosphere } from "./RoomAtmosphere.jsx";
import { RoomCountdown } from "./RoomCountdown.jsx";
import { PlayingHand } from "./PlayingHand.jsx";
import { TrickTable } from "./TrickTable.jsx";
import { Seconds } from "./Seconds.jsx";
import { currentTurnPlayer, dealerPlayer, isSeated, seatedPlayers } from "../lib/seats.js";
import { useDealSequence } from "../hooks/useDealSequence.js";
import { useGameSounds } from "../hooks/useGameSounds.js";
import { useRoomEffects } from "../hooks/useRoomEffects.js";

function Scoreboard({ roomState, clientPlayerId, action }) {
  const scores = roomState.currentRound?.roundSummary?.scores ?? seatedPlayers(roomState);
  const isGameOver = roomState.status === "GAME_OVER";

  return (
    <div className="overlay-card">
      <div className="overlay-head">
        <div>
          <p className="eyebrow">{isGameOver ? "Game over" : `Round ${roomState.gameConfig.roundNumber} complete`}</p>
          <h2>{isGameOver ? "Final scores" : "Scores"}</h2>
        </div>
      </div>

      <div className="score-list">
        {scores.map((entry) => {
          const player = roomState.players.find((p) => p.playerId === entry.playerId) ?? entry;
          const hue = (player.seatIndex ?? 0) * 137.508;
          const isYou = entry.playerId === clientPlayerId;

          return (
            <div key={entry.playerId} className="score-row">
              <span className="mini-avatar" style={{ "--seat-hue": hue }} aria-hidden="true">
                {(entry.nickname ?? "?").slice(0, 2).toUpperCase()}
              </span>
              <span className="score-name">
                {entry.nickname}
                {isYou ? " (you)" : ""}
              </span>
              <span className="score-value">{entry.score}</span>
              {!isGameOver && entry.bid != null && (
                <span className="score-line">
                  Bid {entry.bid} · Tricks {entry.tricksWon}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {action && <div className="overlay-actions">{action}</div>}
    </div>
  );
}

export function GameBoard({
  roomState,
  clientPlayerId,
  isConnected,
  connectionStatus,
  errorMessage,
  onStartGame,
  onStartBidding,
  onTogglePause,
  onSetPaused,
  onSubmitBid,
  onPlayCard,
  onTakeSeat,
  onKickPlayer,
  onAdmitPlayer,
  onNextRound,
  onConfigureNextRound,
  onRematch,
  onLeaveRoom
}) {
  useGameSounds(roomState, clientPlayerId, errorMessage);

  const [adminOpen, setAdminOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [hostPending, setHostPending] = useState(null);
  const [hostError, setHostError] = useState("");
  const hostInFlight = useRef(false);
  const summaryHoldRef = useRef(null);
  const dropZoneRef = useRef(null);
  const adminDialogRef = useRef(null);

  useEffect(() => {
    if (!adminOpen) return undefined;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const panel = adminDialogRef.current;
    panel?.querySelector("button:not(:disabled)")?.focus({ preventScroll: true });
    function handleKey(event) {
      if (event.key === "Escape") { event.preventDefault(); setAdminOpen(false); }
      if (event.key !== "Tab") return;
      const controls = [...(panel?.querySelectorAll("button:not(:disabled), input:not(:disabled), select:not(:disabled), summary, [tabindex='0']") ?? [])].filter(node => node.getClientRects().length);
      if (!controls.length) return;
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !panel.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
      else document.querySelector(".room-host-toggle")?.focus({ preventScroll: true });
    };
  }, [adminOpen]);

  const dealPhase = useDealSequence(roomState);
  const isDealing = dealPhase === "dealing";
  // Bump a key when the deal finishes so the hand re-mounts and "turns over".
  const [revealKey, setRevealKey] = useState(0);
  const prevDealPhaseRef = useRef(dealPhase);
  useEffect(() => {
    if (prevDealPhaseRef.current === "dealing" && dealPhase === "settled") {
      setRevealKey((k) => k + 1);
    }
    prevDealPhaseRef.current = dealPhase;
  }, [dealPhase]);

  const players = roomState.players;
  const clientPlayer = players.find((player) => player.playerId === clientPlayerId);
  const clientSeated = isSeated(clientPlayer);
  const clientActive = clientPlayer?.isActiveInGame !== false;
  const isAdmin = roomState.adminPlayerId === clientPlayerId;
  const status = roomState.status;
  const isLobby = status === "LOBBY";
  const isPreBidding = status === "PRE_BIDDING";
  const isBidding = status === "BIDDING";
  const isPlaying = status === "TRICK_PLAYING";
  const isTrickComplete = status === "TRICK_COMPLETE";
  const isSummary = status === "ROUND_SUMMARY";
  const isGameOver = status === "GAME_OVER";
  const isPaused = roomState.paused === true;
  const connected = isConnected && connectionStatus === "connected";
  const effects = useRoomEffects(roomState, connected, clientPlayerId);
  const turnPlayer = currentTurnPlayer(roomState);
  const turnActive = status === "BIDDING" || isPlaying;
  const isMyTurn = turnActive && turnPlayer?.playerId === clientPlayerId;
  const trickWinnerId = roomState.currentRound?.currentTrick?.winnerPlayerId ?? null;
  const trickWinnerName = players.find((p) => p.playerId === trickWinnerId)?.nickname ?? null;
  const currentTrickCards = roomState.currentRound?.currentTrick?.cardsPlayed ?? [];
  const recentlyActedPlayerId = isTrickComplete
    ? trickWinnerId
    : currentTrickCards[currentTrickCards.length - 1]?.playerId ??
      roomState.currentRound?.lastTrick?.winnerPlayerId ??
      null;
  const turnLabel = isPaused
    ? "Game paused"
    : status === "LOBBY"
      ? "Waiting for players"
      : status === "PRE_BIDDING"
        ? "Get ready"
        : isTrickComplete
          ? trickWinnerName
            ? `${trickWinnerName} wins the trick`
            : "Trick complete"
          : isSummary
            ? "Next round starting soon"
            : !turnActive
              ? "Waiting"
              : isMyTurn
                ? "Your turn"
                : turnPlayer
                  ? `${turnPlayer.nickname} to act`
                  : "Waiting";

  const dealerPlayerId = dealerPlayer(roomState)?.playerId;

  const leadSuit = roomState.currentRound?.currentTrick?.leadSuit;
  const hand = clientPlayer?.hand ?? [];
  const hasLeadSuit = leadSuit ? hand.some((card) => card.suit === leadSuit) : false;
  const legalCardIds = new Set(
    leadSuit && hasLeadSuit ? hand.filter((card) => card.suit === leadSuit).map((card) => card.id) : hand.map((card) => card.id)
  );

  const hostContext = { expectedRound: roomState.gameConfig.roundNumber, expectedStatus: status };
  async function runHostAction(key, action) {
    if (hostInFlight.current || !connected) return;
    hostInFlight.current = true; setHostPending(key); setHostError("");
    try {
      const result = await action();
      if (!result?.success) setHostError(result?.message ?? "The server did not confirm this change.");
      return result;
    } catch {
      setHostError("Unable to confirm this change. Check your connection.");
    } finally {
      hostInFlight.current = false; setHostPending(null);
    }
  }

  // An explicit desired state is idempotent. A stale summary request cannot pause
  // the following round, because its round and phase travel to the server.
  function openHostControls() {
    if (!isAdmin) return;
    if (isSummary && !isPaused) {
      summaryHoldRef.current = `${roomState.roomId}:${roomState.gameConfig.roundNumber}`;
      runHostAction("pause", () => onSetPaused(true, hostContext));
    }
    setAdminOpen(true);
  }
  const previousRoundRef = useRef(roomState.gameConfig.roundNumber);
  useEffect(() => {
    if (previousRoundRef.current !== roomState.gameConfig.roundNumber) {
      setAdminOpen(false); setHostError("");
      previousRoundRef.current = roomState.gameConfig.roundNumber;
    }
  }, [roomState.gameConfig.roundNumber]);
  useEffect(() => {
    const key = `${roomState.roomId}:${roomState.gameConfig.roundNumber}`;
    if (isSummary && adminOpen && !isPaused && !hostPending && summaryHoldRef.current !== key) {
      summaryHoldRef.current = key;
      runHostAction("pause", () => onSetPaused(true, hostContext));
    }
  }, [status, adminOpen, isPaused, hostPending]);
  const timerEndsAt = roomState.timer?.endsAt ?? null;
  const timerDurationMs = roomState.timer?.durationMs ?? null;
  const seatedCount = seatedPlayers(roomState).length;
  const seatCap = roomState.seatCount ?? 8;
  // "Whose turn" and the dealer button only make sense once a hand is underway.
  const activeTurnId = status === "BIDDING" || isPlaying ? turnPlayer?.playerId ?? null : null;
  const showDealerId = isLobby ? null : dealerPlayerId;

  const tableCenter = isLobby ? (
    <div className="table-lobby-note">
      {seatedCount < 2 ? (
        <>
          <span className="table-lobby-note__title">Waiting for players</span>
          <strong>{seatedCount}/{seatCap} seated</strong>
          <span>Take a seat to join the table</span>
        </>
      ) : (
        <>
          <strong>{seatedCount}/{seatCap}</strong>
          Ready when the host starts
        </>
      )}
    </div>
  ) : isPreBidding ? (
    isDealing ? (
      <div className="table-lobby-note table-lobby-note--dealing">Dealing</div>
    ) : (
      <div className="table-lobby-note">
        <strong>
          {isPaused ? "Paused" : <><Seconds endsAt={timerEndsAt} />s</>}
        </strong>
        {isPaused ? "Resume the game to continue" : "Cards dealt. Bidding starts automatically"}
      </div>
    )
  ) : isBidding ? (
    <div className="table-center-bidding">
      <BiddingOverlay roomState={roomState} clientPlayerId={clientPlayerId} onSubmitBid={onSubmitBid} isConnected={connected} />
    </div>
  ) : (
    <TrickTable
      roomState={roomState}
      dropActive={isDragging}
      revealEndsAt={isTrickComplete ? timerEndsAt : null}
      aceEffect={effects.ace}
      clientPlayerId={clientPlayerId}
    />
  );

  return (
    <LayoutGroup id={`${roomState.roomId}:${roomState.gameConfig.roundNumber}`}>
    <div
      className={`game-layout room-concept game-layout--${status.toLowerCase().replace(/_/g, "-")} ${
        isDealing ? "game-layout--dealing" : ""
      } ${isPaused ? "game-layout--paused" : ""}`}
    >
      <RoomAtmosphere />
      <RoomNavbar
        roomState={roomState}
        clientPlayerId={clientPlayerId}
        isConnected={connected}
        connectionStatus={connectionStatus}
        errorMessage={errorMessage}
        adminOpen={adminOpen}
        hostBusy={!!hostPending}
        onToggleHost={() => adminOpen ? setAdminOpen(false) : openHostControls()}
        onStartBidding={onStartBidding}
        onSetPaused={onSetPaused}
        onExit={() => setLeaveOpen(true)}
      />
      <section className="room-statusbar" aria-label="Game status" inert={adminOpen ? "" : undefined}>
        <h1 className="room-sr-only">Judgement table {roomState.roomId}</h1>
        <p aria-live="polite">{turnLabel}</p>
        {!connected && <p className="room-connection-notice" role="status">Reconnecting. Actions resume when the table is connected.</p>}
      </section>
      {(isSummary || isGameOver) && <section className="room-round-summary" aria-label={isGameOver ? "Final results" : "Round results"} inert={adminOpen ? "" : undefined}>
        <Scoreboard roomState={roomState} clientPlayerId={clientPlayerId} action={<>
          {isSummary ? <>
            <span className="room-summary-timer">{isPaused ? "Next round paused at" : "Next round in"} <RoomCountdown timer={roomState.timer} paused={isPaused} /></span>
            {isAdmin && <>
              <button type="button" className="btn-ghost" disabled={!!hostPending || !connected} onClick={() => runHostAction("pause", () => onSetPaused(!isPaused, hostContext))}>{hostPending === "pause" ? "Confirming…" : isPaused ? "Resume countdown" : "Pause next round"}</button>
              <button type="button" className="btn-primary" disabled={!!hostPending || !connected} onClick={openHostControls}>Manage players</button>
              <button type="button" className="btn-ghost" disabled={!!hostPending || !connected || (roomState.nextRoundSetup?.cardsInRound !== null && ((roomState.nextRoundSetup?.playerCount ?? 0) < 2 || !!roomState.nextRoundSetup?.configurationError))} onClick={() => runHostAction("next", () => onNextRound(roomState.nextRoundSetup?.cardsInRound === null ? { ...hostContext, action: "end_game" } : hostContext))}>{hostPending === "next" ? "Starting…" : roomState.nextRoundSetup?.cardsInRound === null ? "Finish match now" : "Start next round now"}</button>
            </>}
          </> : isAdmin ? <button type="button" className="btn-primary" disabled={!!hostPending || !connected} onClick={() => runHostAction("rematch", onRematch)}>{hostPending === "rematch" ? "Resetting…" : "Rematch"}</button> : <span className="chip">Waiting for the host to start a rematch</span>}
          {hostError && <p className="host-error" role="alert">{hostError}</p>}
        </>} />
      </section>}
      <div className="room-table-frame" inert={adminOpen ? "" : undefined}>
      <div className="room-table-spacer" aria-hidden="true" />
      <div className="room-table-stage">
      <div className="table-wrap">
        <CircularTable
          roomState={roomState}
          clientPlayerId={clientPlayerId}
          canSit={isLobby && connected}
          isSeated={clientSeated}
          dealerPlayerId={showDealerId}
          currentTurnPlayerId={isPaused ? null : activeTurnId}
          recentlyActedPlayerId={!isMyTurn ? recentlyActedPlayerId : null}
          timerEndsAt={isPaused || status === "BIDDING" ? null : timerEndsAt}
          timerDurationMs={timerDurationMs}
          dealPhase={dealPhase}
          onTakeSeat={onTakeSeat}
          centerSlot={tableCenter}
          dropZoneRef={isPlaying ? dropZoneRef : undefined}
          aceEffect={effects.ace}
          bidEffect={effects.bid}
        />
      </div>

      {clientPlayer && (!clientSeated || !clientActive) && (
        <div className="spectator-bar">
          {!clientSeated
            ? isLobby
              ? "You're watching. Tap an open seat to join the game."
              : "You're watching this match. The host can admit you for the next round."
            : !clientActive
              ? "You're seated. Your cards join next round."
              : null}
        </div>
      )}

      {clientPlayer && clientSeated && isLobby && (
        <div className="spectator-bar">
          You're seated. Waiting for the host to start the game.
        </div>
      )}

      {clientPlayer && clientSeated && clientActive && !isLobby && (
        <div
          className={`self-area self-area--${status.toLowerCase().replace(/_/g, "-")} ${
            isDealing ? "is-dealing" : ""
          } ${isDragging ? "is-dragging" : ""}`}
        >
          <PlayingHand
            key={revealKey}
            cards={hand}
            playKey={`${roomState.roomId}:${roomState.gameConfig.roundNumber}:${roomState.currentRound?.tricksHistory?.length ?? 0}`}
            playContext={{ expectedRound: roomState.gameConfig.roundNumber, expectedStatus: "TRICK_PLAYING", expectedTurnIndex: roomState.gameConfig.currentTurnIndex, expectedTrickIndex: roomState.currentRound?.tricksHistory?.length ?? 0 }}
            isMyTurn={isPlaying && isMyTurn && !isPaused && connected}
            legalCardIds={legalCardIds}
            onPlayCard={isPlaying && isMyTurn && !isPaused && connected ? onPlayCard : undefined}
            dropZoneRef={dropZoneRef}
            onDragStateChange={setIsDragging}
            revealDeal={revealKey > 0 && dealPhase === "settled" && isPreBidding}
          />
        </div>
      )}
      </div>
      <div className="room-table-spacer" aria-hidden="true" />
      </div>

      <p className="room-sr-only" role="status">{effects.ace ? `${effects.ace.name} played an ace${effects.ace.kind === "trump" ? " of the trump suit" : ""}.` : effects.bid ? `Bid ${effects.bid.value} locked.` : ""}</p>

      {adminOpen && (
        <motion.div
          className="overlay overlay--admin"
          role="dialog"
          aria-modal="true"
          aria-labelledby="room-host-title"
          id="room-host-dialog"
          ref={adminDialogRef}
          onMouseDown={(event) => { if (event.target === event.currentTarget) setAdminOpen(false); }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.16 }}
        >
            <AdminRoundControl
              roomState={roomState}
              isConnected={connected}
              busy={!!hostPending}
              externalError={hostError}
              onStartGame={onStartGame}
              onSetPaused={onSetPaused}
              onKickPlayer={onKickPlayer}
              onAdmitPlayer={onAdmitPlayer}
              onNextRound={onNextRound}
              onConfigureNextRound={onConfigureNextRound}
              onRematch={onRematch}
              onClose={() => setAdminOpen(false)}
            />
        </motion.div>
      )}

      <ConfirmLeaveModal
        open={leaveOpen}
        isConnected={isConnected}
        onCancel={() => setLeaveOpen(false)}
        onConfirm={onLeaveRoom}
      />
    </div>
    </LayoutGroup>
  );
}
