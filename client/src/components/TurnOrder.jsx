import { Fragment } from "react";

export function TurnOrder({ players, currentTurnIndex, dealerIndex }) {
  if (!players.length) {
    return null;
  }

  const ordered = [...players].sort((a, b) => a.seatIndex - b.seatIndex);
  const currentPlayerId = players[currentTurnIndex]?.playerId;
  const dealerPlayerId = players[dealerIndex]?.playerId;

  return (
    <div className="turn-order" aria-label="Playing order">
      <span className="turn-order-label">Order</span>
      <div className="turn-order-items">
        {ordered.map((player, index) => {
          const isCurrent = player.playerId === currentPlayerId;
          const isDealer = player.playerId === dealerPlayerId;

          return (
            <Fragment key={player.playerId}>
              <span
                className={[
                  "turn-order-item",
                  isCurrent ? "is-current" : "",
                  isDealer ? "is-dealer" : ""
                ].join(" ")}
              >
                <span className="order-num">{player.seatIndex + 1}</span>
                <span className="order-name">{player.nickname}</span>
                {isDealer && <span className="order-tag">Dealer</span>}
              </span>
              {index < ordered.length - 1 && (
                <span className="turn-order-arrow" aria-hidden="true">
                  →
                </span>
              )}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
