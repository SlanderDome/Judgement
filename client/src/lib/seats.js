// Shared seat helpers. The server exposes `gameConfig.dealerIndex` and
// `gameConfig.currentTurnIndex` as indices into the *seated ring* (occupied seats
// in clockwise order), not into `roomState.players`. Read turn state through
// these helpers so the UI matches the engine.

export const SEAT_COUNT = 8;

export function seatedPlayers(roomState) {
  return roomState.players
    .filter((player) => Number.isInteger(player.seatIndex))
    .sort((a, b) => a.seatIndex - b.seatIndex);
}

export function currentTurnPlayer(roomState) {
  return seatedPlayers(roomState)[roomState.gameConfig.currentTurnIndex] ?? null;
}

export function dealerPlayer(roomState) {
  return seatedPlayers(roomState)[roomState.gameConfig.dealerIndex] ?? null;
}

export function isSeated(player) {
  return Number.isInteger(player?.seatIndex);
}

// Unit vector for where seat `index` sits on the table perimeter — seat 0 at
// top-centre, going clockwise. Shared by CircularTable and the dealing overlay
// so cards fly to exactly where the seats render.
export function seatUnitVector(index, total = SEAT_COUNT) {
  const angle = -Math.PI / 2 + (index / total) * Math.PI * 2;
  return { x: Math.cos(angle), y: Math.sin(angle) };
}

// Rotate the seat ring for one viewer's perspective: the viewer's own seat is
// pulled to the bottom-centre screen slot and every other seat follows, keeping
// clockwise order. Returns the screen slot (0..total-1) to render `seatIndex` at.
// Spectators (no integer viewerSeatIndex) get the ring unrotated.
export function seatDisplaySlot(seatIndex, viewerSeatIndex, total = SEAT_COUNT) {
  if (!Number.isInteger(viewerSeatIndex)) {
    return seatIndex;
  }
  const bottom = Math.round(total / 2);
  return (((seatIndex - viewerSeatIndex + bottom) % total) + total) % total;
}

// The phases where a hand exists on the table (deck rests, fans show).
const ROUND_ACTIVE = new Set([
  "PRE_BIDDING",
  "BIDDING",
  "TRICK_PLAYING",
  "TRICK_COMPLETE",
  "ROUND_SUMMARY"
]);

export function isRoundActive(status) {
  return ROUND_ACTIVE.has(status);
}
