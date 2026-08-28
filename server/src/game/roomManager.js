import crypto from "node:crypto";
import {
  attachPlayerToRoom,
  advanceRound,
  createPlayer,
  createRoom,
  getBiddingContext,
  markPlayerDisconnected,
  reconnectPlayer,
  playCard,
  reorderPlayers as reorderRoomPlayers,
  sanitizeRoomForPlayer,
  resetRoom,
  startBidding as startBiddingPhase,
  startGame,
  submitBid
} from "./stateEngine.js";

const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

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
      seatIndex: 0
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
      seatIndex: room.players.length
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

  startGame(roomId, playerId, options = {}) {
    const room = this.getRoom(roomId);

    if (!room) {
      throw new Error("Room not found.");
    }

    if (room.adminPlayerId !== playerId) {
      throw new Error("Only the room admin can start the game.");
    }

    if (room.players.length < 2) {
      throw new Error("At least 2 players are required to start.");
    }

    return startGame(room, options);
  }

  submitBid(roomId, playerId, bid) {
    const room = this.getRoom(roomId);

    if (!room) {
      throw new Error("Room not found.");
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

    playCard(room, playerId, cardId);
    return room;
  }

  startBidding(roomId, playerId) {
    const room = this.getRoom(roomId);

    if (!room) {
      throw new Error("Room not found.");
    }

    if (room.adminPlayerId !== playerId) {
      throw new Error("Only the room admin can start bidding.");
    }

    startBiddingPhase(room);
    return room;
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

    advanceRound(room, options);
    return room;
  }

  rematch(roomId, playerId) {
    const room = this.getRoom(roomId);

    if (!room) {
      throw new Error("Room not found.");
    }

    if (room.adminPlayerId !== playerId) {
      throw new Error("Only the room admin can reset the room.");
    }

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
