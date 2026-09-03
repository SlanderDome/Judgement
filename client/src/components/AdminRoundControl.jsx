import { useState } from "react";
import { seatedPlayers } from "../lib/seats.js";

const SUITS = [
  { key: "SPADES", label: "Spades", pip: "♠", red: false },
  { key: "DIAMONDS", label: "Diamonds", pip: "♦", red: true },
  { key: "CLUBS", label: "Clubs", pip: "♣", red: false },
  { key: "HEARTS", label: "Hearts", pip: "♥", red: true }
];

export function AdminRoundControl({ roomState, onStartGame, onStartBidding, onTogglePause, onNextRound, onClose }) {
  const isLobby = roomState.status === "LOBBY";
  const isSummary = roomState.status === "ROUND_SUMMARY";
  const canConfigure = isLobby || isSummary;
  const isPreBidding = roomState.status === "PRE_BIDDING";
  const canPause = !isLobby && !isSummary && roomState.status !== "GAME_OVER";

  const ring = seatedPlayers(roomState);
  const seatedPlayersCount = ring.length || 1;
  const maxAllowedCards = Math.max(1, Math.floor(52 / seatedPlayersCount));

  const defaultCards = isLobby ? 1 : Math.min(roomState.gameConfig.cardsInRound + 1, maxAllowedCards);
  const [cardsInRound, setCardsInRound] = useState(defaultCards);
  const [selectedSuit, setSelectedSuit] = useState(roomState.gameConfig.trumpSuit ?? "SPADES");

  function handleDecrement() {
    setCardsInRound((prev) => Math.max(1, prev - 1));
  }

  function handleIncrement() {
    setCardsInRound((prev) => Math.min(maxAllowedCards, prev + 1));
  }

  function handlePrimary() {
    if (isLobby) {
      onStartGame({ cardsInRound, trumpSuit: selectedSuit });
    } else {
      onNextRound({ cardsInRound, trumpSuit: selectedSuit });
    }
    onClose?.();
  }

  function handleEndGame() {
    onNextRound({ action: "end_game" });
    onClose?.();
  }

  const title = isLobby ? "Start the first round" : "Configure next round";
  const primaryLabel = isLobby ? "Start game" : `Start round ${roomState.gameConfig.roundNumber + 1}`;

  return (
    <div className="overlay-card admin-card">
      <div className="overlay-head">
        <div>
          <p className="eyebrow">Host controls</p>
          <h2>{canPause ? "Game controls" : title}</h2>
        </div>
        {onClose && (
          <button type="button" className="overlay-close btn-ghost" onClick={onClose} aria-label="Close">
            ×
          </button>
        )}
      </div>

      {canConfigure && (
        <>
          <div className="control-section">
            <span className="control-label">Cards for next round (max {maxAllowedCards})</span>
            <div className="stepper">
              <button type="button" className="btn-ghost" onClick={handleDecrement} disabled={cardsInRound <= 1}>
                −
              </button>
              <span className="stepper-value">{cardsInRound}</span>
              <button type="button" className="btn-ghost" onClick={handleIncrement} disabled={cardsInRound >= maxAllowedCards}>
                +
              </button>
            </div>
          </div>

          <div className="control-section">
            <span className="control-label">Trump suit</span>
            <div className="suit-row">
              {SUITS.map((suit) => (
                <button
                  key={suit.key}
                  type="button"
                  className={`suit-chip ${suit.red ? "red" : "black"} ${selectedSuit === suit.key ? "is-selected" : ""}`}
                  onClick={() => setSelectedSuit(suit.key)}
                >
                  {suit.pip} {suit.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {canConfigure && (
      <div className="control-section admin-players-section">
        <span className="control-label">Seated players</span>
        <div className="order-list">
          {ring.map((player) => (
            <div key={player.playerId} className="order-row">
              <span className="order-pos">{player.seatIndex + 1}</span>
              <span className="order-name">
                {player.nickname}
                {player.playerId === roomState.adminPlayerId ? " · host" : ""}
              </span>
            </div>
          ))}
          {ring.length === 0 && <p className="control-hint">Nobody has taken a seat yet.</p>}
        </div>
      </div>
      )}

      <div className="control-actions">
        {canConfigure && (
          <button type="button" className="btn-primary" onClick={handlePrimary}>
            {primaryLabel}
          </button>
        )}
        {isPreBidding && (
          <button type="button" className="btn-ghost" onClick={onStartBidding}>
            Start bidding now
          </button>
        )}
        {canPause && (
          <button
            type="button"
            className="btn-ghost"
            onClick={onTogglePause}
            aria-pressed={roomState.paused === true}
          >
            {roomState.paused ? "Resume game" : "Pause game"}
          </button>
        )}
        {isSummary && (
          <button type="button" className="btn-danger" onClick={handleEndGame}>
            End game
          </button>
        )}
      </div>
    </div>
  );
}
