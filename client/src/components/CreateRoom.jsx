import { useState } from "react";

export function CreateRoom({ onCreate, isConnected }) {
  const [nickname, setNickname] = useState("");

  function handleSubmit(event) {
    event.preventDefault();
    if (!isConnected) {
      return;
    }
    onCreate(nickname);
  }

  return (
    <form className="panel panel--primary" onSubmit={handleSubmit}>
      <p className="eyebrow">Start a table</p>
      <h2>Create a private room</h2>
      <div className={`panel-status ${isConnected ? "is-ready" : "is-pending"}`} aria-live="polite">
        <span className="panel-status-dot" aria-hidden="true" />
        <span>{isConnected ? "Server ready" : "Connecting to server"}</span>
      </div>
      <label className="field">
        <span>Nickname</span>
        <input
          value={nickname}
          onChange={(event) => setNickname(event.target.value)}
          maxLength={24}
          autoComplete="nickname"
          placeholder="Dealer name"
        />
      </label>
      <button type="submit" className="btn-primary" disabled={!isConnected}>
        Create room
      </button>
    </form>
  );
}
