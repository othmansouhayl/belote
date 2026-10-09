import { describe, expect, it } from 'vitest';
import { CARDS_PER_PLAYER, createDeck, dealCards, makeRules, shuffleDeck, validateDealPattern } from '../../src/engine/index.ts';
import type { DealPattern, Seat } from '../../src/engine/index.ts';

describe('Test 1 — paquet de 32 cartes uniques', () => {
  it('contient 32 cartes, toutes différentes', () => {
    const deck = createDeck();
    expect(deck).toHaveLength(32);
    expect(new Set(deck.map((c) => c.id)).size).toBe(32);
  });

  it('le mélange garde les 32 cartes et dépend uniquement de la graine', () => {
    const a = shuffleDeck('graine-1');
    const b = shuffleDeck('graine-1');
    const other = shuffleDeck('graine-2');
    expect(new Set(a.map((c) => c.id)).size).toBe(32);
    expect(a.map((c) => c.id)).toEqual(b.map((c) => c.id));
    expect(a.map((c) => c.id)).not.toEqual(other.map((c) => c.id));
  });
});

describe('Tests 2 et 3 — distribution', () => {
  const rules = makeRules();
  const patterns: DealPattern[] = [[4, 4], [1, 7], [6, 2]];

  for (const pattern of patterns) {
    it(`répartition ${pattern[0]} + ${pattern[1]} : 8 cartes chacun, aucune carte en double`, () => {
      for (const dealer of [0, 1, 2, 3] as Seat[]) {
        const hands = dealCards(shuffleDeck(`d-${dealer}`), pattern, dealer, rules.playDirection);
        for (const hand of hands) expect(hand).toHaveLength(CARDS_PER_PLAYER);
        const all = hands.flat().map((c) => c.id);
        expect(all).toHaveLength(32);
        expect(new Set(all).size).toBe(32);
      }
    });
  }

  it('distribue par lots en commençant par le joueur qui suit le donneur', () => {
    const deck = createDeck();
    const hands = dealCards(deck, [1, 7], 3, 'counterclockwise');
    // Donneur 3 → le joueur 0 reçoit la 1re carte du premier lot.
    expect(hands[0]![0]!.id).toBe(deck[0]!.id);
    expect(hands[1]![0]!.id).toBe(deck[1]!.id);
    // Second lot : le joueur 0 reçoit les 7 cartes suivantes (indices 4 à 10).
    expect(hands[0]!.slice(1).map((c) => c.id)).toEqual(deck.slice(4, 11).map((c) => c.id));
  });

  it('refuse les répartitions invalides ou non autorisées', () => {
    expect(validateDealPattern([4, 4], rules).ok).toBe(true);
    expect(validateDealPattern([5, 4], rules).ok).toBe(false);
    expect(validateDealPattern([0, 8], rules).ok).toBe(false);
    expect(validateDealPattern([3, 5], rules).ok).toBe(false);
    expect(validateDealPattern([3, 5], makeRules({ dealPatterns: [[3, 5]] })).ok).toBe(true);
  });

  it('refuse un paquet incomplet ou avec doublons', () => {
    const deck = createDeck();
    expect(() => dealCards(deck.slice(1), [4, 4], 0, 'counterclockwise')).toThrow();
    expect(() => dealCards([...deck.slice(1), deck[1]!], [4, 4], 0, 'counterclockwise')).toThrow();
  });
});
