const SUIT_NAMES = { SPADES: "spades", HEARTS: "hearts", DIAMONDS: "diamonds", CLUBS: "clubs" };

export function TablePlayEffects({ ace }) {
  if (!ace) return null;
  return <div key={ace.id} className={`table-play-effects table-play-effects--${ace.kind}`} aria-hidden="true">
    <div className="table-ace-ripple" />
    {ace.kind === "trump" && <div className="table-ace-dust">{Array.from({ length: 12 }, (_, index) => <i key={index} style={{ "--dx": `${Math.cos(index * Math.PI / 6) * 120}px`, "--dy": `${Math.sin(index * Math.PI / 6) * 55}px` }} />)}</div>}
    <span className="table-ace-caption">{ace.kind === "trump" ? "Trump ace" : `Ace of ${SUIT_NAMES[ace.suit]}`} <small>{ace.name}</small></span>
  </div>;
}
