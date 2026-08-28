import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { AdminRoundControl } from "./AdminRoundControl.jsx";
import { BiddingOverlay } from "./BiddingOverlay.jsx";
import { PlayerSeat } from "./PlayerSeat.jsx";
import { PlayingHand } from "./PlayingHand.jsx";
import { TrumpIndicator } from "./TrumpIndicator.jsx";
import { TrickTable } from "./TrickTable.jsx";
import { TurnOrder } from "./TurnOrder.jsx";
import { TurnTimerBar } from "./TurnTimerBar.jsx";

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
  onStartGame,
  onSubmitBid,
  onPlayCard,
  onStartBidding,
  onReorderPlayers,
  onNextRound,
  onRematch
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

  const opponents = players
    .filter((player) => player.playerId !== clientPlayerId)
    .sort((a, b) => a.seatIndex - b.seatIndex);

  const dealerPlayerId = players[roomState.gameConfig.dealerIndex]?.playerId;

  const leadSuit = roomState.currentRound?.currentTrick?.leadSuit;
  const hand = clientPlayer?.hand ?? [];
  const hasLeadSuit = leadSuit ? hand.some((card) => card.suit === leadSuit) : false;
  const legalCardIds = new Set(
    leadSuit && hasLeadSuit ? hand.filter((card) => card.suit === leadSuit).map((card) => card.id) : hand.map((card) => card.id)
  );

  const lobbyHint = isAdmin
    ? "You're the host — open Host controls to start the game"
    : "Waiting for the host to start the round";
  const tableHint = isLobby
    ? lobbyHint
    : isPreBidding
      ? isAdmin
        ? "Cards dealt — start bidding when ready"
        : "Waiting for the host to start bidding"
      : null;

  const canOpenHostPanel = isAdmin && (isLobby || isPreBidding || isSummary);

  return (
    <div className="game-layout">
      <div className="game-strip">
        <div className="game-strip-left">
          <span className="chip">
            Room <span className="room-code">{roomState.roomId}</span>
          </span>
          <span className="chip">
            Round <strong>{roomState.gameConfig.roundNumber}</strong>
          </span>
          <span className="chip">
            {roomState.gameConfig.phase === "ASCENDING" ? "Ascending" : "Descending"} ·{" "}
            <strong>{roomState.gameConfig.cardsInRound}</strong> card{roomState.gameConfig.cardsInRound === 1 ? "" : "s"}
          </span>
          <TrumpIndicator roomState={roomState} />
        </div>
        <div className="game-strip-right">
          <TurnTimerBar endsAt={roomState.timer?.endsAt} />
          {isAdmin && isPreBidding && (
            <button type="button" className="btn-primary" onClick={onStartBidding}>
              Start bidding
            </button>
          )}
          {canOpenHostPanel && (
            <button type="button" className="btn-ghost" onClick={() => setAdminOpen(true)}>
              Host controls
            </button>
          )}
        </div>
      </div>

      <TurnOrder
        players={players}
        currentTurnIndex={roomState.gameConfig.currentTurnIndex}
        dealerIndex={roomState.gameConfig.dealerIndex}
      />

      {opponents.length > 0 && (
        <div className="opponents">
          {opponents.map((player) => (
            <PlayerSeat
              key={player.playerId}
              player={player}
              isTurn={players[roomState.gameConfig.currentTurnIndex]?.playerId === player.playerId}
              isDimmed={!player.isOnline}
              showScore={!isLobby}
              position={player.seatIndex + 1}
              isDealer={player.playerId === dealerPlayerId}
            />
          ))}
        </div>
      )}

      <TrickTable
        roomState={roomState}
        clientPlayerId={clientPlayerId}
        hint={tableHint}
        dropZoneRef={dropZoneRef}
        dropActive={isDragging}
      />

      {clientPlayer && (
        <div className="self-area">
          <div className="self-row">
            <PlayerSeat
              player={clientPlayer}
              isClient
              isTurn={isMyTurn}
              showScore={!isLobby}
              position={clientPlayer.seatIndex + 1}
              isDealer={clientPlayer.playerId === dealerPlayerId}
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
