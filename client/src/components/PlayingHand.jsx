import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { PlayingCard } from "./PlayingCard.jsx";

export function PlayingHand({ cards, isMyTurn, legalCardIds, onPlayCard, dropZoneRef, onDragStateChange }) {
  const [selectedCardId, setSelectedCardId] = useState(null);
  const selectedCard = cards.find((card) => card.id === selectedCardId);

  function isCardPlayable(card) {
    return isMyTurn && legalCardIds.has(card.id);
  }

  function handleCardClick(cardId) {
    if (!isMyTurn || !legalCardIds.has(cardId)) {
      return;
    }

    setSelectedCardId((currentId) => (currentId === cardId ? null : cardId));
  }

  function handlePlaySelected() {
    if (!selectedCard || !legalCardIds.has(selectedCard.id)) {
      return;
    }

    onPlayCard?.(selectedCard.id);
    setSelectedCardId(null);
  }

  function handleDragEnd(cardId, info) {
    onDragStateChange?.(false);

    const zone = dropZoneRef?.current;
    if (!zone) {
      return;
    }

    const rect = zone.getBoundingClientRect();
    const left = rect.left + window.scrollX;
    const top = rect.top + window.scrollY;
    const { x, y } = info.point;

    const isOverTable = x >= left && x <= left + rect.width && y >= top && y <= top + rect.height;
    if (isOverTable && legalCardIds.has(cardId)) {
      onPlayCard?.(cardId);
      setSelectedCardId(null);
    }
  }

  return (
    <section className="hand-panel">
      <div className="hand-header">
        <div>
          <p className="eyebrow">Your hand</p>
          <h2>{isMyTurn ? "Choose your play" : "Cards in hand"}</h2>
        </div>
        <button
          type="button"
          className="play-selected-button btn-primary"
          onClick={handlePlaySelected}
          disabled={!selectedCard || !legalCardIds.has(selectedCard.id)}
        >
          Play
        </button>
      </div>

      <div className="fan-hand" style={{ "--card-count": Math.max(cards.length, 1) }}>
        <AnimatePresence mode="popLayout">
          {cards.map((card, index) => {
            const centerOffset = index - (cards.length - 1) / 2;
            const rotation = centerOffset * Math.min(8, Math.max(3.5, 34 / Math.max(cards.length, 1)));
            const y = Math.abs(centerOffset) * 5;
            const playable = isCardPlayable(card);

            return (
              <motion.div
                key={card.id}
                className="fan-card-wrap"
                style={{ zIndex: selectedCardId === card.id ? 50 : index + 1 }}
                layout
              >
                <PlayingCard
                  card={card}
                  delay={index * 0.045}
                  disabled={!playable}
                  isPlayable={playable}
                  isSelected={selectedCardId === card.id}
                  isDraggable={playable}
                  rotation={rotation}
                  y={y}
                  onClick={() => handleCardClick(card.id)}
                  onDragStart={() => onDragStateChange?.(true)}
                  onDragEnd={(info) => handleDragEnd(card.id, info)}
                />
              </motion.div>
            );
          })}
        </AnimatePresence>

        {cards.length === 0 && <p className="hand-empty">Your cards will appear here after the round starts.</p>}
      </div>
    </section>
  );
}
