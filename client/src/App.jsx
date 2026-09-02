import { CreateRoom } from "./components/CreateRoom.jsx";
import { GameBoard } from "./components/GameBoard.jsx";
import { JoinRoom } from "./components/JoinRoom.jsx";
import { useGameState } from "./hooks/useGameState.js";
import { MotionConfig } from "framer-motion";

export default function App() {
  const { roomState, clientPlayerId, isConnected, errorMessage, actions } = useGameState();

  return (
    <MotionConfig reducedMotion="user">
      <main className={`app-shell ${roomState ? "app-shell--game" : "app-shell--lobby"}`}>
        {errorMessage && <div className="error-banner">{errorMessage}</div>}

        {!roomState ? (
          <section className="lobby-grid">
            <div className="lobby-hero">
              <h1>JUDGEMENT</h1>
              <p>Bid your tricks, land them exactly.</p>
            </div>
            <CreateRoom onCreate={actions.createRoom} isConnected={isConnected} />
            <JoinRoom onJoin={actions.joinRoom} isConnected={isConnected} />
          </section>
        ) : (
          <GameBoard
            roomState={roomState}
            clientPlayerId={clientPlayerId}
            isConnected={isConnected}
            errorMessage={errorMessage}
            onStartGame={actions.startGame}
            onStartBidding={actions.startBidding}
            onTogglePause={actions.togglePause}
            onSubmitBid={actions.submitBid}
            onPlayCard={actions.playCard}
            onTakeSeat={actions.takeSeat}
            onNextRound={actions.nextRound}
            onRematch={actions.rematch}
            onLeaveRoom={actions.leaveRoom}
          />
        )}
      </main>
    </MotionConfig>
  );
}
