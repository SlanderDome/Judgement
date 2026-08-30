import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { AdminRoundControl } from "./AdminRoundControl.jsx";
import { BiddingOverlay } from "./BiddingOverlay.jsx";
import { ConnectionBadge } from "./ConnectionBadge.jsx";
import { PlayerSeat } from "./PlayerSeat.jsx";
import { PlayingHand } from "./PlayingHand.jsx";
import { TrumpIndicator } from "./TrumpIndicator.jsx";
import { TrickTable } from "./TrickTable.jsx";

const SEAT_SLOTS = {
  1: ["top"],
  2: ["left", "right"],
  3: ["left", "top", "right"],
  4: ["left", "top-left", "top-right", "right"],
  5: ["left", "top-left", "top", "top-right", "right"]
};

function slotForOpponent(index, count) {
  const slots = SEAT_SLOTS[count] ?? ["top"];
  return slots[index % slots.length];
}

function Scoreboard({ roomState, clientPlayerId, action }) {
  const scores = roomState.currentRound?.roundSummary?.scores ?? roomState.players;
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
  onReorderPlayers,
  onNextRound,
  onRematch,
  onLeaveRoom
}) {
  const [adminOpen, setAdminOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dropZoneRef = useRef(null);

  const players = roomState.players;
  const clientPlayer = players.find((player) => player.playerId === clientPlayerId);
  const isAdmin = roomState.adminPlayerId === clientPlayerId;
  const status = roomState.status;
  const isLobby = status === "LOBBY";
  const isPreBidding = status === "PRE_BIDDING";
  const isPlaying = status === "TRICK_PLAYING";
  const isSummary = status === "ROUND_SUMMARY";
  const isGameOver = status === "GAME_OVER";
  const isMyTurn = players[roomState.gameConfig.currentTurnIndex]?.playerId === clientPlayerId;
  const currentTurnPlayer = players[roomState.gameConfig.currentTurnIndex] ?? null;
  const currentTrickCards = roomState.currentRound?.currentTrick?.cardsPlayed ?? [];
  const recentlyActedPlayerId =
    currentTrickCards[currentTrickCards.length - 1]?.playerId ?? roomState.currentRound?.lastTrick?.winnerPlayerId ?? null;
  const phaseLabel =
    {
      LOBBY: "Waiting",
      PRE_BIDDING: "Waiting",
      BIDDING: "Bidding",
      TRICK_PLAYING: isMyTurn ? "Your turn" : "Waiting",
      ROUND_SUMMARY: "Round complete",
      GAME_OVER: "Round complete"
    }[status] ?? status;
  const turnLabel =
    status === "LOBBY"
      ? "Waiting for host"
      : isMyTurn
        ? "Your turn"
        : currentTurnPlayer
          ? `${currentTurnPlayer.nickname} to act`
          : "Waiting";

  const opponents = players
    .filter((player) => player.playerId !== clientPlayerId)
    .sort((a, b) => {
      const aDistance = (a.seatIndex - (clientPlayer?.seatIndex ?? 0) + players.length) % players.length;
      const bDistance = (b.seatIndex - (clientPlayer?.seatIndex ?? 0) + players.length) % players.length;
      return aDistance - bDistance;
    });

  const dealerPlayerId = players[roomState.gameConfig.dealerIndex]?.playerId;

  const leadSuit = roomState.currentRound?.currentTrick?.leadSuit;
  const hand = clientPlayer?.hand ?? [];
  const hasLeadSuit = leadSuit ? hand.some((card) => card.suit === leadSuit) : false;
  const legalCardIds = new Set(
    leadSuit && hasLeadSuit ? hand.filter((card) => card.suit === leadSuit).map((card) => card.id) : hand.map((card) => card.id)
  );

  const canOpenHostPanel = isAdmin && (isLobby || isPreBidding || isSummary);
  const timerEndsAt = roomState.timer?.endsAt ?? null;

  return (
    <div className={`game-layout game-layout--${status.toLowerCase().replace(/_/g, "-")}`}>
      <header className="game-header">
        <div className="game-header-meta">
          <span className="gh-item gh-room">
            Room <strong className="room-code">{roomState.roomId}</strong>
          </span>
          <span className="gh-dot" aria-hidden="true">·</span>
          <span className="gh-item">
            Round <strong>{roomState.gameConfig.roundNumber}</strong>
          </span>
          <span className="gh-dot" aria-hidden="true">·</span>
          <span className="gh-item">
            {roomState.gameConfig.phase === "ASCENDING" ? "Ascending" : "Descending"}{" "}
            <strong>{roomState.gameConfig.cardsInRound}</strong> {roomState.gameConfig.cardsInRound === 1 ? "card" : "cards"}
          </span>
          <span className="gh-dot" aria-hidden="true">·</span>
          <TrumpIndicator roomState={roomState} />
        </div>
        <div className="game-header-actions">
          <ConnectionBadge isConnected={isConnected} />
          <span className={`gh-item gh-state gh-state--${phaseLabel.toLowerCase().replace(/\s+/g, "-")}`} aria-label={`Phase ${phaseLabel}, ${turnLabel}`}>
            <strong>{phaseLabel}</strong>
            <span>{turnLabel}</span>
          </span>
          <button type="button" className="btn-ghost btn-sm" onClick={onLeaveRoom}>
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
        {opponents.length > 0 && (
          <div className="opponents">
            {opponents.map((player, index) => (
              <PlayerSeat
                key={player.playerId}
                player={player}
                slot={slotForOpponent(index, opponents.length)}
                isTurn={players[roomState.gameConfig.currentTurnIndex]?.playerId === player.playerId}
                isDimmed={!player.isOnline}
                isDealer={player.playerId === dealerPlayerId}
                isRecentlyActed={player.playerId === recentlyActedPlayerId && !isMyTurn}
                timerEndsAt={
                  players[roomState.gameConfig.currentTurnIndex]?.playerId === player.playerId ? timerEndsAt : null
                }
              />
            ))}
          </div>
        )}

        <TrickTable
          roomState={roomState}
          dropZoneRef={dropZoneRef}
          dropActive={isDragging}
        />
      </div>

      {clientPlayer && (
        <div className="self-area">
          <div className="self-row">
            <PlayerSeat
              player={clientPlayer}
              isClient
              isTurn={isMyTurn}
              isDealer={clientPlayer.playerId === dealerPlayerId}
              isRecentlyActed={clientPlayer.playerId === recentlyActedPlayerId && !isMyTurn}
              timerEndsAt={isMyTurn ? timerEndsAt : null}
            />
          </div>
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
              isAdmin ? (
                <button type="button" className="btn-primary" onClick={onRematch}>
                  Rematch
                </button>
              ) : (
                <span className="chip">Waiting for the host to start a rematch</span>
              )
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
            onReorder={onReorderPlayers}
            onClose={() => setAdminOpen(false)}
          />
        </motion.div>
      )}
    </div>
  );
}
