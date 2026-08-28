const SUIT_PIPS = {
  SPADES: { pip: "♠", red: false },
  DIAMONDS: { pip: "♦", red: true },
  CLUBS: { pip: "♣", red: false },
  HEARTS: { pip: "♥", red: true }
};

export function TrumpIndicator({ roomState }) {
  const trumpSuit = roomState.gameConfig.trumpSuit;
  const meta = SUIT_PIPS[trumpSuit];

  if (!trumpSuit || !meta) {
    return null;
  }

  return (
    <div className={`trump-pill ${meta.red ? "is-red" : ""}`}>
      <span className="suit" aria-hidden="true">
        {meta.pip}
      </span>
      <span>Trump</span>
    </div>
  );
}
