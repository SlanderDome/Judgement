// Shared seat helpers. The server exposes `gameConfig.dealerIndex` and
// `gameConfig.currentTurnIndex` as indices into the *seated ring* (occupied seats
// in clockwise order), not into `roomState.players`. Read turn state through
// these helpers so the UI matches the engine.

export const SEAT_COUNT = 10;

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
