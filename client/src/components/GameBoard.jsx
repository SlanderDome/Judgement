import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { AdminRoundControl } from "./AdminRoundControl.jsx";
import { BiddingOverlay } from "./BiddingOverlay.jsx";
import { CircularTable } from "./CircularTable.jsx";
import { ConfirmLeaveModal } from "./ConfirmLeaveModal.jsx";
import { ConnectionBadge } from "./ConnectionBadge.jsx";
import { PlayingHand } from "./PlayingHand.jsx";
import { TrumpIndicator } from "./TrumpIndicator.jsx";
import { TrickTable } from "./TrickTable.jsx";
import { currentTurnPlayer, dealerPlayer, isSeated, seatedPlayers } from "../lib/seats.js";

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
  onSubmitBid,
  onPlayCard,
  onStartBidding,
  onTakeSeat,
  onNextRound,
  onRematch,
  onLeaveRoom
}) {
  const [adminOpen, setAdminOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dropZoneRef = useRef(null);

  const players = roomState.players;
  const clientPlayer = players.find((player) => player.playerId === clientPlayerId);
  const clientSeated = isSeated(clientPlayer);
  const isAdmin = roomState.adminPlayerId === clientPlayerId;
  const status = roomState.status;
  const isLobby = status === "LOBBY";
  const isPreBidding = status === "PRE_BIDDING";
  const isPlaying = status === "TRICK_PLAYING";
  const isSummary = status === "ROUND_SUMMARY";
  const isGameOver = status === "GAME_OVER";
  const turnPlayer = currentTurnPlayer(roomState);
  const isMyTurn = turnPlayer?.playerId === clientPlayerId;
  const currentTrickCards = roomState.currentRound?.currentTrick?.cardsPlayed ?? [];
  const recentlyActedPlayerId =
    currentTrickCards[currentTrickCards.length - 1]?.playerId ?? roomState.currentRound?.lastTrick?.winnerPlayerId ?? null;
  const phaseLabel =
    {
      LOBBY: "Lobby",
      PRE_BIDDING: "Waiting",
      BIDDING: "Bidding",
      TRICK_PLAYING: isMyTurn ? "Your turn" : "Waiting",
      ROUND_SUMMARY: "Round complete",
      GAME_OVER: "Round complete"
    }[status] ?? status;
  const turnActive = status === "BIDDING" || isPlaying;
  const turnLabel =
    status === "LOBBY"
      ? "Waiting for host"
      : status === "PRE_BIDDING"
        ? "Get ready"
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

  const canOpenHostPanel = isAdmin && (isLobby || isPreBidding || isSummary);
  const timerEndsAt = roomState.timer?.endsAt ?? null;
  const timerDurationMs = roomState.timer?.durationMs ?? null;
  const seatedCount = seatedPlayers(roomState).length;
  const seatCap = roomState.seatCount ?? 10;
  // "Whose turn" and the dealer button only make sense once a hand is underway.
  const activeTurnId = status === "BIDDING" || isPlaying ? turnPlayer?.playerId ?? null : null;
  const showDealerId = isLobby ? null : dealerPlayerId;

  const tableCenter = isLobby ? (
    <div className="table-lobby-note">
      <strong>
        {seatedCount}/{seatCap}
      </strong>
      {seatedCount < 2 ? "Waiting for players to sit down" : "Ready when the host starts"}
    </div>
  ) : (
    <TrickTable roomState={roomState} dropZoneRef={dropZoneRef} dropActive={isDragging} />
  );

  return (
    <div className={`game-layout game-layout--${status.toLowerCase().replace(/_/g, "-")}`}>
      <header className="game-header">
        <div className="game-header-meta">
          <span className="gh-item gh-room">
            Room <strong className="room-code">{roomState.roomId}</strong>
          </span>
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
            <span>{turnLabel}</span>
          </span>
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
          timerEndsAt={timerEndsAt}
          timerDurationMs={timerDurationMs}
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
        <div className="self-area">
          <BiddingOverlay roomState={roomState} clientPlayerId={clientPlayerId} onSubmitBid={onSubmitBid} />
          <PlayingHand
            cards={hand}
            isMyTurn={isPlaying && isMyTurn}
            legalCardIds={legalCardIds}
            onPlayCard={isPlaying && isMyTurn ? onPlayCard : undefined}
            dropZoneRef={dropZoneRef}
            onDragStateChange={setIsDragging}
          />
        </div>
      )}

      {isSummary && (
        <div className="overlay">
          <Scoreboard
            roomState={roomState}
            clientPlayerId={clientPlayerId}
            action={
              isAdmin ? (
                <button type="button" className="btn-primary" onClick={() => setAdminOpen(true)}>
                  Start next round
                </button>
              ) : (
                <span className="chip">Waiting for the host to start the next round</span>
              )
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
        <motion.div className="overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.16 }}>
          <AdminRoundControl
            roomState={roomState}
            onStartGame={onStartGame}
            onStartBidding={onStartBidding}
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
