import { dealCards, getMaxCardsForPlayers, getTrumpSuit, normalizeSuit } from "./rules.js";

export const ROOM_STATUS = {
  LOBBY: "LOBBY",
  PRE_BIDDING: "PRE_BIDDING",
  BIDDING: "BIDDING",
  TRICK_PLAYING: "TRICK_PLAYING",
  TRICK_COMPLETE: "TRICK_COMPLETE",
  ROUND_SUMMARY: "ROUND_SUMMARY",
  GAME_OVER: "GAME_OVER"
};

const TURN_TIMEOUT_MS = 20000;
const BID_TIMEOUT_MS = 30000;
// After cards are dealt, bidding starts automatically once this countdown ends —
// no host action required.
const PRE_BIDDING_TIMEOUT_MS = 30000;
// The completed trick stays face-up for this long so everyone sees the last card
// before it clears to the winner.
const TRICK_REVEAL_MS = 10000;
// The scoreboard shows for this long, then the next round starts automatically.
const ROUND_SUMMARY_MS = 15000;

export const SEAT_COUNT = 8;

export function createPlayer({ playerId, nickname, socketId, seatIndex = null, isAdmin = false }) {
  return {
    playerId,
    nickname,
    socketId,
    seatIndex,
    isAdmin,
    isOnline: true,
    isActiveInGame: true,
    score: 0,
    hand: [],
    currentBid: null,
    tricksWon: 0
  };
}

export function createRoom({ roomId, player }) {
  return {
    roomId,
    adminPlayerId: player.playerId,
    status: ROOM_STATUS.LOBBY,
    seatCount: SEAT_COUNT,
    players: [player],
    gameConfig: {
      phase: "ASCENDING",
      roundNumber: 1,
      cardsInRound: 0,
      maxCards: 1,
      trumpSuit: null,
      dealerIndex: 0,
      currentTurnIndex: 0
    },
    currentRound: {
      bids: {},
      forbiddenBidForFinalPlayer: null,
      currentTrick: {
        leadSuit: null,
        cardsPlayed: []
      },
      tricksHistory: []
    },
    timer: {
      endsAt: null,
      durationMs: null
    },
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
}

function createEmptyCurrentRound() {
  return {
    bids: {},
    forbiddenBidForFinalPlayer: null,
    currentTrick: {
      leadSuit: null,
      cardsPlayed: [],
      winnerPlayerId: null
    },
    tricksHistory: [],
    lastTrick: null,
    roundSummary: null
  };
}

function scorePlayerForRound(player) {
  if (player.currentBid === 0 && player.tricksWon === 0) {
    return 10;
  }

  if (player.currentBid > 0 && player.currentBid === player.tricksWon) {
    return player.currentBid * 10;
  }

  return 0;
}

function buildNextRoundConfig(room) {
  const { phase, cardsInRound, maxCards } = room.gameConfig;

  if (phase === "ASCENDING") {
    if (cardsInRound >= maxCards) {
      return {
        phase: "DESCENDING",
        cardsInRound: maxCards
      };
    }

    return {
      phase: "ASCENDING",
      cardsInRound: cardsInRound + 1
    };
  }

  if (cardsInRound <= 1) {
    return null;
  }

  return {
    phase: "DESCENDING",
    cardsInRound: cardsInRound - 1
  };
}

function dealRound(room) {
  // Deal around the occupied seats starting from the seat right of the dealer.
  const ring = getSeatedPlayers(room);
  const start = firstActorIndex(room);
  const dealOrder = ring.map((_player, offset) => ring[(start + offset) % ring.length]);
  const hands = dealCards(dealOrder, room.gameConfig.cardsInRound);

  room.players.forEach((player) => {
    player.hand = hands.get(player.playerId) ?? [];
    player.currentBid = null;
    player.tricksWon = 0;
    player.isActiveInGame = true;
  });
}

function prepareRound(room) {
  room.status = ROOM_STATUS.PRE_BIDDING;
  room.currentRound = createEmptyCurrentRound();
  room.gameConfig.currentTurnIndex = firstActorIndex(room);
  // Countdown to the automatic bidding start (handleTurnTimeout advances it).
  room.timer = { endsAt: Date.now() + PRE_BIDDING_TIMEOUT_MS, durationMs: PRE_BIDDING_TIMEOUT_MS };
  dealRound(room);
  room.updatedAt = Date.now();
  return room;
}

export function startBidding(room) {
  if (room.status !== ROOM_STATUS.PRE_BIDDING) {
    throw new Error("Bidding cannot be started right now.");
  }

  room.status = ROOM_STATUS.BIDDING;
  room.gameConfig.currentTurnIndex = firstActorIndex(room);
  room.timer = { endsAt: Date.now() + BID_TIMEOUT_MS, durationMs: BID_TIMEOUT_MS };
  room.updatedAt = Date.now();
  return room;
}

export function attachPlayerToRoom(room, player) {
  // New arrivals join as spectators (no seat) until they pick one in the lobby.
  room.players.push(player);
  room.updatedAt = Date.now();
  return room;
}

export function markPlayerDisconnected(room, socketId) {
  const player = room.players.find((entry) => entry.socketId === socketId);

  if (!player) {
    return null;
  }

  player.isOnline = false;
  player.socketId = null;
  room.updatedAt = Date.now();
  return player;
}

export function reconnectPlayer(room, playerId, socketId, nickname) {
  const player = room.players.find((entry) => entry.playerId === playerId);

  if (!player) {
    return null;
  }

  player.socketId = socketId;
  player.isOnline = true;
  if (nickname?.trim()) {
    player.nickname = nickname.trim().slice(0, 24);
  }
  room.updatedAt = Date.now();
  return player;
}

export function startGame(room, options = {}) {
  const seated = getSeatedPlayers(room);
  room.gameConfig.maxCards = getMaxCardsForPlayers(seated.length);
  room.gameConfig.phase = "ASCENDING";
  room.gameConfig.cardsInRound = options.cardsInRound ? Math.min(Math.max(1, Number(options.cardsInRound)), room.gameConfig.maxCards) : 1;
  room.gameConfig.roundNumber = 1;
  room.gameConfig.trumpSuit = normalizeSuit(options.trumpSuit) || getTrumpSuit(1);
  room.gameConfig.dealerIndex = 0;
  return prepareRound(room);
}

// The occupied seats, in clockwise order. This ring is the single source of turn
// order: empty seats are simply absent. `gameConfig.dealerIndex` and
// `currentTurnIndex` are indices into this array, not into `room.players`.
export function getSeatedPlayers(room) {
  return room.players
    .filter((player) => Number.isInteger(player.seatIndex))
    .sort((a, b) => a.seatIndex - b.seatIndex);
}

function ringLength(room) {
  return getSeatedPlayers(room).length;
}

function isSeated(room, playerId) {
  return Number.isInteger(room.players.find((player) => player.playerId === playerId)?.seatIndex);
}

// Play proceeds clockwise around the occupied seats. The first actor each round
// is the seat immediately clockwise of the dealer ("right of the dealer"), so
// the dealer is the last to bid.
function firstActorIndex(room) {
  const len = ringLength(room);
  return len ? (room.gameConfig.dealerIndex + 1) % len : 0;
}

export function getCurrentPlayer(room) {
  return getSeatedPlayers(room)[room.gameConfig.currentTurnIndex] ?? null;
}

export function getBiddingContext(room) {
  const currentBidTotal = Object.values(room.currentRound.bids).reduce((sum, bid) => sum + bid, 0);
  const totalTricks = room.gameConfig.cardsInRound;
  const forbiddenBidForFinalPlayer = totalTricks - currentBidTotal;
  const currentPlayer = getCurrentPlayer(room);
  // The dealer bids last, so the current bidder faces the closing-bid ban only
  // when it is the dealer's turn.
  const isFinalBidder =
    !!room.currentRound &&
    ringLength(room) > 0 &&
    room.gameConfig.currentTurnIndex === room.gameConfig.dealerIndex;

  return {
    currentBidTotal,
    forbiddenBidForFinalPlayer: isFinalBidder ? forbiddenBidForFinalPlayer : null,
    currentPlayer
  };
}

export function getLegalBids(room) {
  const currentPlayer = getCurrentPlayer(room);
  if (!currentPlayer) {
    return [];
  }

  const { forbiddenBidForFinalPlayer } = getBiddingContext(room);
  const bids = [];

  for (let bid = 0; bid <= room.gameConfig.cardsInRound; bid += 1) {
    if (forbiddenBidForFinalPlayer !== null && bid === forbiddenBidForFinalPlayer) {
      continue;
    }

    bids.push(bid);
  }

  return bids;
}

export function submitBid(room, playerId, bid) {
  if (room.status !== ROOM_STATUS.BIDDING) {
    throw new Error("Bidding is not open.");
  }

  if (!isSeated(room, playerId)) {
    throw new Error("You are not seated.");
  }

  const currentPlayer = getCurrentPlayer(room);
  if (!currentPlayer || currentPlayer.playerId !== playerId) {
    throw new Error("It is not your turn to bid.");
  }

  const normalizedBid = Number(bid);
  if (!Number.isInteger(normalizedBid) || normalizedBid < 0 || normalizedBid > room.gameConfig.cardsInRound) {
    throw new Error("Bid out of range.");
  }

  const { forbiddenBidForFinalPlayer } = getBiddingContext(room);
  if (forbiddenBidForFinalPlayer !== null && normalizedBid === forbiddenBidForFinalPlayer) {
    throw new Error("Forbidden bid for the final bidder.");
  }

  room.currentRound.bids[playerId] = normalizedBid;
  currentPlayer.currentBid = normalizedBid;

  const biddingComplete = room.gameConfig.currentTurnIndex === room.gameConfig.dealerIndex;
  if (biddingComplete) {
    room.status = ROOM_STATUS.TRICK_PLAYING;
    // Trick 1 is led by the seat immediately clockwise of the dealer — and that
    // leader gets the same turn timer / auto-play as every other player.
    room.gameConfig.currentTurnIndex = firstActorIndex(room);
    room.timer = { endsAt: Date.now() + TURN_TIMEOUT_MS, durationMs: TURN_TIMEOUT_MS };
  } else {
    room.gameConfig.currentTurnIndex = (room.gameConfig.currentTurnIndex + 1) % ringLength(room);
    room.timer.endsAt = Date.now() + BID_TIMEOUT_MS;
    room.timer.durationMs = BID_TIMEOUT_MS;
  }

  room.currentRound.forbiddenBidForFinalPlayer =
    room.status === ROOM_STATUS.BIDDING ? getBiddingContext(room).forbiddenBidForFinalPlayer : null;
  room.updatedAt = Date.now();
  return room;
}

function cardStrength(cardPlayed, leadSuit, trumpSuit) {
  const { card } = cardPlayed;

  if (card.suit === trumpSuit) {
    return 300 + card.value;
  }

  if (card.suit === leadSuit) {
    return 200 + card.value;
  }

  return card.value;
}

function trickWinningPlay(room) {
  const { leadSuit, cardsPlayed } = room.currentRound.currentTrick;
  const trumpSuit = room.gameConfig.trumpSuit;
  let winningPlay = cardsPlayed[0];

  for (let index = 1; index < cardsPlayed.length; index += 1) {
    const contender = cardsPlayed[index];
    if (cardStrength(contender, leadSuit, trumpSuit) > cardStrength(winningPlay, leadSuit, trumpSuit)) {
      winningPlay = contender;
    }
  }

  return winningPlay;
}

// The last card has just been played. Freeze the full trick face-up (with the
// winner marked) and start the reveal countdown; resolveTrick() runs when it ends.
function completeTrick(room) {
  const winningPlay = trickWinningPlay(room);
  room.currentRound.currentTrick.winnerPlayerId = winningPlay.playerId;
  room.status = ROOM_STATUS.TRICK_COMPLETE;
  room.timer = { endsAt: Date.now() + TRICK_REVEAL_MS, durationMs: TRICK_REVEAL_MS };
  room.updatedAt = Date.now();
  return room;
}

function resolveTrick(room) {
  const { leadSuit, cardsPlayed } = room.currentRound.currentTrick;
  const winningPlay = trickWinningPlay(room);

  const winner = room.players.find((player) => player.playerId === winningPlay.playerId);
  if (!winner) {
    throw new Error("Unable to resolve trick winner.");
  }

  winner.tricksWon += 1;

  room.currentRound.tricksHistory.push({
    leadSuit,
    cardsPlayed,
    winnerPlayerId: winner.playerId,
    winningCard: winningPlay.card
  });

  room.currentRound.lastTrick = {
    leadSuit,
    winnerPlayerId: winner.playerId,
    winningCard: winningPlay.card
  };

  const roundComplete = room.currentRound.tricksHistory.length >= room.gameConfig.cardsInRound;
  const ring = getSeatedPlayers(room);

  if (roundComplete) {
    ring.forEach((player) => {
      player.score += scorePlayerForRound(player);
    });

    room.currentRound.roundSummary = {
      scores: ring.map((player) => ({
        playerId: player.playerId,
        nickname: player.nickname,
        score: player.score,
        bid: player.currentBid,
        tricksWon: player.tricksWon
      }))
    };
    room.status = ROOM_STATUS.ROUND_SUMMARY;
    // Scoreboard is shown, then the next round starts automatically.
    room.timer = { endsAt: Date.now() + ROUND_SUMMARY_MS, durationMs: ROUND_SUMMARY_MS };
  } else {
    room.currentRound.currentTrick = {
      leadSuit: null,
      cardsPlayed: [],
      winnerPlayerId: null
    };
    room.status = ROOM_STATUS.TRICK_PLAYING;
    room.gameConfig.currentTurnIndex = ring.findIndex((player) => player.playerId === winner.playerId);
    room.timer = { endsAt: Date.now() + TURN_TIMEOUT_MS, durationMs: TURN_TIMEOUT_MS };
  }

  room.updatedAt = Date.now();
  return room;
}

export function playCard(room, playerId, cardId) {
  if (room.status !== ROOM_STATUS.TRICK_PLAYING) {
    throw new Error("Cards cannot be played right now.");
  }

  if (!isSeated(room, playerId)) {
    throw new Error("You are not seated.");
  }

  const currentPlayer = getCurrentPlayer(room);
  if (!currentPlayer || currentPlayer.playerId !== playerId) {
    throw new Error("It is not your turn to play.");
  }

  const cardIndex = currentPlayer.hand.findIndex((card) => card.id === cardId);
  if (cardIndex < 0) {
    throw new Error("That card is not in your hand.");
  }

  const selectedCard = currentPlayer.hand[cardIndex];
  const leadSuit = room.currentRound.currentTrick.leadSuit;
  const hasLeadSuit = leadSuit ? currentPlayer.hand.some((card) => card.suit === leadSuit) : false;
  if (leadSuit && hasLeadSuit && selectedCard.suit !== leadSuit) {
    throw new Error("You must follow the led suit.");
  }

  currentPlayer.hand.splice(cardIndex, 1);

  if (!room.currentRound.currentTrick.leadSuit) {
    room.currentRound.currentTrick.leadSuit = selectedCard.suit;
  }

  room.currentRound.currentTrick.cardsPlayed.push({
    playerId,
    card: selectedCard
  });

  const trickComplete = room.currentRound.currentTrick.cardsPlayed.length >= ringLength(room);

  if (trickComplete) {
    return completeTrick(room);
  }

  room.gameConfig.currentTurnIndex = (room.gameConfig.currentTurnIndex + 1) % ringLength(room);
  room.timer.endsAt = Date.now() + TURN_TIMEOUT_MS;
  room.timer.durationMs = TURN_TIMEOUT_MS;
  room.updatedAt = Date.now();
  return room;
}

export function getLegalCards(room, player = getCurrentPlayer(room)) {
  if (!player) {
    return [];
  }

  const leadSuit = room.currentRound.currentTrick.leadSuit;
  if (!leadSuit) {
    return [...player.hand];
  }

  const matchingCards = player.hand.filter((card) => card.suit === leadSuit);
  return matchingCards.length > 0 ? matchingCards : [...player.hand];
}

export function selectLowestRiskCard(room, cards) {
  if (cards.length === 0) {
    return null;
  }

  const trumpSuit = room.gameConfig.trumpSuit;
  return [...cards].sort((left, right) => {
    const leftWeight = (left.suit === trumpSuit ? 100 : 0) + left.value;
    const rightWeight = (right.suit === trumpSuit ? 100 : 0) + right.value;
    return leftWeight - rightWeight;
  })[0];
}

export function handleTurnTimeout(room) {
  if (room.status === ROOM_STATUS.PRE_BIDDING) {
    // Countdown finished — start bidding automatically.
    return startBidding(room);
  }

  if (room.status === ROOM_STATUS.TRICK_COMPLETE) {
    // Reveal window over — award the trick and move on.
    return resolveTrick(room);
  }

  if (room.status === ROOM_STATUS.ROUND_SUMMARY) {
    // Scoreboard shown long enough — advance to the next round automatically.
    return advanceRound(room, {});
  }

  if (room.status === ROOM_STATUS.BIDDING) {
    const currentPlayer = getCurrentPlayer(room);
    if (!currentPlayer) {
      return room;
    }

    const legalBids = getLegalBids(room);
    if (legalBids.length === 0) {
      return room;
    }

    return submitBid(room, currentPlayer.playerId, legalBids[0]);
  }

  if (room.status === ROOM_STATUS.TRICK_PLAYING) {
    const currentPlayer = getCurrentPlayer(room);
    if (!currentPlayer) {
      return room;
    }

    const legalCards = getLegalCards(room, currentPlayer);
    const selectedCard = selectLowestRiskCard(room, legalCards);
    if (!selectedCard) {
      return room;
    }

    return playCard(room, currentPlayer.playerId, selectedCard.id);
  }

  return room;
}

export function advanceRound(room, options = {}) {
  if (room.status !== ROOM_STATUS.ROUND_SUMMARY) {
    throw new Error("Round progression is not available right now.");
  }

  if (options.action === "end_game") {
    room.status = ROOM_STATUS.GAME_OVER;
    room.timer.endsAt = null;
    room.updatedAt = Date.now();
    return room;
  }

  const nextRoundNumber = room.gameConfig.roundNumber + 1;
  const seatedCount = getSeatedPlayers(room).length || 1;
  const maxAllowed = getMaxCardsForPlayers(seatedCount);

  let nextCards = options.cardsInRound ? Number(options.cardsInRound) : null;
  let nextPhase = room.gameConfig.phase;

  if (!nextCards) {
    const nextRoundConfig = buildNextRoundConfig(room);
    if (!nextRoundConfig) {
      room.status = ROOM_STATUS.GAME_OVER;
      room.timer.endsAt = null;
      room.updatedAt = Date.now();
      return room;
    }
    nextCards = nextRoundConfig.cardsInRound;
    nextPhase = nextRoundConfig.phase;
  }

  nextCards = Math.min(Math.max(1, nextCards), maxAllowed);

  room.gameConfig.roundNumber = nextRoundNumber;
  room.gameConfig.maxCards = maxAllowed;
  room.gameConfig.phase = nextPhase;
  room.gameConfig.cardsInRound = nextCards;
  room.gameConfig.trumpSuit = normalizeSuit(options.trumpSuit) || getTrumpSuit(nextRoundNumber);
  room.gameConfig.dealerIndex = (room.gameConfig.dealerIndex + 1) % seatedCount;
  return prepareRound(room);
}

export function takeSeat(room, playerId, seatIndex) {
  if (room.status !== ROOM_STATUS.LOBBY) {
    throw new Error("Seats are locked once the game starts.");
  }

  const player = room.players.find((entry) => entry.playerId === playerId);
  if (!player) {
    throw new Error("You are not in this room.");
  }

  const seat = Number(seatIndex);
  if (!Number.isInteger(seat) || seat < 0 || seat >= room.seatCount) {
    throw new Error("That seat does not exist.");
  }

  const occupant = room.players.find(
    (entry) => entry.playerId !== playerId && entry.seatIndex === seat
  );
  if (occupant) {
    throw new Error("That seat is taken.");
  }

  player.seatIndex = seat;
  room.gameConfig.maxCards = getMaxCardsForPlayers(getSeatedPlayers(room).length || 1);
  room.updatedAt = Date.now();
  return room;
}

export function leaveSeat(room, playerId) {
  if (room.status !== ROOM_STATUS.LOBBY) {
    throw new Error("Seats are locked once the game starts.");
  }

  const player = room.players.find((entry) => entry.playerId === playerId);
  if (!player) {
    throw new Error("You are not in this room.");
  }

  player.seatIndex = null;
  room.gameConfig.maxCards = getMaxCardsForPlayers(getSeatedPlayers(room).length || 1);
  room.updatedAt = Date.now();
  return room;
}

export function reorderPlayers(room, orderedPlayerIds) {
  if (room.status !== ROOM_STATUS.LOBBY) {
    throw new Error("Playing order is locked once the game starts.");
  }

  if (!Array.isArray(orderedPlayerIds)) {
    throw new Error("Invalid playing order.");
  }

  const seated = getSeatedPlayers(room);
  const seatedIds = seated.map((player) => player.playerId);
  const isPermutation =
    orderedPlayerIds.length === seatedIds.length &&
    orderedPlayerIds.every((id) => seatedIds.includes(id));

  if (!isPermutation) {
    throw new Error("Playing order must include every seated player exactly once.");
  }

  // Re-assign the occupied seat numbers to players in the requested order.
  const occupiedSeats = seated.map((player) => player.seatIndex);
  const playersById = new Map(room.players.map((player) => [player.playerId, player]));
  orderedPlayerIds.forEach((id, index) => {
    playersById.get(id).seatIndex = occupiedSeats[index];
  });

  room.updatedAt = Date.now();
  return room;
}

export function resetRoom(room) {
  room.status = ROOM_STATUS.LOBBY;
  room.gameConfig.phase = "ASCENDING";
  room.gameConfig.roundNumber = 1;
  room.gameConfig.cardsInRound = 0;
  room.gameConfig.currentTurnIndex = 0;
  room.gameConfig.dealerIndex = 0;
  room.gameConfig.trumpSuit = null;
  room.currentRound = createEmptyCurrentRound();
  room.timer = {
    endsAt: null
  };
  room.players.forEach((player) => {
    player.hand = [];
    player.currentBid = null;
    player.tricksWon = 0;
    player.score = 0;
    player.isActiveInGame = true;
  });
  room.updatedAt = Date.now();
  return room;
}

export function sanitizeRoomForPlayer(room, playerId) {
  return {
    roomId: room.roomId,
    adminPlayerId: room.adminPlayerId,
    status: room.status,
    seatCount: room.seatCount ?? SEAT_COUNT,
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
    gameConfig: room.gameConfig,
    currentRound: room.currentRound,
    timer: room.timer,
    players: room.players.map((player) => ({
      playerId: player.playerId,
      nickname: player.nickname,
      seatIndex: player.seatIndex,
      isAdmin: player.isAdmin,
      isOnline: player.isOnline,
      isActiveInGame: player.isActiveInGame,
      score: player.score,
      currentBid: player.currentBid,
      tricksWon: player.tricksWon,
      handCount: player.hand.length,
      hand: player.playerId === playerId ? player.hand : []
    }))
  };
}
