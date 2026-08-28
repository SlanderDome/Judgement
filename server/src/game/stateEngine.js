import { dealCards, getMaxCardsForPlayers, getTrumpSuit, normalizeSuit } from "./rules.js";

export const ROOM_STATUS = {
  LOBBY: "LOBBY",
  PRE_BIDDING: "PRE_BIDDING",
  BIDDING: "BIDDING",
  TRICK_PLAYING: "TRICK_PLAYING",
  ROUND_SUMMARY: "ROUND_SUMMARY",
  GAME_OVER: "GAME_OVER"
};

const TURN_TIMEOUT_MS = 20000;

export function createPlayer({ playerId, nickname, socketId, seatIndex }) {
  return {
    playerId,
    nickname,
    socketId,
    seatIndex,
    isAdmin: seatIndex === 0,
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
      endsAt: null
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
      cardsPlayed: []
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
  const hands = dealCards(room.players, room.gameConfig.cardsInRound);

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
  room.gameConfig.currentTurnIndex = room.gameConfig.dealerIndex;
  room.timer = { endsAt: null };
  dealRound(room);
  room.updatedAt = Date.now();
  return room;
}

export function startBidding(room) {
  if (room.status !== ROOM_STATUS.PRE_BIDDING) {
    throw new Error("Bidding cannot be started right now.");
  }

  room.status = ROOM_STATUS.BIDDING;
  room.gameConfig.currentTurnIndex = room.gameConfig.dealerIndex;
  room.timer = { endsAt: Date.now() + TURN_TIMEOUT_MS };
  room.updatedAt = Date.now();
  return room;
}

export function attachPlayerToRoom(room, player) {
  room.players.push(player);
  room.gameConfig.maxCards = getMaxCardsForPlayers(room.players.length);
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
  const activePlayers = room.players.filter((player) => player.isOnline || room.status !== ROOM_STATUS.LOBBY);
  room.gameConfig.maxCards = getMaxCardsForPlayers(activePlayers.length);
  room.gameConfig.phase = "ASCENDING";
  room.gameConfig.cardsInRound = options.cardsInRound ? Math.min(Math.max(1, Number(options.cardsInRound)), room.gameConfig.maxCards) : 1;
  room.gameConfig.roundNumber = 1;
  room.gameConfig.trumpSuit = normalizeSuit(options.trumpSuit) || getTrumpSuit(1);
  room.gameConfig.dealerIndex = 0;
  return prepareRound(room);
}

export function getCurrentPlayer(room) {
  return room.players[room.gameConfig.currentTurnIndex] ?? null;
}

export function getBiddingContext(room) {
  const currentBidTotal = Object.values(room.currentRound.bids).reduce((sum, bid) => sum + bid, 0);
  const totalTricks = room.gameConfig.cardsInRound;
  const forbiddenBidForFinalPlayer = totalTricks - currentBidTotal;
  const currentPlayer = getCurrentPlayer(room);
  const isFinalBidder = room.currentRound && Object.keys(room.currentRound.bids).length === room.players.length - 1;

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

  const nextTurnIndex = room.gameConfig.currentTurnIndex + 1;
  if (nextTurnIndex >= room.players.length) {
    room.status = ROOM_STATUS.TRICK_PLAYING;
    room.gameConfig.currentTurnIndex = room.gameConfig.dealerIndex;
    room.timer.endsAt = null;
  } else {
    room.gameConfig.currentTurnIndex = nextTurnIndex;
    room.timer.endsAt = Date.now() + TURN_TIMEOUT_MS;
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

function resolveTrick(room) {
  const { leadSuit, cardsPlayed } = room.currentRound.currentTrick;
  const trumpSuit = room.gameConfig.trumpSuit;
  let winningPlay = cardsPlayed[0];

  for (let index = 1; index < cardsPlayed.length; index += 1) {
    const contender = cardsPlayed[index];
    if (cardStrength(contender, leadSuit, trumpSuit) > cardStrength(winningPlay, leadSuit, trumpSuit)) {
      winningPlay = contender;
    }
  }

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

  if (roundComplete) {
    room.players.forEach((player) => {
      player.score += scorePlayerForRound(player);
    });

    room.currentRound.roundSummary = {
      scores: room.players.map((player) => ({
        playerId: player.playerId,
        nickname: player.nickname,
        score: player.score,
        bid: player.currentBid,
        tricksWon: player.tricksWon
      }))
    };
    room.status = ROOM_STATUS.ROUND_SUMMARY;
    room.timer.endsAt = null;
  } else {
    room.currentRound.currentTrick = {
      leadSuit: null,
      cardsPlayed: []
    };
    room.gameConfig.currentTurnIndex = room.players.indexOf(winner);
    room.timer.endsAt = Date.now() + TURN_TIMEOUT_MS;
  }

  room.updatedAt = Date.now();
  return room;
}

export function playCard(room, playerId, cardId) {
  if (room.status !== ROOM_STATUS.TRICK_PLAYING) {
    throw new Error("Cards cannot be played right now.");
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

  const trickComplete = room.currentRound.currentTrick.cardsPlayed.length >= room.players.length;

  if (trickComplete) {
    return resolveTrick(room);
  }

  room.gameConfig.currentTurnIndex = (room.gameConfig.currentTurnIndex + 1) % room.players.length;
  room.timer.endsAt = Date.now() + TURN_TIMEOUT_MS;
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
  const activePlayersCount = room.players.filter((p) => p.isOnline || p.isActiveInGame).length || room.players.length;
  const maxAllowed = getMaxCardsForPlayers(activePlayersCount);

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
  room.gameConfig.dealerIndex = (room.gameConfig.dealerIndex + 1) % room.players.length;
  return prepareRound(room);
}

export function reorderPlayers(room, orderedPlayerIds) {
  if (!Array.isArray(orderedPlayerIds)) {
    throw new Error("Invalid playing order.");
  }

  const currentIds = room.players.map((player) => player.playerId);
  const isPermutation =
    orderedPlayerIds.length === currentIds.length &&
    orderedPlayerIds.every((id) => currentIds.includes(id));

  if (!isPermutation) {
    throw new Error("Playing order must include every player exactly once.");
  }

  const allowedStatuses = [ROOM_STATUS.LOBBY, ROOM_STATUS.PRE_BIDDING, ROOM_STATUS.ROUND_SUMMARY];
  if (!allowedStatuses.includes(room.status)) {
    throw new Error("Playing order can only be changed between rounds.");
  }

  const leaderId = room.players[room.gameConfig.dealerIndex]?.playerId;
  const currentId = room.players[room.gameConfig.currentTurnIndex]?.playerId;
  const playersById = new Map(room.players.map((player) => [player.playerId, player]));

  room.players = orderedPlayerIds.map((id) => playersById.get(id));
  room.players.forEach((player, index) => {
    player.seatIndex = index;
  });

  if (leaderId) {
    room.gameConfig.dealerIndex = room.players.findIndex((player) => player.playerId === leaderId);
  }

  if (currentId) {
    const nextIndex = room.players.findIndex((player) => player.playerId === currentId);
    room.gameConfig.currentTurnIndex = nextIndex >= 0 ? nextIndex : 0;
  }

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
