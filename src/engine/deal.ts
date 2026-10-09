import type { Card, DealPattern, Seat, Validation } from './types.ts';
import type { RulesConfig } from './rulesConfig.ts';
import { nextSeat } from './seats.ts';

export const CARDS_PER_PLAYER = 8;

export function validateDealPattern(pattern: DealPattern, config: RulesConfig): Validation {
  const [a, b] = pattern;
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 1 || b < 1 || a + b !== CARDS_PER_PLAYER) {
    return { ok: false, error: 'La distribution doit se faire en deux lots qui totalisent 8 cartes par joueur.' };
  }
  if (!config.dealPatterns.some(([x, y]) => x === a && y === b)) {
    return { ok: false, error: `La répartition ${a} + ${b} n'est pas autorisée à cette table.` };
  }
  return { ok: true };
}

/**
 * Distribue le paquet en deux lots, en commençant par le joueur qui suit le donneur.
 * Renvoie les mains indexées par place.
 */
export function dealCards(
  deck: readonly Card[],
  pattern: DealPattern,
  dealer: Seat,
  direction: RulesConfig['playDirection'],
): Card[][] {
  if (deck.length !== CARDS_PER_PLAYER * 4 || new Set(deck.map((c) => c.id)).size !== deck.length) {
    throw new Error('Le paquet doit contenir 32 cartes uniques.');
  }
  const [a, b] = pattern;
  if (a + b !== CARDS_PER_PLAYER) {
    throw new Error('La distribution doit se faire en deux lots qui totalisent 8 cartes par joueur.');
  }
  const hands: Card[][] = [[], [], [], []];
  let index = 0;
  for (const lot of [a, b]) {
    let seat = nextSeat(dealer, direction);
    for (let i = 0; i < 4; i++) {
      hands[seat]!.push(...deck.slice(index, index + lot));
      index += lot;
      seat = nextSeat(seat, direction);
    }
  }
  return hands;
}
