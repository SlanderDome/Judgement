import { currentTurnPlayer } from "./seats.js";

export function getBidChoices(roomState) {
  const count = roomState.gameConfig?.cardsInRound;
  return Number.isInteger(count) && count >= 1 ? Array.from({ length: count + 1 }, (_, bid) => bid) : [];
}

export function getForbiddenBid(roomState) {
  // The server decides who is the final bidder, including inactive/reserved seats.
  const forbidden = roomState.currentRound?.forbiddenBidForFinalPlayer;
  return Number.isInteger(forbidden) ? forbidden : null;
}

export function canConfirmBid(roomState, playerId, bid, connected, pending = false, now = Date.now()) {
  return connected && !pending && roomState.status === "BIDDING" && !roomState.paused &&
    currentTurnPlayer(roomState)?.playerId === playerId && Number.isInteger(bid) &&
    bid >= 0 && bid <= roomState.gameConfig.cardsInRound && bid !== getForbiddenBid(roomState) &&
    !Object.prototype.hasOwnProperty.call(roomState.currentRound?.bids ?? {}, playerId) &&
    (roomState.timer?.endsAt == null || roomState.timer.endsAt > now);
}
