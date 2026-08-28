import { useEffect, useState } from "react";
import { useSocket } from "../context/SocketContext.jsx";

const PLAYER_ID_STORAGE_KEY = "judgement-player-id";

export function useGameState() {
  const { socket, isConnected } = useSocket();
  const [roomState, setRoomState] = useState(null);
  const [clientPlayerId, setClientPlayerId] = useState(
    () => window.localStorage.getItem(PLAYER_ID_STORAGE_KEY) || null
  );
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    function handleRoomState(payload) {
      setRoomState(payload.roomState);
      setClientPlayerId(payload.clientPlayerId);
      window.localStorage.setItem(PLAYER_ID_STORAGE_KEY, payload.clientPlayerId);
    }

    function handleRoomCreated(payload) {
      setClientPlayerId(payload.playerId);
      window.localStorage.setItem(PLAYER_ID_STORAGE_KEY, payload.playerId);
      setErrorMessage("");
    }

    function handleRoomJoined(payload) {
      setClientPlayerId(payload.playerId);
      window.localStorage.setItem(PLAYER_ID_STORAGE_KEY, payload.playerId);
      setErrorMessage("");
    }

    function handleError(payload) {
      setErrorMessage(payload.message);
    }

    socket.on("room:state_update", handleRoomState);
    socket.on("room:created", handleRoomCreated);
    socket.on("room:joined", handleRoomJoined);
    socket.on("game:error", handleError);

    return () => {
      socket.off("room:state_update", handleRoomState);
      socket.off("room:created", handleRoomCreated);
      socket.off("room:joined", handleRoomJoined);
      socket.off("game:error", handleError);
    };
  }, [socket]);

  function createRoom(nickname) {
    socket.emit("room:create", {
      nickname,
      playerId: clientPlayerId
    });
  }

  function joinRoom(roomId, nickname) {
    socket.emit("room:join", {
      roomId: roomId.trim().toUpperCase(),
      nickname,
      playerId: clientPlayerId
    });
  }

  function startGame(options = {}) {
    if (!roomState || !clientPlayerId) {
      return;
    }

    socket.emit("game:start", {
      roomId: roomState.roomId,
      playerId: clientPlayerId,
      ...options
    });
  }

  function submitBid(bid) {
    if (!roomState || !clientPlayerId) {
      return;
    }

    socket.emit("game:bid", {
      roomId: roomState.roomId,
      playerId: clientPlayerId,
      bid
    });
  }

  function playCard(cardId) {
    if (!roomState || !clientPlayerId) {
      return;
    }

    socket.emit("game:play_card", {
      roomId: roomState.roomId,
      playerId: clientPlayerId,
      cardId
    });
  }

  function startBidding() {
    if (!roomState || !clientPlayerId) {
      return;
    }

    socket.emit("game:start_bidding", {
      roomId: roomState.roomId,
      playerId: clientPlayerId
    });
  }

  function reorderPlayers(orderedPlayerIds) {
    if (!roomState || !clientPlayerId) {
      return;
    }

    socket.emit("game:reorder_players", {
      roomId: roomState.roomId,
      playerId: clientPlayerId,
      orderedPlayerIds
    });
  }

  function nextRound(options = {}) {
    if (!roomState || !clientPlayerId) {
      return;
    }

    socket.emit("game:next_round", {
      roomId: roomState.roomId,
      playerId: clientPlayerId,
      ...options
    });
  }

  function rematch() {
    if (!roomState || !clientPlayerId) {
      return;
    }

    socket.emit("game:rematch", {
      roomId: roomState.roomId,
      playerId: clientPlayerId
    });
  }

  return {
    clientPlayerId,
    errorMessage,
    isConnected,
    roomState,
    actions: {
      createRoom,
      joinRoom,
      startGame,
      submitBid,
      playCard,
      startBidding,
      reorderPlayers,
      nextRound,
      rematch
    }
  };
}
