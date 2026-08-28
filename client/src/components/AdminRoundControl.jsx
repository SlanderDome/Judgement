import { useState } from "react";

const SUITS = [
  { key: "SPADES", label: "Spades", pip: "♠", red: false },
  { key: "DIAMONDS", label: "Diamonds", pip: "♦", red: true },
  { key: "CLUBS", label: "Clubs", pip: "♣", red: false },
  { key: "HEARTS", label: "Hearts", pip: "♥", red: true }
];

function movePlayerIds(players, playerId, direction) {
  const ids = players.map((player) => player.playerId);
  const index = ids.indexOf(playerId);
  const target = index + direction;

  if (index < 0 || target < 0 || target >= ids.length) {
    return ids;
  }

  [ids[index], ids[target]] = [ids[target], ids[index]];
  return ids;
}

export function AdminRoundControl({ roomState, onStartGame, onStartBidding, onNextRound, onReorder, onClose }) {
  const isLobby = roomState.status === "LOBBY";
  const isPreBidding = roomState.status === "PRE_BIDDING";
  const isSummary = roomState.status === "ROUND_SUMMARY";
  const canConfigure = isLobby || isSummary;

  const activePlayersCount = roomState.players.filter((p) => p.isOnline || isLobby).length || 1;
  const maxAllowedCards = Math.max(1, Math.floor(52 / activePlayersCount));

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
    } else if (isPreBidding) {
      onStartBidding();
    } else {
      onNextRound({ cardsInRound, trumpSuit: selectedSuit });
    }
    onClose?.();
  }

  function handleEndGame() {
    onNextRound({ action: "end_game" });
    onClose?.();
  }

  const title = isLobby ? "Start the first round" : isPreBidding ? "Bidding" : "Configure next round";
  const primaryLabel = isLobby
    ? "Start game"
    : isPreBidding
      ? "Start bidding"
      : `Start round ${roomState.gameConfig.roundNumber + 1}`;

  return (
    <div className="overlay-card">
      <div className="overlay-head">
        <div>
          <p className="eyebrow">Host controls</p>
          <h2>{title}</h2>
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

      <div className="control-section">
        <span className="control-label">Playing order</span>
        <div className="order-list">
          {roomState.players.map((player, index) => (
            <div key={player.playerId} className="order-row">
              <span className="order-pos">{index + 1}</span>
              <span className="order-name">
                {player.nickname}
                {player.playerId === roomState.adminPlayerId ? " · host" : ""}
              </span>
              <div className="order-actions">
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => onReorder(movePlayerIds(roomState.players, player.playerId, -1))}
                  disabled={index === 0}
                  aria-label={`Move ${player.nickname} up`}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => onReorder(movePlayerIds(roomState.players, player.playerId, 1))}
                  disabled={index === roomState.players.length - 1}
                  aria-label={`Move ${player.nickname} down`}
                >
                  ↓
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="control-actions">
        <button type="button" className="btn-primary" onClick={handlePrimary}>
          {primaryLabel}
        </button>
        {isSummary && (
          <button type="button" className="btn-danger" onClick={handleEndGame}>
            End game
          </button>
        )}
      </div>
    </div>
  );
}
