const SUITS = ["SPADES", "DIAMONDS", "CLUBS", "HEARTS"];
const RANKS = [
  { label: "2", value: 2 },
  { label: "3", value: 3 },
  { label: "4", value: 4 },
  { label: "5", value: 5 },
  { label: "6", value: 6 },
  { label: "7", value: 7 },
  { label: "8", value: 8 },
  { label: "9", value: 9 },
  { label: "10", value: 10 },
  { label: "J", value: 11 },
  { label: "Q", value: 12 },
  { label: "K", value: 13 },
  { label: "A", value: 14 }
];

export function createDeck() {
  return SUITS.flatMap((suit) =>
    RANKS.map((rank) => ({
      id: `${suit[0]}${rank.label}`,
      suit,
      label: rank.label,
      value: rank.value
    }))
  );
}

export function shuffleDeck(deck) {
  const copy = [...deck];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }

  return copy;
}

export function getMaxCardsForPlayers(playerCount) {
  return Math.max(1, Math.floor(52 / Math.max(1, playerCount)));
}

export function getTrumpSuit(roundNumber) {
  return SUITS[(roundNumber - 1) % SUITS.length];
}

export function dealCards(players, cardsInRound) {
  const deck = shuffleDeck(createDeck());
  const hands = new Map();

  players.forEach((player, playerIndex) => {
    const start = playerIndex * cardsInRound;
    const end = start + cardsInRound;
    const hand = deck.slice(start, end).sort((left, right) => left.value - right.value);
    hands.set(player.playerId, hand);
  });

  return hands;
}
