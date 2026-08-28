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
  onClick,
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
      initial={{ opacity: 0, y: isTableCard ? -18 : 44, rotate: rotation - 8, scale: 0.92 }}
      animate={{ opacity: 1, y, rotate: rotation, scale: isSelected ? 1.09 : 1 }}
      whileHover={!disabled ? { y: y - 22, rotate: rotation * 0.45, scale: isSelected ? 1.12 : 1.05 } : undefined}
      whileTap={!disabled ? { scale: 0.98 } : undefined}
      drag={isDraggable && !disabled}
      dragSnapToOrigin={isDraggable}
      dragElastic={0.18}
      dragMomentum={false}
      whileDrag={{ scale: 1.1, zIndex: 120 }}
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
        {suit.pip}
      </span>
      <span className="card-corner card-corner-bottom">
        <strong>{card.label}</strong>
        <em>{suit.pip}</em>
      </span>
    </motion.button>
  );
}
