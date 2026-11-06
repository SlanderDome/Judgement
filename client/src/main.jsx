import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { SocketProvider } from "./context/SocketContext.jsx";
import "./styles.css";
import "./room-concept.css";

const root = ReactDOM.createRoot(document.getElementById("root"));

// Vite removes this entire branch and its dynamic import from production.
// The preview never mounts SocketProvider, so it cannot mutate a live room.
if (import.meta.env.DEV && new URLSearchParams(window.location.search).has("room-preview")) {
  import("./dev/RoomPreview.jsx").then(({ RoomPreview }) => {
    root.render(<React.StrictMode><RoomPreview /></React.StrictMode>);
  });
} else root.render(
  <React.StrictMode>
    <SocketProvider>
      <App />
    </SocketProvider>
  </React.StrictMode>
);
