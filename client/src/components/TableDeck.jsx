import { motion } from "framer-motion";
import { CARD_BACK } from "../lib/cards.js";
import { dealerPlayer, isRoundActive, seatDisplaySlot, seatUnitVector, seatedPlayers } from "../lib/seats.js";

export const DEAL_MS = 2500;

// How far from centre (as % of the table) the deck sits at the dealer, and
// where dealt cards land — on the felt in front of the seat ring, not on top of
// the dealer's avatar.
const DEALER_RADIUS = 30;
const LAND_RADIUS = 38;
// Resting spot for the leftover deck: tucked toward the upper-left of the felt,
// clear of the centre trick pile.
const REST_LEFT = 24;
const REST_TOP = 30;

const STACK = 4;
// Cap the number of animated cards regardless of hand size — it just needs to
// read as "cards going around". Keeps big rounds from spawning 40+ motion nodes.
const MAX_FLIGHTS = 24;

function buildFlights(roomState, total, viewerSeat) {
  const seated = seatedPlayers(roomState);
  if (seated.length === 0) return [];
  const dealer = dealerPlayer(roomState);
  const dealerRingIndex = Math.max(0, seated.findIndex((p) => p.playerId === dealer?.playerId));
  // Deal starting with the seat clockwise of the dealer, going around.
  const order = seated.map((_p, i) => seated[(dealerRingIndex + 1 + i) % seated.length]);
  const cardsPer = roomState.gameConfig.cardsInRound || 0;
  const passes = Math.min(cardsPer, Math.max(1, Math.floor(MAX_FLIGHTS / Math.max(order.length, 1))));

  const count = order.length * passes;
  const perDelayMs = Math.min(110, Math.max(26, Math.round((DEAL_MS * 0.8) / Math.max(count, 1))));

  const flights = [];
  let i = 0;
  for (let pass = 0; pass < passes; pass += 1) {
    for (const player of order) {
      const v = seatUnitVector(seatDisplaySlot(player.seatIndex, viewerSeat, total), total);
      flights.push({
        key: `${player.playerId}-${pass}`,
        left: `${(50 + v.x * LAND_RADIUS).toFixed(2)}%`,
        top: `${(50 + v.y * LAND_RADIUS).toFixed(2)}%`,
        rotate: +(v.x * 12).toFixed(1),
        delay: (i++ * perDelayMs) / 1000
      });
    }
  }
  return flights;
}

export function TableDeck({ roomState, dealPhase, total, viewerSeat }) {
  if (!isRoundActive(roomState.status)) {
    return null;
  }

  const dealing = dealPhase === "dealing";
  const dealer = dealerPlayer(roomState);
  const dv = dealer
    ? seatUnitVector(seatDisplaySlot(dealer.seatIndex, viewerSeat, total), total)
    : { x: 0, y: 0.9 };
  const atDealer = {
    left: `${(50 + dv.x * DEALER_RADIUS).toFixed(2)}%`,
    top: `${(50 + dv.y * DEALER_RADIUS).toFixed(2)}%`
  };
  const atRest = { left: `${REST_LEFT}%`, top: `${REST_TOP}%` };

  const flights = dealing ? buildFlights(roomState, total, viewerSeat) : [];

  return (
    <>
      <motion.div
        className={`table-deck ${dealing ? "is-dealing" : "is-resting"}`}
        aria-hidden="true"
        initial={false}
        animate={{
          left: dealing ? atDealer.left : atRest.left,
          top: dealing ? atDealer.top : atRest.top,
          x: "-50%",
          y: "-50%"
        }}
        transition={{ duration: dealing ? 0.18 : 0.55, ease: "easeInOut" }}
      >
        <div className="table-deck__stack">
          {Array.from({ length: STACK }).map((_v, i) => (
            <img
              key={i}
              className="table-deck__card"
              src={CARD_BACK}
              alt=""
              draggable={false}
              style={{ "--i": i }}
            />
          ))}
        </div>
      </motion.div>

      {flights.map((f) => (
        <motion.img
          key={f.key}
          className="deal-fly-card"
          src={CARD_BACK}
          alt=""
          draggable={false}
          initial={{ left: atDealer.left, top: atDealer.top, x: "-50%", y: "-50%", rotate: -6, scale: 0.8, opacity: 0 }}
          animate={{
            left: f.left,
            top: f.top,
            x: "-50%",
            y: "-50%",
            rotate: f.rotate,
            scale: 1,
            opacity: [0, 1, 1, 0.9, 0]
          }}
          transition={{ delay: f.delay, duration: 0.52, times: [0, 0.14, 0.6, 0.85, 1], ease: "easeOut" }}
        />
      ))}
    </>
  );
}
