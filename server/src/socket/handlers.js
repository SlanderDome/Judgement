import { RoomManager } from "../game/roomManager.js";
import { handleTurnTimeout } from "../game/stateEngine.js";

const roomManager = new RoomManager();
const roomTimeouts = new Map();

function emitRoomState(io, room) {
  room.players.forEach((player) => {
    if (!player.socketId) {
      return;
    }

    io.to(player.socketId).emit("room:state_update", {
      roomState: roomManager.getSanitizedRoom(room.roomId, player.playerId),
      clientPlayerId: player.playerId
    });
  });
}

function clearRoomTimeout(roomId) {
  const timeoutId = roomTimeouts.get(roomId);
  if (timeoutId) {
    clearTimeout(timeoutId);
    roomTimeouts.delete(roomId);
  }
}

function scheduleRoomTimeout(io, roomId) {
  clearRoomTimeout(roomId);

  const room = roomManager.getRoom(roomId);
  if (!room || !room.timer?.endsAt) {
    return;
  }

  const expectedEndsAt = room.timer.endsAt;
  const delayMs = Math.max(0, expectedEndsAt - Date.now());
  const timeoutId = setTimeout(() => {
    roomTimeouts.delete(roomId);

    const activeRoom = roomManager.getRoom(roomId);
    if (!activeRoom || activeRoom.timer?.endsAt !== expectedEndsAt) {
      return;
    }

    try {
      handleTurnTimeout(activeRoom);
      emitRoomState(io, activeRoom);
      scheduleRoomTimeout(io, roomId);
    } catch (error) {
      console.error("Turn timeout failed", error);
    }
  }, delayMs);

  roomTimeouts.set(roomId, timeoutId);
}

function emitError(socket, message, code = "BAD_REQUEST") {
  socket.emit("game:error", { message, code });
}

export function registerSocketHandlers(io) {
  io.on("connection", (socket) => {
    socket.on("room:create", ({ nickname, playerId } = {}) => {
      const { room, player } = roomManager.createRoom({
        nickname,
        playerId,
        socketId: socket.id
      });

      socket.join(room.roomId);
      emitRoomState(io, room);
      scheduleRoomTimeout(io, room.roomId);
      socket.emit("room:created", {
        roomId: room.roomId,
        playerId: player.playerId,
        nickname: player.nickname
      });
    });

    socket.on("room:join", ({ roomId, nickname, playerId } = {}) => {
      try {
        const { room, player, reconnected } = roomManager.joinRoom({
          roomId,
          nickname,
          playerId,
          socketId: socket.id
        });

        socket.join(room.roomId);
        emitRoomState(io, room);
        scheduleRoomTimeout(io, room.roomId);
        socket.emit("room:joined", {
          roomId: room.roomId,
          playerId: player.playerId,
          nickname: player.nickname,
          reconnected
        });
      } catch (error) {
        emitError(socket, error.message, "ROOM_NOT_FOUND");
      }
    });

    socket.on("room:sync", ({ roomId, playerId } = {}) => {
      if (!roomId || !playerId) {
        return;
      }
      const room = roomManager.getRoom(roomId);
      if (!room) {
        emitError(socket, "Room not found.", "ROOM_NOT_FOUND");
        return;
      }
      const existingPlayer = room.players.find((p) => p.playerId === playerId);
      if (!existingPlayer) {
        emitError(socket, "Player session not found in room.", "SESSION_INVALID");
        return;
      }

      existingPlayer.socketId = socket.id;
      existingPlayer.isOnline = true;
      socket.join(room.roomId);

      emitRoomState(io, room);
      scheduleRoomTimeout(io, room.roomId);
    });

    socket.on("room:leave", () => {
      const disconnected = roomManager.disconnectSocket(socket.id);
      if (!disconnected) {
        return;
      }

      socket.leave(disconnected.room.roomId);
      emitRoomState(io, disconnected.room);
      scheduleRoomTimeout(io, disconnected.room.roomId);
    });

    socket.on("game:start", ({ roomId, playerId, cardsInRound, trumpSuit } = {}) => {
      try {
        const room = roomManager.startGame(roomId, playerId, { cardsInRound, trumpSuit });
        emitRoomState(io, room);
        scheduleRoomTimeout(io, roomId);
      } catch (error) {
        emitError(socket, error.message, "GAME_START_REJECTED");
      }
    });

    socket.on("game:bid", ({ roomId, playerId, bid } = {}) => {
      try {
        const room = roomManager.submitBid(roomId, playerId, bid);
        emitRoomState(io, room);
        scheduleRoomTimeout(io, roomId);
      } catch (error) {
        emitError(socket, error.message, "BID_REJECTED");
      }
    });

    socket.on("game:play_card", ({ roomId, playerId, cardId } = {}) => {
      try {
        const room = roomManager.playCard(roomId, playerId, cardId);
        emitRoomState(io, room);
        scheduleRoomTimeout(io, roomId);
      } catch (error) {
        emitError(socket, error.message, "CARD_REJECTED");
      }
    });

    socket.on("game:start_bidding", ({ roomId, playerId } = {}) => {
      try {
        const room = roomManager.startBidding(roomId, playerId);
        emitRoomState(io, room);
        scheduleRoomTimeout(io, roomId);
      } catch (error) {
        emitError(socket, error.message, "START_BIDDING_REJECTED");
      }
    });

    socket.on("game:reorder_players", ({ roomId, playerId, orderedPlayerIds } = {}) => {
      try {
        const room = roomManager.reorderPlayers(roomId, playerId, orderedPlayerIds);
        emitRoomState(io, room);
        scheduleRoomTimeout(io, roomId);
      } catch (error) {
        emitError(socket, error.message, "REORDER_REJECTED");
      }
    });

    socket.on("game:next_round", ({ roomId, playerId, cardsInRound, trumpSuit, action } = {}) => {
      try {
        const room = roomManager.advanceRound(roomId, playerId, { cardsInRound, trumpSuit, action });
        emitRoomState(io, room);
        scheduleRoomTimeout(io, roomId);
      } catch (error) {
        emitError(socket, error.message, "ROUND_ADVANCE_REJECTED");
      }
    });

    socket.on("game:rematch", ({ roomId, playerId } = {}) => {
      try {
        const room = roomManager.rematch(roomId, playerId);
        emitRoomState(io, room);
        scheduleRoomTimeout(io, roomId);
      } catch (error) {
        emitError(socket, error.message, "REMATCH_REJECTED");
      }
    });

    socket.on("disconnect", () => {
      const disconnected = roomManager.disconnectSocket(socket.id);
      if (disconnected) {
        emitRoomState(io, disconnected.room);
        scheduleRoomTimeout(io, disconnected.room.roomId);
      }
    });
  });
}
