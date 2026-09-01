import { AnimatePresence, motion } from "framer-motion";
import { PlayingCard } from "./PlayingCard.jsx";
import { Seconds } from "./Seconds.jsx";
import { leadingPlay } from "../lib/trick.js";

function getPlayerName(players, playerId) {
  return players.find((player) => player.playerId === playerId)?.nickname ?? "Player";
}

export function TrickTable({ roomState, dropZoneRef, dropActive, revealEndsAt = null }) {
  const currentTrick = roomState.currentRound?.currentTrick;
  const playedCards = currentTrick?.cardsPlayed ?? [];
  const lastTrick = roomState.currentRound?.lastTrick;
  const isRevealing = revealEndsAt != null;
  // The card currently winning the trick: the server's winner once the trick is
  // resolved, otherwise computed live from the cards on the table.
  const liveLeader = leadingPlay(playedCards, currentTrick?.leadSuit ?? null, roomState.gameConfig?.trumpSuit ?? null);
  const winningPlayerId =
    currentTrick?.winnerPlayerId ?? liveLeader?.playerId ?? lastTrick?.winnerPlayerId ?? null;

  return (
    <section
      className={`table-stage ${playedCards.length ? "table-stage--active" : "table-stage--empty"} ${
        isRevealing ? "table-stage--revealing" : ""
      }`}
      aria-label="Played cards table"
    >
      <div className={`table-felt ${dropActive ? "is-drop-active" : ""}`} ref={dropZoneRef}>
        <div className="table-inner">
          <div className="played-card-grid">
            <AnimatePresence mode="popLayout">
              {playedCards.map((play, index) => {
                const isWinning = play.playerId === winningPlayerId;

                return (
                <motion.div
                  key={`${play.playerId}-${play.card.id}`}
                  className={`played-card-slot ${isWinning ? "is-winning" : ""}`}
                  initial={{ opacity: 0, y: 30, scale: 0.9, rotateX: 10 }}
                  animate={{
                    opacity: 1,
                    y: isWinning ? -6 : 0,
                    scale: isWinning ? 1.05 : 1,
                    rotateX: 0
                  }}
                  exit={{ opacity: 0, y: -10, scale: 0.94 }}
                  transition={{ type: "spring", stiffness: 320, damping: 26, delay: index * 0.03 }}
                  layout
                >
                  <PlayingCard
                    card={play.card}
                    ownerName={getPlayerName(roomState.players, play.playerId)}
                    isTableCard
                    isWinning={isWinning}
                    rotation={(index - (playedCards.length - 1) / 2) * 7}
                    delay={0}
                  />
                  <span className={`played-by ${isWinning ? "is-winning" : ""}`}>
                    {getPlayerName(roomState.players, play.playerId)}
                  </span>
                </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          <AnimatePresence>
            {isRevealing && winningPlayerId ? (
              <motion.div
                key="reveal"
                className="trick-reveal"
                initial={{ opacity: 0, y: 8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.97 }}
                transition={{ duration: 0.2 }}
              >
                <strong>{getPlayerName(roomState.players, winningPlayerId)}</strong> wins the trick
                <span className="trick-reveal-count">
                  Next trick in <Seconds endsAt={revealEndsAt} />s
                </span>
              </motion.div>
            ) : lastTrick ? (
              <motion.div
                key="last"
                className="last-trick"
                initial={{ opacity: 0, y: 8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.24 }}
              >
                Last trick · {getPlayerName(roomState.players, lastTrick.winnerPlayerId)}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
