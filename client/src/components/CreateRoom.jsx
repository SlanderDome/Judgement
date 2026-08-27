import { useState } from "react";

export function CreateRoom({ onCreate }) {
  const [nickname, setNickname] = useState("");

  function handleSubmit(event) {
    event.preventDefault();
    onCreate(nickname);
  }

  return (
    <form className="panel" onSubmit={handleSubmit}>
      <p className="eyebrow">Start a table</p>
      <h2>Create a private room</h2>
      <label className="field">
        <span>Nickname</span>
        <input
          value={nickname}
          onChange={(event) => setNickname(event.target.value)}
          maxLength={24}
          placeholder="Dealer name"
        />
      </label>
      <button type="submit">Create room</button>
    </form>
  );
}
