import { memo, useEffect, useRef, useState } from "react";
import { animate, motion, useMotionValue, useReducedMotion } from "framer-motion";
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
  isPending = false,
  dropZoneRef,
  rotation = 0,
  y = 0,
  pointerTilt = 0,
  aceKind = null,
  onClick,
  onMouseEnter,
  onMouseLeave,
  onDragStart,
  onDragEnd
}) {
  const reduced = useReducedMotion();
  const [touchPrimary, setTouchPrimary] = useState(() => window.matchMedia("(pointer: coarse)").matches);
  useEffect(() => {
    const query = window.matchMedia("(pointer: coarse)");
    const update = () => setTouchPrimary(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  const canDrag = isDraggable && !touchPrimary;
  const x = useMotionValue(0);
  const dragY = useMotionValue(0);
  const buttonRef = useRef(null);
  const suppressClick = useRef(false);
  const returnTransition = reduced ? { duration: 0 } : { type: "spring", stiffness: 320, damping: 32 };
  useEffect(() => {
    if (!isPending) {
      const horizontal = animate(x, 0, returnTransition);
      const vertical = animate(dragY, isSelected ? y - 18 : y, returnTransition);
      return () => { horizontal.stop(); vertical.stop(); };
    }
  }, [isPending, isSelected, y, reduced]);
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
        isPending ? "is-pending" : "",
        isTableCard && isWinning ? "is-winning" : ""
      ].join(" ")}
      data-card-id={card?.id}
      ref={buttonRef}
      style={{ x, y: dragY, touchAction: canDrag ? "none" : "pan-x pan-y" }}
      disabled={disabled || isTableCard || !onClick}
      onClick={(event) => { if (!suppressClick.current && !isPending) onClick?.(event); }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      initial={
        reduced || isTableCard ? false : { opacity: 0, rotate: rotation }
      }
      animate={{
        opacity: 1,
        rotate: isSelected ? 0 : rotation + pointerTilt,
        zIndex: isSelected ? 140 : undefined
      }}
      whileHover={!disabled && !isPending ? { y: y - 10 } : undefined}
      whileTap={!disabled && !isPending ? { y: y - 12 } : undefined}
      drag={canDrag && !disabled}
      dragSnapToOrigin={false}
      dragElastic={0.08}
      dragMomentum={false}
      dragTransition={{ bounceStiffness: 300, bounceDamping: 30 }}
      whileDrag={{
        zIndex: 150,
        rotate: 0,
        boxShadow: "0 20px 36px rgba(0, 0, 0, 0.46), 0 0 0 2px var(--gold-light)"
      }}
      onDragStart={() => { suppressClick.current = true; onDragStart?.(); }}
      onDragEnd={(event, info) => {
        const accepted = onDragEnd?.(info, event);
        const zone = dropZoneRef?.current;
        if (accepted && zone && buttonRef.current) {
          const target = zone.getBoundingClientRect();
          const cardBounds = buttonRef.current.getBoundingClientRect();
          animate(x, x.get() + target.left + target.width / 2 - cardBounds.left - cardBounds.width / 2, returnTransition);
          animate(dragY, dragY.get() + target.top + target.height / 2 - cardBounds.top - cardBounds.height / 2, returnTransition);
        } else {
          animate(x, 0, returnTransition);
          animate(dragY, y, returnTransition);
        }
        window.setTimeout(() => { suppressClick.current = false; }, 0);
      }}
      transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 300, damping: 30, delay: reveal ? delay : 0 }}
      aria-label={`${altText}${ownerName ? ` played by ${ownerName}` : ""}`}
    >
      <img
        className={`playing-card__art ${faceDown ? "playing-card__art--back" : "playing-card__art--face"}`}
        src={src}
        alt=""
        draggable={false}
      />
      {aceKind && <span className="ace-card-reflection" aria-hidden="true" />}
    </motion.button>
  );
}

export const PlayingCard = memo(PlayingCardComponent);
