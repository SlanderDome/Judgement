import { createContext, useContext, useEffect, useState } from "react";
import { io } from "socket.io-client";
import { trackEvent } from "../analytics.js";

const SocketContext = createContext(null);

const SERVER_URL =
  import.meta.env.VITE_SOCKET_URL ||
  (import.meta.env.DEV ? "http://127.0.0.1:3001" : undefined);

const socket = io(SERVER_URL, {
  autoConnect: true
});

export function SocketProvider({ children }) {
  const [isConnected, setIsConnected] = useState(socket.connected);

  useEffect(() => {
    if (socket.connected) {
      setIsConnected(true);
    }

    function handleConnect() {
      setIsConnected(true);
    }

    function handleDisconnect(reason) {
      setIsConnected(false);
      trackEvent("player_disconnected", {
        ...(reason ? { reason } : {})
      });
    }

    function handleConnectError(error) {
      setIsConnected(false);
      console.error("Unable to connect to the game server", error.message);
    }

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleConnectError);
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);

  if (!context) {
    throw new Error("useSocket must be used inside SocketProvider");
  }

  return context;
}
