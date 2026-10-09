import { cardId, makeRules } from '../../src/engine/index.ts';
import type { Card, CompletedTrick, FinalContract, Rank, RulesConfig, Seat, Suit, Trick } from '../../src/engine/index.ts';

const SUIT_CODES: Record<string, Suit> = { P: 'pique', C: 'coeur', K: 'carreau', T: 'trefle' };

/** Raccourci de test : « VC » = Valet de Cœur, « 10P » = 10 de Pique, « 7K » = 7 de Carreau. */
export function c(code: string): Card {
  const suit = SUIT_CODES[code.slice(-1)];
  const rank = code.slice(0, -1) as Rank;
  if (!suit) throw new Error(`Carte inconnue : ${code}`);
  return { id: cardId(rank, suit), suit, rank };
}

export function cards(codes: string): Card[] {
  return codes.split(/\s+/).filter(Boolean).map(c);
}

/** Pli en cours : cartes jouées dans l'ordre à partir de `leader`. */
export function trick(leader: Seat, codes: string): Trick {
  return {
    leader,
    cards: cards(codes).map((card, i) => ({ seat: ((leader + i) % 4) as Seat, card })),
  };
}

export function rules(overrides: Partial<RulesConfig> = {}): RulesConfig {
  return makeRules(overrides);
}

export function contract(
  value: number | 'capot',
  suit: Suit,
  bidder: Seat,
  multiplier = 1,
): FinalContract {
  return { value, suit, bidder, multiplier, coinchedBy: multiplier > 1 ? (((bidder + 1) % 4) as Seat) : null, surcoinchedBy: multiplier > 2 ? bidder : null };
}

/**
 * Construit 8 plis complets à partir des 32 cartes, chacun remporté par `winners[i]`.
 * Seule la répartition des cartes entre gagnants compte pour le calcul des points.
 */
export function tricksFrom(byTrick: string[], winners: Seat[]): CompletedTrick[] {
  return byTrick.map((codes, i) => {
    const t = trick(0, codes);
    return { ...t, winner: winners[i]! };
  });
}
