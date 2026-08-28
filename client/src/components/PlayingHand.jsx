import { AnimatePresence, motion } from "framer-motion";
import { useLayoutEffect, useRef, useState } from "react";
import { PlayingCard } from "./PlayingCard.jsx";

const SUIT_PIPS = {
  SPADES: "♠",
  DIAMONDS: "♦",
  CLUBS: "♣",
  HEARTS: "♥"
};

export function PlayingHand({ cards, isMyTurn, legalCardIds, onPlayCard, dropZoneRef, onDragStateChange }) {
  const [selectedCardId, setSelectedCardId] = useState(null);
  const [hoveredCardId, setHoveredCardId] = useState(null);
  const [fan, setFan] = useState({ overlap: 0 });
  const handRef = useRef(null);

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
    const { x, y } = info.point;
    const isOverTable = x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;

    if (isOverTable && legalCardIds.has(cardId)) {
      onPlayCard?.(cardId);
      setSelectedCardId(null);
    }
  }

  // Measure the fan so card overlap adapts to card count and viewport width,
  // while strictly capping overlap at 48% so the rank & suit corner is ALWAYS 100% visible.
  useLayoutEffect(() => {
    function measure() {
      const container = handRef.current;
      if (!container) {
        return;
      }

      const cardEl = container.querySelector(".playing-card");
      const cardWidth = cardEl ? cardEl.getBoundingClientRect().width : 92;
      const available = Math.max(0, container.clientWidth - 32);
      const count = Math.max(cards.length, 1);

      const rawOverlap = count > 1 ? (cardWidth * count - available) / (count - 1) : 0;
      // Cap overlap at 48% max so at least 52% (~48px) of every card's left face is visible
      const maxAllowedOverlap = cardWidth * 0.48;
      const overlap = count > 1 ? Math.min(maxAllowedOverlap, Math.max(-6, rawOverlap)) : 0;

      setFan({ overlap });
    }

    measure();

    const observer = new ResizeObserver(measure);
    if (handRef.current) {
      observer.observe(handRef.current);
    }
    window.addEventListener("resize", measure);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [cards.length]);

  return (
    <section className="hand" aria-label="Your hand">
      <div className="fan-hand" ref={handRef}>
        <AnimatePresence mode="popLayout">
          {cards.map((card, index) => {
            const centerOffset = index - (cards.length - 1) / 2;
            const maxRotation = Math.min(10, Math.max(4, 32 / Math.max(cards.length, 1)));
            const rotation = centerOffset * maxRotation;
            const y = Math.abs(centerOffset) * 4;
            const playable = isCardPlayable(card);
            const isSelected = selectedCardId === card.id;
            const isHovered = hoveredCardId === card.id;
            const zIndex = isSelected ? 120 : isHovered ? 100 : index + 1;

            return (
              <motion.div
                key={card.id}
                className="fan-card-wrap"
                style={{
                  zIndex,
                  marginLeft: index === 0 ? 0 : -fan.overlap
                }}
                layout
              >
                <PlayingCard
                  card={card}
                  delay={index * 0.04}
                  disabled={!playable}
                  isPlayable={playable}
                  isSelected={isSelected}
                  isDraggable={playable}
                  rotation={rotation}
                  y={y}
                  onClick={() => handleCardClick(card.id)}
                  onMouseEnter={() => setHoveredCardId(card.id)}
                  onMouseLeave={() => setHoveredCardId(null)}
                  onDragStart={() => onDragStateChange?.(true)}
                  onDragEnd={(info) => handleDragEnd(card.id, info)}
                />
              </motion.div>
            );
          })}
        </AnimatePresence>


        {cards.length === 0 && <p className="hand-empty">No cards yet.</p>}
      </div>

      <AnimatePresence>
        {selectedCard && (
          <motion.button
            type="button"
            className="play-fab btn-primary"
            onClick={handlePlaySelected}
            initial={{ opacity: 0, y: 12, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.92 }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
          >
            Play {selectedCard.label}
            {SUIT_PIPS[selectedCard.suit]}
          </motion.button>
        )}
      </AnimatePresence>
    </section>
  );
}
