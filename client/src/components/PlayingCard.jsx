import { motion } from "framer-motion";

const SUIT_META = {
  SPADES: { pip: "♠", label: "Spades", tone: "black" },
  DIAMONDS: { pip: "♦", label: "Diamonds", tone: "red" },
  CLUBS: { pip: "♣", label: "Clubs", tone: "black" },
  HEARTS: { pip: "♥", label: "Hearts", tone: "red" }
};

const FACE_RANKS = new Set(["J", "Q", "K", "A"]);

export function PlayingCard({
  card,
  ownerName,
  delay = 0,
  disabled = false,
  isSelected = false,
  isPlayable = false,
  isTableCard = false,
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
  const suit = SUIT_META[card.suit] ?? {
    pip: card.suit?.[0] ?? "?",
    label: card.suit ?? "Unknown",
    tone: "black"
  };
  const isFace = FACE_RANKS.has(card.label);

  return (
    <motion.button
      type="button"
      className={[
        "playing-card",
        `tone-${suit.tone}`,
        isTableCard ? "table-card" : "hand-card",
        isFace ? "is-face" : "",
        isPlayable ? "playable" : "",
        isSelected ? "selected" : ""
      ].join(" ")}
      disabled={disabled || isTableCard || !onClick}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      layoutId={card.id}
      initial={{
        opacity: 0,
        y: isTableCard ? 28 : 80,
        rotate: isTableCard ? rotation - 8 : rotation,
        rotateX: isTableCard ? 10 : 0,
        scale: isTableCard ? 0.92 : 0.82
      }}
      animate={{
        opacity: 1,
        y: isSelected ? y - 34 : y,
        rotate: isSelected ? 0 : rotation + pointerTilt,
        rotateX: isSelected ? -8 : 0,
        scale: isSelected ? 1.14 : 1,
        zIndex: isSelected ? 140 : undefined
      }}
      whileHover={!disabled ? { y: y - 38, rotate: rotation + pointerTilt * 0.5, scale: 1.13 } : undefined}
      whileTap={!disabled ? { scale: 0.98, y: y - 18 } : undefined}
      drag={isDraggable && !disabled}
      dragSnapToOrigin={isDraggable}
      dragElastic={0.16}
      dragMomentum={false}
      whileDrag={{
        scale: 1.14,
        zIndex: 150,
        rotate: 0,
        rotateX: -10,
        y: 0,
        boxShadow: "0 24px 48px rgba(0, 0, 0, 0.5), 0 0 0 3px var(--gold)"
      }}
      onDragStart={onDragStart}
      onDragEnd={(event, info) => onDragEnd?.(info)}
      transition={{ type: "spring", stiffness: 360, damping: 28, delay }}
      layout
      aria-label={`${card.label} of ${suit.label}${ownerName ? ` played by ${ownerName}` : ""}`}
    >
      <span className="card-corner">
        <strong>{card.label}</strong>
        <em>{suit.pip}</em>
      </span>
      <span className="card-art" aria-hidden="true">
        {isFace ? card.label : suit.pip}
      </span>
      <span className="card-corner card-corner-bottom">
        <strong>{card.label}</strong>
        <em>{suit.pip}</em>
      </span>
    </motion.button>
  );
}
