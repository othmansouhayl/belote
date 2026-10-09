import type { Card, Rank, Suit } from './types.ts';
import { createRng, randomInt } from './random.ts';

export const SUITS: readonly Suit[] = ['pique', 'coeur', 'carreau', 'trefle'];
export const RANKS: readonly Rank[] = ['7', '8', '9', '10', 'V', 'D', 'R', 'A'];

export const SUIT_LABELS: Record<Suit, string> = {
  pique: 'Pique',
  coeur: 'Cœur',
  carreau: 'Carreau',
  trefle: 'Trèfle',
};

const RANK_LABELS: Record<Rank, string> = {
  '7': '7',
  '8': '8',
  '9': '9',
  '10': '10',
  V: 'Valet',
  D: 'Dame',
  R: 'Roi',
  A: 'As',
};

/** Du plus faible au plus fort (§2.1). */
const TRUMP_ORDER: readonly Rank[] = ['7', '8', 'D', 'R', '10', 'A', '9', 'V'];
const PLAIN_ORDER: readonly Rank[] = ['7', '8', '9', 'V', 'D', 'R', '10', 'A'];

const TRUMP_POINTS: Record<Rank, number> = { V: 20, '9': 14, A: 11, '10': 10, R: 4, D: 3, '8': 0, '7': 0 };
const PLAIN_POINTS: Record<Rank, number> = { A: 11, '10': 10, R: 4, D: 3, V: 2, '9': 0, '8': 0, '7': 0 };

export function cardId(rank: Rank, suit: Suit): string {
  return `${rank}-${suit}`;
}

export function cardLabel(card: Card): string {
  return `${RANK_LABELS[card.rank]} de ${SUIT_LABELS[card.suit]}`;
}

export function createDeck(): Card[] {
  return SUITS.flatMap((suit) => RANKS.map((rank) => ({ id: cardId(rank, suit), suit, rank })));
}

/** Mélange de Fisher-Yates ; sans graine, le mélange n'est pas reproductible. */
export function shuffleDeck(seed?: string): Card[] {
  const deck = createDeck();
  const rng = createRng(seed ?? `${Date.now()}-${Math.random()}`);
  for (let i = deck.length - 1; i > 0; i--) {
    const j = randomInt(rng, i + 1);
    [deck[i], deck[j]] = [deck[j]!, deck[i]!];
  }
  return deck;
}

export function cardPoints(card: Card, trump: Suit): number {
  return card.suit === trump ? TRUMP_POINTS[card.rank] : PLAIN_POINTS[card.rank];
}

/** Force d'une carte dans sa couleur : plus le nombre est grand, plus la carte est forte. */
export function cardStrength(card: Card, trump: Suit): number {
  return (card.suit === trump ? TRUMP_ORDER : PLAIN_ORDER).indexOf(card.rank);
}
