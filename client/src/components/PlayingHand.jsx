import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { PlayingCard } from "./PlayingCard.jsx";
import { playSfx } from "../lib/sfx.js";

const SUIT_PIPS = {
  SPADES: "♠",
  DIAMONDS: "♦",
  CLUBS: "♣",
  HEARTS: "♥"
};

export function PlayingHand({ cards, isMyTurn, legalCardIds, onPlayCard, dropZoneRef, onDragStateChange, revealDeal = false, playKey, playContext }) {
  const [selectedCardId, setSelectedCardId] = useState(null);
  const [hoveredCardId, setHoveredCardId] = useState(null);
  const [pendingCardId, setPendingCardId] = useState(null);
  const [playError, setPlayError] = useState("");
  const pendingRef = useRef(null);
  const attemptRef = useRef(0);
  const [fan, setFan] = useState({ overlap: 0, cardWidth: null, overflowing: false });
  const handRef = useRef(null);

  const selectedCard = cards.find((card) => card.id === selectedCardId);

  useEffect(() => {
    if (pendingRef.current && !cards.some(card => card.id === pendingRef.current)) {
      pendingRef.current = null;
      setPendingCardId(null);
      attemptRef.current += 1;
      onDragStateChange?.(false);
    }
  }, [cards]);

  useEffect(() => {
    pendingRef.current = null;
    setPendingCardId(null);
    setSelectedCardId(null);
    setPlayError("");
    attemptRef.current += 1;
    return () => { attemptRef.current += 1; };
  }, [playKey]);

  function submitCard(cardId) {
    if (pendingRef.current || !isMyTurn || !legalCardIds.has(cardId) || !onPlayCard) return false;
    pendingRef.current = cardId;
    setPendingCardId(cardId);
    setSelectedCardId(null);
    setPlayError("");
    const attempt = ++attemptRef.current;
    Promise.resolve().then(() => onPlayCard(cardId, playContext)).then(result => {
      if (attempt !== attemptRef.current || result?.success) return;
      pendingRef.current = null;
      setPendingCardId(null);
      setPlayError(result?.message ?? "Your play was not confirmed. Please try again.");
      onDragStateChange?.(false);
    }).catch(() => {
      if (attempt !== attemptRef.current) return;
      pendingRef.current = null;
      setPendingCardId(null);
      setPlayError("Unable to play this card. Check your connection and try again.");
      onDragStateChange?.(false);
    });
    return true;
  }

  function isCardPlayable(card) {
    return isMyTurn && !pendingCardId && legalCardIds.has(card.id);
  }

  function handleCardClick(cardId) {
    if (!isMyTurn || pendingRef.current || !legalCardIds.has(cardId)) {
      return;
    }

    setSelectedCardId((currentId) => {
      if (currentId === cardId) {
        return null;
      }
      playSfx("select");
      return cardId;
    });
  }

  function handleCardLeave(event) {
    setHoveredCardId(null);
    event.currentTarget.style.removeProperty("--pointer-tilt");
  }

  function handlePlaySelected() {
    if (!selectedCard || !legalCardIds.has(selectedCard.id)) {
      return;
    }

    submitCard(selectedCard.id);
  }

  function handleDragEnd(cardId, info, event) {
    const zone = dropZoneRef?.current;
    if (!zone) {
      onDragStateChange?.(false);
      return false;
    }

    const rect = zone.getBoundingClientRect();
    const x = event.clientX ?? info.point.x - window.scrollX;
    const y = event.clientY ?? info.point.y - window.scrollY;
    const isOverTable = x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;

    if (isOverTable && submitCard(cardId)) return true;
    onDragStateChange?.(false);
    return false;
  }

  // Keyboard: number keys address the first ten cards. Arrow keys cover larger
  // hands, and Enter confirms the selected card.
  const playKbRef = useRef({});
  playKbRef.current = { isMyTurn: isMyTurn && !pendingCardId, legalCardIds, onPlayCard: submitCard, cards, selectedCardId };
  useEffect(() => {
    function handleKey(event) {
      if (event.defaultPrevented || event.repeat || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      const target = event.target;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }
      if (document.querySelector(".overlay") || target?.closest?.(".room-navbar")) {
        return; // a modal / scoreboard is open
      }
      const state = playKbRef.current;
      if (!state.isMyTurn || !state.onPlayCard || state.cards.length === 0) {
        return;
      }
      if (/^[0-9]$/.test(event.key)) {
        const key = Number(event.key);
        const index = key === 0 ? 9 : key - 1;
        const card = state.cards[index];
        if (!card || !state.legalCardIds.has(card.id)) {
          return;
        }
        event.preventDefault();
        setSelectedCardId(null);
        state.onPlayCard(card.id);
        return;
      }

      const playableCards = state.cards.filter((card) => state.legalCardIds.has(card.id));
      if (playableCards.length === 0) {
        return;
      }

      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        const currentIndex = playableCards.findIndex((card) => card.id === state.selectedCardId);
        const direction = event.key === "ArrowRight" ? 1 : -1;
        const nextIndex = currentIndex < 0
          ? direction > 0 ? 0 : playableCards.length - 1
          : (currentIndex + direction + playableCards.length) % playableCards.length;
        setSelectedCardId(playableCards[nextIndex].id);
        return;
      }

      if (event.key === "Enter" && state.selectedCardId && state.legalCardIds.has(state.selectedCardId)) {
        event.preventDefault();
        state.onPlayCard(state.selectedCardId);
        setSelectedCardId(null);
      }
    }

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  // Measure the fan so card overlap adapts to card count and viewport width,
  // while strictly capping overlap at 48% so the rank & suit corner is ALWAYS 100% visible.
  useLayoutEffect(() => {
    function measure() {
      const container = handRef.current;
      if (!container) {
        return;
      }

      const cardEl = container.querySelector(".playing-card");
      // Measure the untransformed CSS baseline, not the previous fitted width or
      // a hovered/selected card. Otherwise resizing carries desktop card sizes
      // into the mobile hand and each rotation can inflate the next measurement.
      let measuredWidth = 92;
      if (cardEl) {
        const fittedWidth = container.style.getPropertyValue("--hand-card-width");
        container.style.setProperty("--hand-card-width", "var(--card-w-hand)");
        measuredWidth = Number.parseFloat(window.getComputedStyle(cardEl).width) || 92;
        if (fittedWidth) container.style.setProperty("--hand-card-width", fittedWidth);
        else container.style.removeProperty("--hand-card-width");
      }
      const cardWidth = measuredWidth;
      const style = window.getComputedStyle(container);
      const available = Math.max(0, container.clientWidth - (parseFloat(style.paddingLeft) || 0) - (parseFloat(style.paddingRight) || 0));
      const count = Math.max(cards.length, 1);

      // Shrink cards until the hand fits while preserving enough of each card
      // to identify it. Very large hands retain a scroll fallback instead of
      // allowing cards to escape the viewport.
      const shortLandscape = window.innerWidth <= 860 && window.innerHeight <= 500 && window.innerWidth > window.innerHeight;
      const minCardWidth = shortLandscape ? 48 : window.innerWidth <= 560 ? 68 : 64;
      const fitWidth = count > 1 ? available / (0.52 * count + 0.48) : cardWidth;
      const nextCardWidth = Math.max(minCardWidth, Math.min(cardWidth, fitWidth));
      const rawOverlap = count > 1 ? (nextCardWidth * count - available) / (count - 1) : 0;
      const maxAllowedOverlap = nextCardWidth * 0.48;
      const overlap = count > 1 ? Math.min(maxAllowedOverlap, Math.max(-6, rawOverlap)) : 0;
      const totalWidth = nextCardWidth * count - overlap * Math.max(0, count - 1);
      const overflowing = totalWidth > available + 1;

      setFan({ overlap, cardWidth: nextCardWidth, overflowing });
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
      <div
        className={`fan-hand ${fan.overflowing ? "fan-hand--overflowing" : ""}`}
        ref={handRef}
        style={fan.cardWidth ? { "--hand-card-width": `${fan.cardWidth}px` } : undefined}
      >
        <AnimatePresence mode="popLayout">
          {cards.map((card, index) => {
            const centerOffset = index - (cards.length - 1) / 2;
            const maxRotation = Math.min(10, Math.max(2, 32 / Math.max(cards.length, 1)));
            const rotation = fan.overflowing ? 0 : centerOffset * maxRotation;
            const y = fan.overflowing ? 0 : Math.abs(centerOffset) * 4;
            const playable = isCardPlayable(card);
            const isSelected = selectedCardId === card.id;
            const isHovered = hoveredCardId === card.id;
            const zIndex = pendingCardId === card.id ? 150 : isSelected ? 120 : isHovered ? 100 : index + 1;

            return (
              <motion.div
                key={card.id}
                className="fan-card-wrap"
                style={{
                  zIndex,
                  marginLeft: index === 0 ? 0 : -fan.overlap
                }}
                  layout="position"
                  transition={{ type: "spring", stiffness: 320, damping: 32 }}
              >
                <PlayingCard
                  card={card}
                   delay={revealDeal ? index * 0.07 : 0}
                  reveal={revealDeal}
                  disabled={!playable}
                  isPlayable={playable}
                  isSelected={isSelected}
                  isDraggable={playable}
                  isPending={pendingCardId === card.id}
                  dropZoneRef={dropZoneRef}
                  rotation={rotation}
                  y={y}
                  onClick={() => handleCardClick(card.id)}
                  onMouseEnter={() => {
                    setHoveredCardId(card.id);
                    if (playable) {
                      playSfx("hover");
                    }
                  }}
                   onMouseLeave={handleCardLeave}
                  onDragStart={() => onDragStateChange?.(true)}
                  onDragEnd={(info, event) => handleDragEnd(card.id, info, event)}
                 />
              </motion.div>
            );
          })}
        </AnimatePresence>


        {cards.length === 0 && <p className="hand-empty">No cards yet.</p>}
      </div>

      <div className="play-action-slot" aria-live="polite">
        <AnimatePresence>
          {selectedCard && !pendingCardId && (
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
        {pendingCardId && <p className="hand-play-pending">Playing card…</p>}
        {playError && <p className="hand-play-error" role="alert">{playError}</p>}
      </div>
    </section>
  );
}
