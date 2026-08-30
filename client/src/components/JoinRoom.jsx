import { useState } from "react";

export function JoinRoom({ onJoin, isConnected }) {
  const [roomId, setRoomId] = useState("");
  const [nickname, setNickname] = useState("");

  function handleSubmit(event) {
    event.preventDefault();
    if (!isConnected) {
      return;
    }
    onJoin(roomId, nickname);
  }

  return (
    <form className="panel panel--secondary" onSubmit={handleSubmit}>
      <p className="eyebrow">Already invited?</p>
      <h2>Join with a room code</h2>
      <div className={`panel-status ${isConnected ? "is-ready" : "is-pending"}`} aria-live="polite">
        <span className="panel-status-dot" aria-hidden="true" />
        <span>{isConnected ? "Server ready" : "Connecting to server"}</span>
      </div>
      <label className="field">
        <span>Room code</span>
        <input
          value={roomId}
          onChange={(event) => setRoomId(event.target.value.toUpperCase())}
          maxLength={6}
          autoCapitalize="characters"
          autoComplete="one-time-code"
          spellCheck={false}
          placeholder="AB12CD"
        />
      </label>
      <label className="field">
        <span>Nickname</span>
        <input
          value={nickname}
          onChange={(event) => setNickname(event.target.value)}
          maxLength={24}
          autoComplete="nickname"
          placeholder="Seat name"
        />
      </label>
      <button type="submit" className="btn-primary" disabled={!isConnected}>
        Join room
      </button>
    </form>
  );
}
