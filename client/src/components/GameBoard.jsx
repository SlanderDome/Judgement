import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { AdminRoundControl } from "./AdminRoundControl.jsx";
import { BiddingOverlay } from "./BiddingOverlay.jsx";
import { CircularTable } from "./CircularTable.jsx";
import { ConfirmLeaveModal } from "./ConfirmLeaveModal.jsx";
import { ConnectionBadge } from "./ConnectionBadge.jsx";
import { RoomCodeButton } from "./RoomCodeButton.jsx";
import { PlayingHand } from "./PlayingHand.jsx";
import { TrumpIndicator } from "./TrumpIndicator.jsx";
import { TrickTable } from "./TrickTable.jsx";
import { Seconds } from "./Seconds.jsx";
import { currentTurnPlayer, dealerPlayer, isSeated, seatedPlayers } from "../lib/seats.js";
import { useDealSequence } from "../hooks/useDealSequence.js";

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
  onStartGame,
  onStartBidding,
  onTogglePause,
  onSubmitBid,
  onPlayCard,
  onTakeSeat,
  onNextRound,
  onRematch,
  onLeaveRoom
}) {
  const [adminOpen, setAdminOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dropZoneRef = useRef(null);

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
  const isAdmin = roomState.adminPlayerId === clientPlayerId;
  const status = roomState.status;
  const isLobby = status === "LOBBY";
  const isPreBidding = status === "PRE_BIDDING";
  const isPlaying = status === "TRICK_PLAYING";
  const isTrickComplete = status === "TRICK_COMPLETE";
  const isSummary = status === "ROUND_SUMMARY";
  const isGameOver = status === "GAME_OVER";
  const isPaused = roomState.paused === true;
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
  const phaseLabel = isPaused
    ? "Paused"
    : {
        LOBBY: "Lobby",
        PRE_BIDDING: "Waiting",
        BIDDING: "Bidding",
        TRICK_PLAYING: isMyTurn ? "Your turn" : "Waiting",
        TRICK_COMPLETE: "Trick won",
        ROUND_SUMMARY: "Round complete",
        GAME_OVER: "Game over"
      }[status] ?? status;
  const turnLabel = isPaused
    ? "Game paused"
    : status === "LOBBY"
      ? "Waiting for host"
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

  // Bidding auto-starts after a countdown, so the host has nothing to do during
  // PRE_BIDDING — the panel is only for the lobby and between-round setup.
  const canOpenHostPanel = isAdmin && !isGameOver;
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
      <div className="table-lobby-note table-lobby-note--dealing">Dealing…</div>
    ) : (
      <div className="table-lobby-note">
        <strong>
          <Seconds endsAt={timerEndsAt} />s
        </strong>
        Cards dealt — bidding starts automatically
      </div>
    )
  ) : (
    <TrickTable
      roomState={roomState}
      dropZoneRef={dropZoneRef}
      dropActive={isDragging}
      revealEndsAt={isTrickComplete ? timerEndsAt : null}
    />
  );

  return (
    <div
      className={`game-layout game-layout--${status.toLowerCase().replace(/_/g, "-")} ${
        isDealing ? "game-layout--dealing" : ""
      } ${isPaused ? "game-layout--paused" : ""}`}
    >
      <header className="game-header">
        <div className="game-header-meta">
          <RoomCodeButton roomId={roomState.roomId} />
          {isLobby ? (
            <>
              <span className="gh-dot" aria-hidden="true">·</span>
              <span className="gh-item">
                <strong>
                  {seatedCount}/{seatCap}
                </strong>{" "}
                seated
              </span>
            </>
          ) : (
            <>
              <span className="gh-dot" aria-hidden="true">·</span>
              <span className="gh-item">
                Round <strong>{roomState.gameConfig.roundNumber}</strong>
              </span>
              <span className="gh-dot" aria-hidden="true">·</span>
              <span className="gh-item">
                {roomState.gameConfig.phase === "ASCENDING" ? "Ascending" : "Descending"}{" "}
                <strong>{roomState.gameConfig.cardsInRound}</strong>{" "}
                {roomState.gameConfig.cardsInRound === 1 ? "card" : "cards"}
              </span>
              <span className="gh-dot" aria-hidden="true">·</span>
              <TrumpIndicator roomState={roomState} />
            </>
          )}
        </div>
        <div className="game-header-actions">
          <ConnectionBadge isConnected={isConnected} />
          <span className={`gh-item gh-state gh-state--${phaseLabel.toLowerCase().replace(/\s+/g, "-")}`} aria-label={`Phase ${phaseLabel}, ${turnLabel}`}>
            <strong>{phaseLabel}</strong>
            {turnLabel !== phaseLabel && <span>{turnLabel}</span>}
          </span>
          {isAdmin && isPreBidding && (
            <button type="button" className="btn-primary btn-sm" onClick={onStartBidding}>
              Start bidding now
            </button>
          )}
          <button type="button" className="btn-ghost btn-sm" onClick={() => setLeaveOpen(true)}>
            Main menu
          </button>
          {canOpenHostPanel && (
            <button type="button" className="btn-ghost btn-sm" onClick={() => setAdminOpen(true)}>
              Host controls
            </button>
          )}
        </div>
      </header>

      <div className="table-wrap">
        <CircularTable
          roomState={roomState}
          clientPlayerId={clientPlayerId}
          canSit={isLobby}
          isSeated={clientSeated}
          dealerPlayerId={showDealerId}
          currentTurnPlayerId={activeTurnId}
          recentlyActedPlayerId={!isMyTurn ? recentlyActedPlayerId : null}
          timerEndsAt={status === "BIDDING" ? null : timerEndsAt}
          timerDurationMs={timerDurationMs}
          dealPhase={dealPhase}
          onTakeSeat={onTakeSeat}
          centerSlot={tableCenter}
        />
      </div>

      {clientPlayer && !clientSeated && (
        <div className="spectator-bar">
          {isLobby
            ? "You're watching — tap an open seat to join the game."
            : "You're watching this match. Seats open up when the game returns to the lobby."}
        </div>
      )}

      {clientPlayer && clientSeated && isLobby && (
        <div className="spectator-bar">
          You're seated. Waiting for the host to start the game…
        </div>
      )}

      {clientPlayer && clientSeated && !isLobby && (
        <div
          className={`self-area self-area--${status.toLowerCase().replace(/_/g, "-")} ${
            isDealing ? "is-dealing" : ""
          } ${isDragging ? "is-dragging" : ""}`}
        >
          <BiddingOverlay roomState={roomState} clientPlayerId={clientPlayerId} onSubmitBid={onSubmitBid} />
          <PlayingHand
            key={revealKey}
            cards={hand}
             isMyTurn={isPlaying && isMyTurn && !isPaused}
            legalCardIds={legalCardIds}
            onPlayCard={isPlaying && isMyTurn ? onPlayCard : undefined}
            dropZoneRef={dropZoneRef}
            onDragStateChange={setIsDragging}
            revealDeal={revealKey > 0 && dealPhase === "settled" && isPreBidding}
          />
        </div>
      )}

      {isSummary && (
        <div className="overlay">
          <Scoreboard
            roomState={roomState}
            clientPlayerId={clientPlayerId}
            action={
              <>
                <span className="chip">
                  Next round in{" "}
                  <strong>
                    <Seconds endsAt={timerEndsAt} />s
                  </strong>
                </span>
                {isAdmin && (
                  <button type="button" className="btn-primary" onClick={() => setAdminOpen(true)}>
                    Start now
                  </button>
                )}
              </>
            }
          />
        </div>
      )}

      {isGameOver && (
        <div className="overlay">
          <Scoreboard
            roomState={roomState}
            clientPlayerId={clientPlayerId}
            action={
              <>
                <button type="button" className="btn-ghost" onClick={onLeaveRoom}>
                  Return to main menu
                </button>
                {isAdmin ? (
                  <button type="button" className="btn-primary" onClick={onRematch}>
                    Rematch
                  </button>
                ) : (
                  <span className="chip">Waiting for the host to start a rematch</span>
                )}
              </>
            }
          />
        </div>
      )}

      {adminOpen && (
        <motion.div
          className="overlay overlay--admin"
          role="dialog"
          aria-modal="true"
          aria-label="Host controls"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.16 }}
        >
            <AdminRoundControl
              roomState={roomState}
              onStartGame={onStartGame}
              onStartBidding={onStartBidding}
              onTogglePause={onTogglePause}
            onNextRound={onNextRound}
            onClose={() => setAdminOpen(false)}
          />
        </motion.div>
      )}

      <ConfirmLeaveModal
        open={leaveOpen}
        onCancel={() => setLeaveOpen(false)}
        onConfirm={onLeaveRoom}
      />
    </div>
  );
}
