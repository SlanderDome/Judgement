const SUIT_SYMBOLS = {
  SPADES: "S",
  DIAMONDS: "D",
  CLUBS: "C",
  HEARTS: "H"
};

export function PlayingHand({ cards, isPlayable, onPlayCard }) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Your hand</p>
          <h2>Cards dealt this round</h2>
        </div>
        <span>{cards.length} cards</span>
      </div>
      <div className="hand-row">
        {cards.map((card) => (
          <button
            key={card.id}
            type="button"
            className={`card-tile suit-${card.suit.toLowerCase()}`}
            onClick={() => onPlayCard?.(card.id)}
            disabled={!isPlayable}
          >
            <span>{card.label}</span>
            <strong>{SUIT_SYMBOLS[card.suit] ?? card.suit}</strong>
          </button>
        ))}
        {cards.length === 0 && <p className="muted">Your cards will appear here after the round starts.</p>}
      </div>
    </section>
  );
}
