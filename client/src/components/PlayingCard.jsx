import { memo } from "react";
import { motion } from "framer-motion";
import { CARD_BACK, getCardAsset } from "../lib/cards.js";

const SUIT_LABEL = {
  SPADES: "Spades",
  DIAMONDS: "Diamonds",
  CLUBS: "Clubs",
  HEARTS: "Hearts"
};

function PlayingCardComponent({
  card,
  ownerName,
  faceDown = false,
  reveal = false,
  delay = 0,
  disabled = false,
  isSelected = false,
  isPlayable = false,
  isTableCard = false,
  isWinning = false,
  isDraggable = false,
  rotation = 0,
  y = 0,
  pointerTilt = 0,
  onClick,
  onMouseEnter,
  onMouseLeave,
  onDragStart,
  onDragEnd
}) {
  const src = faceDown ? CARD_BACK : getCardAsset(card);
  const altText = faceDown
    ? "Face-down card"
    : card
      ? `${card.label} of ${SUIT_LABEL[card.suit] ?? card.suit ?? "Unknown"}`
      : "Playing card";

  return (
    <motion.button
      type="button"
      className={[
        "playing-card",
        isTableCard ? "table-card" : "hand-card",
        faceDown ? "is-face-down" : "",
        isPlayable ? "playable" : "",
        isSelected ? "selected" : "",
        isTableCard && isWinning ? "is-winning" : ""
      ].join(" ")}
      disabled={disabled || isTableCard || !onClick}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      initial={
        reveal
          ? { opacity: 0, y: 30, rotate: rotation, rotateX: 0, rotateY: -82, scale: 0.9 }
          : {
              opacity: 0,
              y: isTableCard ? 28 : 80,
              rotate: isTableCard ? rotation - 8 : rotation,
              rotateX: isTableCard ? 10 : 0,
              scale: isTableCard ? 0.92 : 0.82
            }
      }
      animate={{
        opacity: 1,
        y: isSelected ? y - 34 : y,
        rotate: isSelected ? 0 : rotation + pointerTilt,
        rotateX: isSelected ? -8 : 0,
        rotateY: 0,
        scale: isSelected ? 1.14 : 1,
        zIndex: isSelected ? 140 : undefined
      }}
      whileHover={!disabled ? { y: y - 22, rotate: rotation + pointerTilt * 0.5, scale: 1.06 } : undefined}
      whileTap={!disabled ? { scale: 0.98, y: y - 18 } : undefined}
      drag={isDraggable && !disabled}
      dragSnapToOrigin={isDraggable}
      dragElastic={0.08}
      dragMomentum={false}
      dragTransition={{ bounceStiffness: 300, bounceDamping: 30 }}
      whileDrag={{
        scale: 1.08,
        zIndex: 150,
        rotate: 0,
        rotateX: -10,
        y: 0,
        boxShadow: "0 20px 36px rgba(0, 0, 0, 0.46), 0 0 0 2px var(--gold-light)"
      }}
      onDragStart={onDragStart}
      onDragEnd={(event, info) => onDragEnd?.(info)}
      transition={{ type: "spring", stiffness: 300, damping: 30, delay }}
      aria-label={`${altText}${ownerName ? ` played by ${ownerName}` : ""}`}
    >
      <img
        className={`playing-card__art ${faceDown ? "playing-card__art--back" : "playing-card__art--face"}`}
        src={src}
        alt=""
        draggable={false}
      />
    </motion.button>
  );
}

export const PlayingCard = memo(PlayingCardComponent);
