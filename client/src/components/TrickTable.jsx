import { AnimatePresence, motion } from "framer-motion";
import { PlayingCard } from "./PlayingCard.jsx";

function getPlayerName(players, playerId) {
  return players.find((player) => player.playerId === playerId)?.nickname ?? "Player";
}

export function TrickTable({ roomState, clientPlayerId, hint, dropZoneRef, dropActive }) {
  const playedCards = roomState.currentRound?.currentTrick?.cardsPlayed ?? [];
  const lastTrick = roomState.currentRound?.lastTrick;
  const leadSuit = roomState.currentRound?.currentTrick?.leadSuit;
  const currentPlayer = roomState.players[roomState.gameConfig.currentTurnIndex];
  const isMyTurn = currentPlayer?.playerId === clientPlayerId;
  const isActive = roomState.status === "TRICK_PLAYING" || roomState.status === "BIDDING";

  return (
    <section className="table-stage" aria-label="Played cards table">
      <div className={`table-felt ${dropActive ? "is-drop-active" : ""}`} ref={dropZoneRef}>
        <div className="table-inner">
          <div className="table-center">
            {isActive && currentPlayer && (
              <div className="turn-chip">
                <span className="dot" aria-hidden="true" />
                {isMyTurn ? "Your turn" : `${currentPlayer.nickname}'s turn`}
              </div>
            )}

            {!isActive && hint && <div className="turn-chip">{hint}</div>}

            <div className="played-card-grid">
              <AnimatePresence mode="popLayout">
                {playedCards.map((play, index) => (
                  <motion.div
                    key={`${play.playerId}-${play.card.id}`}
                    className="played-card-slot"
                    initial={{ opacity: 0, y: 24, scale: 0.88 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -16, scale: 0.9 }}
                    transition={{ type: "spring", stiffness: 320, damping: 26 }}
                    layout
                  >
                    <PlayingCard
                      card={play.card}
                      ownerName={getPlayerName(roomState.players, play.playerId)}
                      isTableCard
                      rotation={(index - (playedCards.length - 1) / 2) * 7}
                      delay={index * 0.05}
                    />
                    <span>{getPlayerName(roomState.players, play.playerId)}</span>
                  </motion.div>
                ))}
              </AnimatePresence>

              {playedCards.length === 0 && (
                <p className="table-empty">
                  {leadSuit ? "Cards land here as they're played" : "Waiting for the lead card"}
                </p>
              )}
            </div>

            {lastTrick && (
              <motion.div
                className="last-trick"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.24 }}
              >
                Last trick won by {getPlayerName(roomState.players, lastTrick.winnerPlayerId)}
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
