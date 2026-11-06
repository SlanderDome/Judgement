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
      clientPlayerId: player.playerId,
      serverNow: Date.now()
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

function reply(acknowledge, response) {
  if (typeof acknowledge === "function") acknowledge(response);
}

export function registerSocketHandlers(io) {
  io.on("connection", (socket) => {
    // Every room action must come from the socket currently owning that seat.
    socket.use(([event, payload, acknowledge], next) => {
      if (!event.startsWith("game:") && !["seat:take", "seat:leave", "room:kick", "room:admit", "room:leave"].includes(event)) {
        return next();
      }
      const player = roomManager.getRoom(payload?.roomId)?.players.find(
        (entry) => entry.playerId === payload?.playerId
      );
      if (!player || player.socketId !== socket.id) {
        emitError(socket, "This tab no longer owns the session. Reload to reconnect.", "SESSION_CONFLICT");
        reply(acknowledge, { success: false, code: "SESSION_CONFLICT", message: "This tab no longer owns the session. Reload to reconnect." });
        return;
      }
      next();
    });

    function hostAction(event, errorCode, action) {
      socket.on(event, (payload = {}, acknowledge) => {
        try {
          const room = action(payload);
          emitRoomState(io, room);
          scheduleRoomTimeout(io, room.roomId);
          reply(acknowledge, { success: true, status: room.status, roundNumber: room.gameConfig.roundNumber });
        } catch (error) {
          emitError(socket, error.message, errorCode);
          reply(acknowledge, { success: false, code: errorCode, message: error.message });
        }
      });
    }

    hostAction("room:admit", "ADMISSION_REJECTED", payload => roomManager.admitPlayer(payload.roomId, payload.playerId, payload.targetPlayerId, payload));
    hostAction("game:start", "GAME_START_REJECTED", payload => roomManager.startGame(payload.roomId, payload.playerId, payload));
    hostAction("game:start_bidding", "START_BIDDING_REJECTED", payload => roomManager.startBidding(payload.roomId, payload.playerId, payload));
    hostAction("game:toggle_pause", "PAUSE_REJECTED", payload => roomManager.togglePause(payload.roomId, payload.playerId, payload));
    hostAction("game:next_round", "ROUND_ADVANCE_REJECTED", payload => roomManager.advanceRound(payload.roomId, payload.playerId, payload));
    hostAction("game:configure_next_round", "ROUND_SETUP_REJECTED", payload => roomManager.configureNextRound(payload.roomId, payload.playerId, payload));
    hostAction("game:rematch", "REMATCH_REJECTED", payload => roomManager.rematch(payload.roomId, payload.playerId, payload));
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

    socket.on("room:join", ({ roomId, nickname, playerId, resume } = {}) => {
      try {
        const existingRoom = roomManager.getRoom(roomId);
        if (resume && existingRoom && !existingRoom.players.some((entry) => entry.playerId === playerId)) {
          emitError(socket, "Your seat is no longer in this room.", "SESSION_INVALID");
          return;
        }
        const previousSocketId = roomManager.getRoom(roomId)?.players.find(
          (entry) => entry.playerId === playerId
        )?.socketId;
        const { room, player, reconnected } = roomManager.joinRoom({
          roomId,
          nickname,
          playerId,
          socketId: socket.id
        });

        if (previousSocketId && previousSocketId !== socket.id) {
          io.to(previousSocketId).emit("room:session_conflict", {
            message: "This seat was reconnected in another tab or device. Reload this tab to reclaim it."
          });
          io.sockets.sockets.get(previousSocketId)?.leave(room.roomId);
        }
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

      if (existingPlayer.socketId !== socket.id) {
        emitError(socket, "This tab no longer owns the session. Reload to reclaim it.", "SESSION_CONFLICT");
        return;
      }

      emitRoomState(io, room);
      scheduleRoomTimeout(io, room.roomId);
    });

    socket.on("seat:take", ({ roomId, playerId, seatIndex } = {}) => {
      try {
        const room = roomManager.takeSeat(roomId, playerId, seatIndex);
        emitRoomState(io, room);
        scheduleRoomTimeout(io, roomId);
      } catch (error) {
        emitError(socket, error.message, "SEAT_REJECTED");
      }
    });

    socket.on("seat:leave", ({ roomId, playerId } = {}) => {
      try {
        const room = roomManager.leaveSeat(roomId, playerId);
        emitRoomState(io, room);
        scheduleRoomTimeout(io, roomId);
      } catch (error) {
        emitError(socket, error.message, "SEAT_REJECTED");
      }
    });

    socket.on("room:kick", ({ roomId, playerId, targetPlayerId, ...context } = {}, acknowledge) => {
      try {
        const { room, player } = roomManager.kickPlayer(roomId, playerId, targetPlayerId, context);
        if (player.socketId) {
          io.to(player.socketId).emit("room:kicked", {
            message: "The host removed you from the room."
          });
          io.sockets.sockets.get(player.socketId)?.leave(room.roomId);
        }
        emitRoomState(io, room);
        scheduleRoomTimeout(io, roomId);
        reply(acknowledge, { success: true });
      } catch (error) {
        emitError(socket, error.message, "KICK_REJECTED");
        reply(acknowledge, { success: false, message: error.message, code: "KICK_REJECTED" });
      }
    });

    socket.on("room:leave", ({ roomId, playerId } = {}, acknowledge) => {
      let leftRoom;
      try {
        leftRoom = roomManager.leaveRoom(roomId, playerId);
      } catch (error) {
        emitError(socket, error.message, "LEAVE_REJECTED");
        acknowledge?.({ success: false });
        return;
      }

      socket.leave(leftRoom.room.roomId);
      emitRoomState(io, leftRoom.room);
      scheduleRoomTimeout(io, leftRoom.room.roomId);
      acknowledge?.({ success: true });
    });

    socket.on("game:bid", ({ roomId, playerId, bid, ...context } = {}, acknowledge) => {
      try {
        const room = roomManager.submitBid(roomId, playerId, bid, context);
        emitRoomState(io, room);
        scheduleRoomTimeout(io, roomId);
        reply(acknowledge, { success: true, bid });
      } catch (error) {
        emitError(socket, error.message, "BID_REJECTED");
        reply(acknowledge, { success: false, code: "BID_REJECTED", message: error.message });
      }
    });

    socket.on("game:play_card", ({ roomId, playerId, cardId } = {}, acknowledge) => {
      try {
        const room = roomManager.playCard(roomId, playerId, cardId);
        emitRoomState(io, room);
        scheduleRoomTimeout(io, roomId);
        reply(acknowledge, { success: true, cardId });
      } catch (error) {
        emitError(socket, error.message, "CARD_REJECTED");
        reply(acknowledge, { success: false, code: "CARD_REJECTED", message: error.message });
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

    socket.on("disconnect", () => {
      const disconnected = roomManager.disconnectSocket(socket.id);
      if (disconnected) {
        emitRoomState(io, disconnected.room);
        scheduleRoomTimeout(io, disconnected.room.roomId);
      }
    });
  });
}
