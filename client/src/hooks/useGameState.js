import { useCallback, useEffect, useRef, useState } from "react";
import { useSocket } from "../context/SocketContext.jsx";
import { trackEvent } from "../analytics.js";
import { seatedPlayers } from "../lib/seats.js";

const SESSION_STORAGE_KEY = "judgement-session";
const PLAYER_ID_STORAGE_KEY = "judgement-player-id";

function getSavedSession() {
  try {
    const raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (data && data.roomId && data.playerId) {
        return data;
      }
    }
  } catch (_error) {
    // Ignore JSON parse errors
  }
  const fallbackPlayerId = window.sessionStorage.getItem(PLAYER_ID_STORAGE_KEY);
  return fallbackPlayerId ? { playerId: fallbackPlayerId } : null;
}

function saveSession(session) {
  if (!session || !session.playerId) {
    return;
  }

  if (session.roomId) {
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  }

  window.sessionStorage.setItem(PLAYER_ID_STORAGE_KEY, session.playerId);
}

function clearSession() {
  window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
}

function getClientTimerState(roomState, serverNow) {
  const endsAt = roomState?.timer?.endsAt;
  if (!endsAt || !serverNow) {
    return roomState;
  }

  // Convert the server epoch timestamp into the local clock's coordinate system
  // so every client displays the same remaining time despite clock skew.
  const serverClockOffset = serverNow - Date.now();
  return {
    ...roomState,
    timer: {
      ...roomState.timer,
      endsAt: endsAt - serverClockOffset
    }
  };
}

export function useGameState() {
  const { socket, isConnected } = useSocket();
  const [roomState, setRoomState] = useState(null);
  const [clientPlayerId, setClientPlayerId] = useState(
    () => getSavedSession()?.playerId || null
  );
  const [errorMessage, setErrorMessage] = useState("");
  const [roomSynced, setRoomSynced] = useState(false);
  const [sessionConflict, setSessionConflict] = useState(false);
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
        playerId: session.playerId,
        resume: true
      });
    },
    [socket]
  );

  useEffect(() => {
    function handleRoomState(payload) {
      const nextRoomState = getClientTimerState(payload.roomState, payload.serverNow);
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
      setRoomState(nextRoomState);
      setRoomSynced(true);
      setSessionConflict(false);
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

    function handleConflict(payload) {
      setRoomSynced(false);
      setSessionConflict(true);
      setErrorMessage(payload.message);
    }

    function handleError(payload) {
      if (payload.code === "SESSION_CONFLICT") {
        handleConflict(payload);
        return;
      }
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
    socket.on("room:session_conflict", handleConflict);
    socket.on("game:error", handleError);

    return () => {
      socket.off("room:state_update", handleRoomState);
      socket.off("room:created", handleRoomCreated);
      socket.off("room:joined", handleRoomJoined);
      socket.off("room:kicked", handleRoomKicked);
      socket.off("room:session_conflict", handleConflict);
      socket.off("game:error", handleError);
    };
  }, [socket]);

  useEffect(() => {
    if (isConnected && !sessionConflict) {
      syncWithServer();
    } else {
      setRoomSynced(false);
    }
  }, [isConnected, sessionConflict, syncWithServer]);

  useEffect(() => {
    function handleVisibilityOrFocus() {
      if (document.visibilityState === "visible") {
        const session = getSavedSession();
        if (!session || !session.roomId) {
          return;
        }

        if (socket.connected && !sessionConflict) {
          setRoomSynced(false);
          socket.emit("room:sync", {
            roomId: session.roomId,
            playerId: session.playerId
          });
        } else if (!socket.connected && !sessionConflict) {
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
  }, [socket, sessionConflict]);

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
    setRoomSynced(false);
    setSessionConflict(false);
    setClientPlayerId(null);
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

  function requestRoomAction(event, options = {}) {
    const current = roomStateRef.current;
    if (!current || !clientPlayerId || !socket.connected || !roomSynced || sessionConflict) {
      return Promise.resolve({ success: false, message: "Reconnect to the table before taking an action." });
    }
    const roomId = current.roomId;
    return new Promise(resolve => {
      socket.timeout(6000).emit(event, {
        expectedRound: current.gameConfig.roundNumber,
        expectedStatus: current.status,
        ...options,
        roomId,
        playerId: clientPlayerId
      }, (error, response) => {
        if (roomStateRef.current?.roomId !== roomId) {
          resolve({ success: false, message: "You are no longer in this room." });
          return;
        }
        const result = error
          ? { success: false, message: "No confirmation received. Check the current table before trying again." }
          : response ?? { success: false, message: "The server did not confirm this change." };
        if (!result.success) setErrorMessage(result.message);
        resolve(result);
      });
    });
  }

  function kickPlayer(targetPlayerId, context = {}) {
    return requestRoomAction("room:kick", { targetPlayerId, ...context });
  }

  function admitPlayer(targetPlayerId, context = {}) {
    return requestRoomAction("room:admit", { targetPlayerId, ...context });
  }

  function startGame(options = {}) {
    return requestRoomAction("game:start", options);
  }

  function submitBid(bid, context = {}) {
    return requestRoomAction("game:bid", { bid, ...context });
  }

  function startBidding(context = {}) {
    return requestRoomAction("game:start_bidding", context);
  }

  function setPaused(paused, context = {}) {
    return requestRoomAction("game:toggle_pause", { paused, ...context });
  }

  function togglePause() {
    return setPaused(!roomStateRef.current?.paused);
  }

  function playCard(cardId, context = {}) {
    return requestRoomAction("game:play_card", { cardId, ...context });
  }

  function nextRound(options = {}) {
    return requestRoomAction("game:next_round", options);
  }

  function configureNextRound(options = {}) {
    return requestRoomAction("game:configure_next_round", options);
  }

  function rematch() {
    return requestRoomAction("game:rematch");
  }

  return {
    clientPlayerId,
    errorMessage,
    isConnected,
    connectionStatus: sessionConflict ? "conflict" : isConnected && roomSynced ? "connected" : "reconnecting",
    roomState,
    actions: {
      createRoom,
      joinRoom,
      leaveRoom,
      takeSeat,
      leaveSeat,
      kickPlayer,
      admitPlayer,
      startGame,
      startBidding,
      togglePause,
      setPaused,
      submitBid,
      playCard,
      nextRound,
      configureNextRound,
      rematch
    }
  };
}
