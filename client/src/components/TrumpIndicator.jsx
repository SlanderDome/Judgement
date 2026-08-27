const SUIT_SYMBOLS = {
  SPADES: "♠",
  DIAMONDS: "♦",
  CLUBS: "♣",
  HEARTS: "♥"
};

export function TrumpIndicator({ roomState }) {
  return (
    <div className="trump-pill">
      <span>Trump</span>
      <strong>
        {SUIT_SYMBOLS[roomState.gameConfig.trumpSuit] ?? "?"} {roomState.gameConfig.trumpSuit ?? "TBD"}
      </strong>
    </div>
  );
}
