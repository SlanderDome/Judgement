import { BiddingOverlay } from "./BiddingOverlay.jsx";
import { PlayerSeat } from "./PlayerSeat.jsx";
import { PlayingHand } from "./PlayingHand.jsx";
import { TrumpIndicator } from "./TrumpIndicator.jsx";
import { TurnTimerBar } from "./TurnTimerBar.jsx";

const STATUS_COPY = {
  LOBBY: "Waiting for the room admin to start the first round.",
  BIDDING: "Bidding is live and turn order is enforced server-side.",
  TRICK_PLAYING: "Bidding is complete. Trick play comes next.",
  ROUND_SUMMARY: "Round complete.",
  GAME_OVER: "Game over."
};

export function GameBoard({ roomState, clientPlayerId, onStartGame, onSubmitBid, onPlayCard, onNextRound, onRematch }) {
  const currentPlayer = roomState.players.find((player) => player.playerId === clientPlayerId);
  const isAdmin = roomState.adminPlayerId === clientPlayerId;
  const isLobby = roomState.status === "LOBBY";
  const isMyTurn = roomState.players[roomState.gameConfig.currentTurnIndex]?.playerId === clientPlayerId;
  const isPlaying = roomState.status === "TRICK_PLAYING";
  const isSummary = roomState.status === "ROUND_SUMMARY";
  const isGameOver = roomState.status === "GAME_OVER";
  const lastRoundSummary = roomState.currentRound?.roundSummary?.scores ?? [];

  return (
    <div className="game-layout">
      <section className="panel hero-panel">
        <div className="hero-top">
          <div>
            <p className="eyebrow">Room {roomState.roomId}</p>
            <h1>Judgement Online</h1>
          </div>
          <TrumpIndicator roomState={roomState} />
        </div>
        <p className="hero-copy">{STATUS_COPY[roomState.status] ?? "Game state synced."}</p>
        <div className="meta-row">
          <span>Status: {roomState.status}</span>
          <span>Round: {roomState.gameConfig.roundNumber}</span>
          <span>Cards: {roomState.gameConfig.cardsInRound}</span>
        </div>
        <TurnTimerBar endsAt={roomState.timer?.endsAt} />
        {isLobby && (
          <button type="button" onClick={onStartGame} disabled={!isAdmin || roomState.players.length < 2}>
            {isAdmin ? "Start game" : "Waiting for admin"}
          </button>
        )}
        {isSummary && isAdmin && <button type="button" onClick={onNextRound}>Next round</button>}
        {isGameOver && isAdmin && <button type="button" onClick={onRematch}>Rematch</button>}
      </section>

      <div className="stacked-panels">
        <BiddingOverlay roomState={roomState} clientPlayerId={clientPlayerId} onSubmitBid={onSubmitBid} />
        <PlayingHand
          cards={currentPlayer?.hand ?? []}
          isPlayable={isPlaying && isMyTurn}
          onPlayCard={isPlaying && isMyTurn ? onPlayCard : undefined}
        />
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Table</p>
              <h2>Player seats</h2>
            </div>
            <span>{roomState.players.length} players</span>
          </div>
          <div className="seat-grid">
            {roomState.players.map((player) => (
              <PlayerSeat key={player.playerId} player={player} isActive={player.playerId === currentPlayer?.playerId} />
            ))}
          </div>
        </section>
        {isSummary && (
          <section className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Round summary</p>
                <h2>Scores</h2>
              </div>
              <span>{roomState.gameConfig.phase}</span>
            </div>
            <div className="player-grid">
              {lastRoundSummary.map((entry) => (
                <div key={entry.playerId} className="player-card">
                  <div>
                    <strong>{entry.nickname}</strong>
                    <p>Bid {entry.bid ?? "-" } | Tricks {entry.tricksWon}</p>
                  </div>
                  <strong>{entry.score}</strong>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
