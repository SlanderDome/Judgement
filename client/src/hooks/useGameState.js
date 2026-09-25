import { useCallback, useEffect, useRef, useState } from "react";
import { useSocket } from "../context/SocketContext.jsx";
import { trackEvent } from "../analytics.js";
import { seatedPlayers } from "../lib/seats.js";

const SESSION_STORAGE_KEY = "judgement-session";
const PLAYER_ID_STORAGE_KEY = "judgement-player-id";

function getSavedSession() {
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (data && data.roomId && data.playerId) {
        return data;
      }
    }
  } catch (_error) {
    // Ignore JSON parse errors
  }
  const fallbackPlayerId = window.localStorage.getItem(PLAYER_ID_STORAGE_KEY);
  return fallbackPlayerId ? { playerId: fallbackPlayerId } : null;
}

function saveSession(session) {
  if (!session || !session.playerId) {
    return;
  }

  if (session.roomId) {
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  }

  window.localStorage.setItem(PLAYER_ID_STORAGE_KEY, session.playerId);
}

function clearSession() {
  window.localStorage.removeItem(SESSION_STORAGE_KEY);
}

export function useGameState() {
  const { socket, isConnected } = useSocket();
  const [roomState, setRoomState] = useState(null);
  const [clientPlayerId, setClientPlayerId] = useState(
    () => getSavedSession()?.playerId || null
  );
  const [errorMessage, setErrorMessage] = useState("");
  const roomStateRef = useRef(null);

  function getPlayerCount(state) {
    return state?.players?.length;
  }

  function getSeatedPlayerCount(state) {
    return state ? seatedPlayers(state).length : undefined;
  }

  function roundParameters(state) {
    const config = state?.gameConfig;
    return {
      round_number: config?.roundNumber,
      cards_per_player: config?.cardsInRound,
      phase: config?.phase?.toLowerCase(),
      trump_suit: config?.trumpSuit
    };
  }

  const syncWithServer = useCallback(
    (session = getSavedSession()) => {
      if (!socket || !socket.connected || !session || !session.roomId) {
        return;
      }

      socket.emit("room:join", {
        roomId: session.roomId.trim().toUpperCase(),
        nickname: session.nickname || "",
        playerId: session.playerId
      });
    },
    [socket]
  );

  useEffect(() => {
    function handleRoomState(payload) {
      const nextRoomState = payload.roomState;
      const previousRoomState = roomStateRef.current;

      if (nextRoomState) {
        const previousStatus = previousRoomState?.status;
        const nextStatus = nextRoomState.status;

        if (nextStatus === "PRE_BIDDING" && previousStatus !== "PRE_BIDDING") {
          if (previousStatus === "LOBBY") {
            trackEvent("game_started", {
              player_count: getSeatedPlayerCount(nextRoomState),
              ...(nextRoomState.gameConfig?.cardsInRound
                ? { cards_per_player: nextRoomState.gameConfig.cardsInRound }
                : {})
            });
          }

          trackEvent("round_started", roundParameters(nextRoomState));
        }

        if (nextStatus === "GAME_OVER" && previousStatus !== "GAME_OVER") {
          trackEvent("game_completed", {
            player_count: getSeatedPlayerCount(nextRoomState)
          });
        }

        if (previousStatus === "GAME_OVER" && nextStatus === "LOBBY") {
          trackEvent("rematch_started", {
            player_count: getSeatedPlayerCount(nextRoomState) ?? getPlayerCount(nextRoomState)
          });
        }
      }

      roomStateRef.current = nextRoomState;
      setRoomState(payload.roomState);
      setClientPlayerId(payload.clientPlayerId);
      setErrorMessage("");

      const me = payload.roomState?.players?.find(
        (player) => player.playerId === payload.clientPlayerId
      );

      saveSession({
        roomId: payload.roomState.roomId,
        playerId: payload.clientPlayerId,
        nickname: me?.nickname || ""
      });
    }

    function handleRoomCreated(payload) {
      trackEvent("room_created", {
        ...(getPlayerCount(roomStateRef.current) != null
          ? { player_count: getPlayerCount(roomStateRef.current) }
          : {})
      });
      setClientPlayerId(payload.playerId);
      setErrorMessage("");
      saveSession({
        roomId: payload.roomId,
        playerId: payload.playerId,
        nickname: payload.nickname || ""
      });
    }

    function handleRoomJoined(payload) {
      if (payload.reconnected) {
        trackEvent("player_reconnected");
      } else {
        trackEvent("room_joined", {
          ...(getPlayerCount(roomStateRef.current) != null
            ? { player_count: getPlayerCount(roomStateRef.current) }
            : {})
        });
      }
      setClientPlayerId(payload.playerId);
      setErrorMessage("");
      saveSession({
        roomId: payload.roomId,
        playerId: payload.playerId,
        nickname: payload.nickname || ""
      });
    }

    function handleRoomKicked(payload) {
      clearSession();
      roomStateRef.current = null;
      setRoomState(null);
      setErrorMessage(payload.message || "The host removed you from the room.");
    }

    function handleError(payload) {
      setErrorMessage(payload.message);
      if (
        payload.code === "ROOM_NOT_FOUND" ||
        payload.code === "SESSION_INVALID"
      ) {
        clearSession();
        setRoomState(null);
      }
    }

    socket.on("room:state_update", handleRoomState);
    socket.on("room:created", handleRoomCreated);
    socket.on("room:joined", handleRoomJoined);
    socket.on("room:kicked", handleRoomKicked);
    socket.on("game:error", handleError);

    return () => {
      socket.off("room:state_update", handleRoomState);
      socket.off("room:created", handleRoomCreated);
      socket.off("room:joined", handleRoomJoined);
      socket.off("room:kicked", handleRoomKicked);
      socket.off("game:error", handleError);
    };
  }, [socket]);

  useEffect(() => {
    if (isConnected) {
      syncWithServer();
    }

    function handleConnect() {
      syncWithServer();
    }

    socket.on("connect", handleConnect);
    return () => {
      socket.off("connect", handleConnect);
    };
  }, [socket, isConnected, syncWithServer]);

  useEffect(() => {
    function handleVisibilityOrFocus() {
      if (document.visibilityState === "visible") {
        const session = getSavedSession();
        if (!session || !session.roomId) {
          return;
        }

        if (socket.connected) {
          socket.emit("room:sync", {
            roomId: session.roomId,
            playerId: session.playerId
          });
        } else {
          socket.connect();
        }
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityOrFocus);
    window.addEventListener("focus", handleVisibilityOrFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
      window.removeEventListener("focus", handleVisibilityOrFocus);
    };
  }, [socket]);

  function createRoom(nickname) {
    socket.emit("room:create", {
      nickname,
      playerId: clientPlayerId
    });
  }

  function joinRoom(roomId, nickname) {
    const formattedRoomId = roomId.trim().toUpperCase();
    socket.emit("room:join", {
      roomId: formattedRoomId,
      nickname,
      playerId: clientPlayerId
    });
  }

  function leaveRoom() {
    const wasInActiveGame =
      roomState && !["LOBBY", "GAME_OVER"].includes(roomState.status);

    if (socket.connected) {
      socket.emit("room:leave", {
        roomId: roomState?.roomId,
        playerId: clientPlayerId
      }, (response) => {
        if (response?.success && wasInActiveGame) {
          trackEvent("game_abandoned", { reason: "player_left" });
        }
      });
    }

    clearSession();
    roomStateRef.current = null;
    setRoomState(null);
    setErrorMessage("");
  }

  function takeSeat(seatIndex) {
    if (!roomState || !clientPlayerId) {
      return;
    }

    socket.emit("seat:take", {
      roomId: roomState.roomId,
      playerId: clientPlayerId,
      seatIndex
    });
  }

  function leaveSeat() {
    if (!roomState || !clientPlayerId) {
      return;
    }

    socket.emit("seat:leave", {
      roomId: roomState.roomId,
      playerId: clientPlayerId
    });
  }

  function kickPlayer(targetPlayerId) {
    if (!roomState || !clientPlayerId || !targetPlayerId) {
      return;
    }

    socket.emit("room:kick", {
      roomId: roomState.roomId,
      playerId: clientPlayerId,
      targetPlayerId
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

  function startBidding() {
    if (!roomState || !clientPlayerId) {
      return;
    }

    socket.emit("game:start_bidding", {
      roomId: roomState.roomId,
      playerId: clientPlayerId
    });
  }

  function togglePause() {
    if (!roomState || !clientPlayerId) {
      return;
    }

    socket.emit("game:toggle_pause", {
      roomId: roomState.roomId,
      playerId: clientPlayerId
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
      leaveRoom,
      takeSeat,
      leaveSeat,
      kickPlayer,
      startGame,
      startBidding,
      togglePause,
      submitBid,
      playCard,
      nextRound,
      rematch
    }
  };
}
