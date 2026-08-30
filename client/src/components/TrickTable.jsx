import { AnimatePresence, motion } from "framer-motion";
import { PlayingCard } from "./PlayingCard.jsx";

function getPlayerName(players, playerId) {
  return players.find((player) => player.playerId === playerId)?.nickname ?? "Player";
}

export function TrickTable({ roomState, dropZoneRef, dropActive }) {
  const playedCards = roomState.currentRound?.currentTrick?.cardsPlayed ?? [];
  const lastTrick = roomState.currentRound?.lastTrick;
  const winningPlayerId = lastTrick?.winnerPlayerId ?? null;

  return (
    <section className="table-stage" aria-label="Played cards table">
      <div className={`table-felt ${dropActive ? "is-drop-active" : ""}`} ref={dropZoneRef}>
        <div className="table-inner">
          <div className="played-card-grid">
            <AnimatePresence mode="popLayout">
              {playedCards.map((play, index) => (
                <motion.div
                  key={`${play.playerId}-${play.card.id}`}
                  className="played-card-slot"
                  initial={{ opacity: 0, y: 30, scale: 0.9, rotateX: 10 }}
                  animate={{
                    opacity: 1,
                    y: 0,
                    scale: play.playerId === winningPlayerId ? 1.04 : 1,
                    rotateX: 0,
                    filter: play.playerId === winningPlayerId ? "drop-shadow(0 0 16px rgba(231, 207, 143, 0.18))" : "none"
                  }}
                  exit={{ opacity: 0, y: -10, scale: 0.94 }}
                  transition={{ type: "spring", stiffness: 320, damping: 26, delay: index * 0.03 }}
                  layout
                >
                  <PlayingCard
                    card={play.card}
                    ownerName={getPlayerName(roomState.players, play.playerId)}
                    isTableCard
                    rotation={(index - (playedCards.length - 1) / 2) * 7}
                    delay={index * 0.05}
                  />
                  <span className="played-by">{getPlayerName(roomState.players, play.playerId)}</span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {lastTrick && (
            <motion.div
              className="last-trick"
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.24 }}
            >
              Last trick · {getPlayerName(roomState.players, lastTrick.winnerPlayerId)}
            </motion.div>
          )}
        </div>
      </div>
    </section>
  );
}
