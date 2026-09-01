// Centralised playing-card asset map.
//
// The deck lives in ../assets/cards/ as one SVG per card. Files are named
// RANK+SUIT, e.g. `AS.svg` (ace of spades), `TH.svg` (ten of hearts — ten is
// "T"), `KC.svg` (king of clubs). `1B.svg` is the card BACK.
//
// Vite bundles each SVG and hands back a hashed URL; the map is keyed by the
// raw file stem ("AS", "TH", "1B", …). Nothing outside this file should know a
// card's path.

// `?no-inline` keeps every card as its own .svg file (never base64-inlined),
// so the deck ships exactly as authored and stays cacheable. 1B.svg (the back)
// is excluded — it ships as a raster (see CARD_BACK below); the source SVG stays
// on disk as the reference original.
const modules = import.meta.glob(
  ["../assets/cards/*.svg", "!../assets/cards/1B.svg"],
  { eager: true, query: "?no-inline", import: "default" }
);

/** { "AS": "/assets/AS-a1b2c3.svg", … , "1B": "…" } */
const CARD_URLS = {};
for (const [path, url] of Object.entries(modules)) {
  const stem = path.split("/").pop().replace(/\.svg$/i, "");
  CARD_URLS[stem] = url;
}

// The card BACK ships as a pre-rendered raster instead of the source SVG.
// 1B.svg is a 700 KB / 1600-path vector; the browser re-rasterises it on every
// scale/animation frame and we paint many backs at once (deck, opponent fans,
// dealing cards). The .webp is a faithful render of that same artwork, cropped
// flush to the card border, that decodes once and composites for free.
import CARD_BACK_RASTER from "../assets/cards/1B.webp";

/** The exact face-down / back-of-card asset. */
export const CARD_BACK = CARD_BACK_RASTER;

const SUIT_TO_LETTER = {
  SPADES: "S",
  DIAMONDS: "D",
  CLUBS: "C",
  HEARTS: "H",
  S: "S",
  D: "D",
  C: "C",
  H: "H"
};

// "10" -> "T"; J/Q/K/A and 2-9 pass straight through.
function normaliseRank(rank) {
  const value = String(rank).trim().toUpperCase();
  if (value === "10") return "T";
  return value;
}

// Turn any reasonable card identity into a file stem like "AS" / "TH".
// Accepts:
//   - a card object { suit: "SPADES", label: "A" }  (this game's representation)
//   - the game's card id string "SA" / "H10"        (suit-first)
//   - a human string "AS" / "10H" / "KC"            (rank-first)
export function cardCode(card) {
  if (!card) return null;

  if (typeof card === "object") {
    const suit = SUIT_TO_LETTER[String(card.suit ?? "").toUpperCase()];
    const rank = normaliseRank(card.label ?? card.rank ?? "");
    if (!suit || !/^([2-9]|T|J|Q|K|A)$/.test(rank)) return null;
    return `${rank}${suit}`;
  }

  const raw = String(card).replace(/[^0-9A-Za-z]/g, "").toUpperCase();
  if (raw === "1B" || raw === "B" || raw === "BACK") return "1B";

  // suit letter at the start: "SA", "H10"
  let match = raw.match(/^([SDCH])(10|[2-9]|[TJQKA])$/);
  if (match) return `${normaliseRank(match[2])}${match[1]}`;

  // suit letter at the end: "AS", "10H"
  match = raw.match(/^(10|[2-9]|[TJQKA])([SDCH])$/);
  if (match) return `${normaliseRank(match[1])}${match[2]}`;

  return null;
}

/**
 * Resolve a card to its bundled asset URL.
 * Unknown / unresolved cards fall back to the back so nothing renders broken.
 */
export function getCardAsset(card) {
  const code = cardCode(card);
  return (code && CARD_URLS[code]) || CARD_BACK;
}
