import crypto from "node:crypto";
import {
  attachPlayerToRoom,
  admitNextRound,
  configureNextRound,
  advanceRound,
  createPlayer,
  createRoom,
  getBiddingContext,
  getSeatedPlayers,
  getNextRoundPlayers,
  getNextRoundSetup,
  leaveSeat as leaveRoomSeat,
  markPlayerLeft,
  markPlayerDisconnected,
  removePlayer,
  reconnectPlayer,
  playCard,
  reorderPlayers as reorderRoomPlayers,
  sanitizeRoomForPlayer,
  resetRoom,
  startBidding as startBiddingPhase,
  startGame,
  submitBid,
  takeSeat as takeRoomSeat,
  togglePause
} from "./stateEngine.js";

const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function checkHostAction(room, playerId, context = {}) {
  if (!room) throw new Error("Room not found.");
  if (room.adminPlayerId !== playerId) throw new Error("Only the host can manage this table.");
  if ((context.expectedRound !== undefined && context.expectedRound !== room.gameConfig.roundNumber) ||
      (context.expectedStatus !== undefined && context.expectedStatus !== room.status)) {
    throw new Error("The round or game phase changed. Review the current controls and try again.");
  }
}

function createRoomCode() {
  let roomCode = "";

  for (let index = 0; index < 6; index += 1) {
    roomCode += ROOM_CODE_ALPHABET[Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)];
  }

  return roomCode;
}

function normalizeNickname(nickname, playerCount = 0) {
  const trimmed = nickname?.trim();
  if (trimmed) {
    return trimmed.slice(0, 24);
  }

  return `Player ${playerCount + 1}`;
}

export class RoomManager {
  constructor() {
    this.rooms = new Map();
  }

  generateRoomId() {
    let roomId = createRoomCode();

    while (this.rooms.has(roomId)) {
      roomId = createRoomCode();
    }

    return roomId;
  }

  createRoom({ nickname, socketId, playerId }) {
    const resolvedPlayerId = playerId || crypto.randomUUID();
    const roomId = this.generateRoomId();
    const player = createPlayer({
      playerId: resolvedPlayerId,
      nickname: normalizeNickname(nickname),
      socketId,
      seatIndex: null,
      isAdmin: true
    });
    const room = createRoom({ roomId, player });
    this.rooms.set(roomId, room);
    return { room, player };
  }

  joinRoom({ roomId, nickname, socketId, playerId }) {
    const room = this.rooms.get(roomId);

    if (!room) {
      throw new Error("Room not found.");
    }

    if (playerId) {
      const existingPlayer = reconnectPlayer(room, playerId, socketId, nickname);
      if (existingPlayer) {
        return { room, player: existingPlayer, reconnected: true };
      }
    }

    const player = createPlayer({
      playerId: crypto.randomUUID(),
      nickname: normalizeNickname(nickname, room.players.length),
      socketId,
      seatIndex: null
    });

    attachPlayerToRoom(room, player);
    return { room, player, reconnected: false };
  }

  disconnectSocket(socketId) {
    for (const room of this.rooms.values()) {
      const player = markPlayerDisconnected(room, socketId);
      if (player) {
        return { room, player };
      }
    }

    return null;
  }

  getRoom(roomId) {
    return this.rooms.get(roomId) ?? null;
  }

  takeSeat(roomId, playerId, seatIndex) {
    const room = this.getRoom(roomId);

    if (!room) {
      throw new Error("Room not found.");
    }

    takeRoomSeat(room, playerId, seatIndex);
    return room;
  }

  leaveSeat(roomId, playerId) {
    const room = this.getRoom(roomId);

    if (!room) {
      throw new Error("Room not found.");
    }

    leaveRoomSeat(room, playerId);
    return room;
  }

  leaveRoom(roomId, playerId) {
    const room = this.getRoom(roomId);

    if (!room) {
      throw new Error("Room not found.");
    }

    const player = room.players.find((entry) => entry.playerId === playerId);
    if (!player) {
      throw new Error("You are not in this room.");
    }

    if (["LOBBY", "ROUND_SUMMARY", "GAME_OVER"].includes(room.status)) {
      return { room, player: removePlayer(room, playerId), removed: true };
    }

    return { room, player: markPlayerLeft(room, playerId), removed: false };
  }

  kickPlayer(roomId, adminPlayerId, targetPlayerId, context = {}) {
    const room = this.getRoom(roomId);

    if (!room) {
      throw new Error("Room not found.");
    }

    if (room.adminPlayerId !== adminPlayerId) {
      throw new Error("Only the room admin can kick players.");
    }
    checkHostAction(room, adminPlayerId, context);

    if (adminPlayerId === targetPlayerId) {
      throw new Error("The room admin cannot be kicked.");
    }
    if (!["LOBBY", "ROUND_SUMMARY"].includes(room.status)) throw new Error("Players can only be kicked between rounds.");

    const player = removePlayer(room, targetPlayerId);
    return { room, player };
  }

  admitPlayer(roomId, playerId, targetPlayerId, context = {}) {
    const room = this.getRoom(roomId);
    checkHostAction(room, playerId, context);
    return admitNextRound(room, targetPlayerId);
  }

  startGame(roomId, playerId, options = {}) {
    const room = this.getRoom(roomId);

    if (!room) {
      throw new Error("Room not found.");
    }

    if (room.adminPlayerId !== playerId) {
      throw new Error("Only the room admin can start the game.");
    }
    checkHostAction(room, playerId, options);
    if (room.status !== "LOBBY") throw new Error("A match is already in progress.");

    if (getSeatedPlayers(room).length < 2) {
      throw new Error("At least 2 seated players are required to start.");
    }

    return startGame(room, options);
  }

  submitBid(roomId, playerId, bid, context = {}) {
    const room = this.getRoom(roomId);

    if (!room) {
      throw new Error("Room not found.");
    }

    if (room.paused) {
      throw new Error("The game is paused.");
    }

    if ((context.expectedRound !== undefined && context.expectedRound !== room.gameConfig.roundNumber) ||
        (context.expectedStatus !== undefined && context.expectedStatus !== room.status) ||
        (context.expectedTurnIndex !== undefined && context.expectedTurnIndex !== room.gameConfig.currentTurnIndex)) {
      throw new Error("The bidding turn changed. Review the current table before bidding again.");
    }
    if (room.status === "BIDDING" && room.timer?.endsAt != null && room.timer.endsAt <= Date.now()) {
      throw new Error("The bid timer expired. Automatic bidding is taking over.");
    }

    submitBid(room, playerId, bid);
    room.currentRound.forbiddenBidForFinalPlayer =
      room.status === "BIDDING" ? getBiddingContext(room).forbiddenBidForFinalPlayer : null;
    return room;
  }

  playCard(roomId, playerId, cardId) {
    const room = this.getRoom(roomId);

    if (!room) {
      throw new Error("Room not found.");
    }

    if (room.paused) {
      throw new Error("The game is paused.");
    }

    playCard(room, playerId, cardId);
    return room;
  }

  startBidding(roomId, playerId, context = {}) {
    const room = this.getRoom(roomId);

    if (!room) {
      throw new Error("Room not found.");
    }

    if (room.adminPlayerId !== playerId) {
      throw new Error("Only the room admin can start bidding.");
    }
    checkHostAction(room, playerId, context);
    if (room.paused) throw new Error("Resume the game before starting bidding.");

    startBiddingPhase(room);
    return room;
  }

  togglePause(roomId, playerId, options = {}) {
    const room = this.getRoom(roomId);

    if (!room) {
      throw new Error("Room not found.");
    }

    if (room.adminPlayerId !== playerId) {
      throw new Error("Only the room admin can pause the game.");
    }

    checkHostAction(room, playerId, options);
    if (options.paused !== undefined && typeof options.paused !== "boolean") throw new Error("Invalid pause state.");
    if (room.status === "ROUND_SUMMARY" && (options.paused === false || (options.paused === undefined && room.paused))) {
      if (getNextRoundPlayers(room).length < 2) throw new Error("At least 2 seated or approved players are required to resume the countdown.");
      if (getNextRoundSetup(room).configurationError) throw new Error(getNextRoundSetup(room).configurationError);
    }
    return togglePause(room, options.paused);
  }

  configureNextRound(roomId, playerId, options = {}) {
    const room = this.getRoom(roomId);
    checkHostAction(room, playerId, options);
    return configureNextRound(room, options);
  }

  reorderPlayers(roomId, playerId, orderedPlayerIds) {
    const room = this.getRoom(roomId);

    if (!room) {
      throw new Error("Room not found.");
    }

    if (room.adminPlayerId !== playerId) {
      throw new Error("Only the room admin can change the playing order.");
    }

    reorderRoomPlayers(room, orderedPlayerIds);
    return room;
  }

  advanceRound(roomId, playerId, options = {}) {
    const room = this.getRoom(roomId);

    if (!room) {
      throw new Error("Room not found.");
    }

    if (room.adminPlayerId !== playerId) {
      throw new Error("Only the room admin can advance the round.");
    }
    checkHostAction(room, playerId, options);

    const { cardsInRound, trumpSuit } = room.nextRoundOptions ?? {};
    advanceRound(room, { cardsInRound, trumpSuit, ...options });
    return room;
  }

  rematch(roomId, playerId, context = {}) {
    const room = this.getRoom(roomId);

    if (!room) {
      throw new Error("Room not found.");
    }

    if (room.adminPlayerId !== playerId) {
      throw new Error("Only the room admin can reset the room.");
    }
    checkHostAction(room, playerId, context);
    if (room.status !== "GAME_OVER") throw new Error("Rematch is only available after the game ends.");

    resetRoom(room);
    return room;
  }

  getSanitizedRoom(roomId, playerId) {
    const room = this.getRoom(roomId);
    if (!room) {
      return null;
    }

    return sanitizeRoomForPlayer(room, playerId);
  }
}
