import { ConnectionBadge } from "./components/ConnectionBadge.jsx";
import { CreateRoom } from "./components/CreateRoom.jsx";
import { GameBoard } from "./components/GameBoard.jsx";
import { JoinRoom } from "./components/JoinRoom.jsx";
import { useGameState } from "./hooks/useGameState.js";

export default function App() {
  const { roomState, clientPlayerId, isConnected, errorMessage, actions } = useGameState();

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Multiplayer trick-taking</p>
          <h1 className="brand">Judgement</h1>
        </div>
        <ConnectionBadge isConnected={isConnected} />
      </header>

      {errorMessage && <div className="error-banner">{errorMessage}</div>}

      {!roomState ? (
        <section className="lobby-grid">
          <CreateRoom onCreate={actions.createRoom} />
          <JoinRoom onJoin={actions.joinRoom} />
        </section>
      ) : (
        <section className="room-stage">
          <GameBoard
            roomState={roomState}
            clientPlayerId={clientPlayerId}
            onStartGame={actions.startGame}
            onSubmitBid={actions.submitBid}
            onPlayCard={actions.playCard}
            onNextRound={actions.nextRound}
            onRematch={actions.rematch}
          />
        </section>
      )}
    </main>
  );
}
