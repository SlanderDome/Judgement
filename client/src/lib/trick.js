// Mirrors the server's trick-winner logic (stateEngine.js `cardStrength`) so the
// client can highlight the card that is *currently* winning the trick, live, as
// each card is played — not only after the server resolves it.

export function cardStrength(cardPlayed, leadSuit, trumpSuit) {
  const { card } = cardPlayed;
  if (card.suit === trumpSuit) return 300 + card.value;
  if (card.suit === leadSuit) return 200 + card.value;
  return card.value;
}

export function leadingPlay(cardsPlayed, leadSuit, trumpSuit) {
  if (!cardsPlayed || cardsPlayed.length === 0) return null;
  let best = cardsPlayed[0];
  for (let i = 1; i < cardsPlayed.length; i += 1) {
    if (cardStrength(cardsPlayed[i], leadSuit, trumpSuit) > cardStrength(best, leadSuit, trumpSuit)) {
      best = cardsPlayed[i];
    }
  }
  return best;
}
