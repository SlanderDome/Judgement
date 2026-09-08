import { createContext, useContext, useEffect, useState } from "react";
import { io } from "socket.io-client";
import { trackEvent } from "../analytics.js";

const SocketContext = createContext(null);

const SERVER_URL =
  import.meta.env.VITE_SOCKET_URL ||
  (import.meta.env.DEV ? "http://localhost:3001" : undefined);

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

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
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
