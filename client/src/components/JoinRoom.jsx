import { useState } from "react";

export function JoinRoom({ onJoin }) {
  const [roomId, setRoomId] = useState("");
  const [nickname, setNickname] = useState("");

  function handleSubmit(event) {
    event.preventDefault();
    onJoin(roomId, nickname);
  }

  return (
    <form className="panel" onSubmit={handleSubmit}>
      <p className="eyebrow">Already invited?</p>
      <h2>Join with a room code</h2>
      <label className="field">
        <span>Room code</span>
        <input
          value={roomId}
          onChange={(event) => setRoomId(event.target.value.toUpperCase())}
          maxLength={6}
          placeholder="AB12CD"
        />
      </label>
      <label className="field">
        <span>Nickname</span>
        <input
          value={nickname}
          onChange={(event) => setNickname(event.target.value)}
          maxLength={24}
          placeholder="Seat name"
        />
      </label>
      <button type="submit">Join room</button>
    </form>
  );
}
