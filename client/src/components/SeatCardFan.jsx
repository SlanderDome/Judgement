import { memo } from "react";
import { motion } from "framer-motion";
import { CARD_BACK } from "../lib/cards.js";

// A small face-down fan of card backs tucked beside an opponent's seat for the
// round. Purely decorative — the real count lives on the seat badge — so it is
// capped at a few cards regardless of hand size.
const MAX_VISIBLE = 5;

function SeatCardFanComponent({ count, above = false }) {
  const n = Math.min(Math.max(Math.round(count ?? 0), 0), MAX_VISIBLE);
  if (n === 0) {
    return null;
  }

  return (
    <motion.div
      className={`seat-fan ${above ? "seat-fan--above" : ""}`}
      aria-hidden="true"
      initial={{ opacity: 0, scale: 0.85, y: 6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 320, damping: 30 }}
    >
      {Array.from({ length: n }).map((_value, index) => (
        <img
          key={index}
          className="seat-fan__card"
          src={CARD_BACK}
          alt=""
          draggable={false}
          style={{ "--i": index, "--n": n }}
        />
      ))}
    </motion.div>
  );
}

export const SeatCardFan = memo(SeatCardFanComponent);
