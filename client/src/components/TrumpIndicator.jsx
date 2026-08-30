const SUIT_PIPS = {
  SPADES: { pip: "♠", name: "Spades", red: false },
  DIAMONDS: { pip: "♦", name: "Diamonds", red: true },
  CLUBS: { pip: "♣", name: "Clubs", red: false },
  HEARTS: { pip: "♥", name: "Hearts", red: true },
  NO_TRUMP: { pip: "NT", name: "No Trump", red: false }
};

export function TrumpIndicator({ roomState }) {
  const trumpSuit = roomState.gameConfig?.trumpSuit;
  if (!trumpSuit) return null;

  const meta = SUIT_PIPS[trumpSuit] || { pip: trumpSuit, name: trumpSuit, red: false };

  return (
    <span className={`trump-tag ${meta.red ? "trump-tag--red" : ""}`} title={meta.name}>
      <span className="trump-label">Trump</span>
      <span className="trump-pip" aria-label={meta.name}>
        {meta.pip}
      </span>
    </span>
  );
}
