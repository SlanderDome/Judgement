const LIVE_PLAY = new Set(["TRICK_PLAYING", "TRICK_COMPLETE"]);

export function roomEventSnapshot(room, connected) {
  const round = `${room.roomId}:${room.gameConfig.roundNumber}`;
  const scope = `${round}:${room.currentRound?.tricksHistory?.length ?? 0}`;
  return {
    round, scope, connected, paused: room.paused === true, status: room.status,
    trump: room.gameConfig.trumpSuit,
    plays: (room.currentRound?.currentTrick?.cardsPlayed ?? []).map(play => ({
      id: `${scope}:${play.playerId}:${play.card.id}`, playerId: play.playerId,
      cardId: play.card.id, value: play.card.value, suit: play.card.suit,
      name: room.players.find(player => player.playerId === play.playerId)?.nickname ?? "Player"
    })),
    bids: { ...room.currentRound?.bids }
  };
}

export function newRoomEvents(previous, next, playerId) {
  if (!previous || !previous.connected || !next.connected || next.paused || previous.round !== next.round) return { aces: [], bid: null };
  const seen = new Set(previous.plays.map(play => play.id));
  const aces = LIVE_PLAY.has(next.status) ? next.plays.filter(play => play.value === 14 && !seen.has(play.id)).map(play => ({
    ...play, scope: next.scope, kind: play.suit === next.trump ? "trump" : "ordinary"
  })) : [];
  const has = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  const bid = previous.status === "BIDDING" && ["BIDDING", "TRICK_PLAYING"].includes(next.status) &&
    !has(previous.bids, playerId) && has(next.bids, playerId)
    ? { id: `${next.round}:bid:${playerId}`, playerId, value: next.bids[playerId] } : null;
  return { aces, bid };
}
