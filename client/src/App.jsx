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
        <div className="brand-block">
          <span className="brand">JUDGEMENT</span>
          <span className="brand-sub">Trick-taking</span>
        </div>
        <div className="topbar-actions">
          <ConnectionBadge isConnected={isConnected} />
        </div>
      </header>

      {errorMessage && <div className="error-banner">{errorMessage}</div>}

      {!roomState ? (
        <section className="lobby-grid">
          <div className="lobby-hero">
            <h1>JUDGEMENT</h1>
            <p>Bid your tricks, land them exactly.</p>
          </div>
          <CreateRoom onCreate={actions.createRoom} />
          <JoinRoom onJoin={actions.joinRoom} />
        </section>
      ) : (
        <GameBoard
          roomState={roomState}
          clientPlayerId={clientPlayerId}
          onStartGame={actions.startGame}
          onSubmitBid={actions.submitBid}
          onPlayCard={actions.playCard}
          onStartBidding={actions.startBidding}
          onReorderPlayers={actions.reorderPlayers}
          onNextRound={actions.nextRound}
          onRematch={actions.rematch}
          onLeaveRoom={actions.leaveRoom}
        />
      )}
    </main>
  );
}
