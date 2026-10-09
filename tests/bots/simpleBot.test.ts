import { describe, expect, it } from 'vitest';
import { applyAction, createBiddingState, createGame, makeRules, startNextHand } from '../../src/engine/index.ts';
import type { GameState, Seat } from '../../src/engine/index.ts';
import { botView, chooseBotAction, estimateHand } from '../../src/bots/simpleBot.ts';
import { cards, trick } from '../engine/helpers.ts';

function playGame(seed: string): GameState {
  let state = createGame({ seed });
  for (let i = 0; i < 20_000 && state.phase !== 'gameOver'; i++) {
    if (state.phase === 'handOver') {
      const next = startNextHand(state);
      if (!next.ok) throw new Error(next.error);
      state = next.state;
      continue;
    }
    const seat = state.currentPlayer!;
    const result = applyAction(state, seat, chooseBotAction(botView(state, seat)));
    if (!result.ok) throw new Error(`Coup de bot refusé (${seed}) : ${result.error}`);
    state = result.state;
  }
  return state;
}

describe('Bots simples', () => {
  it('jouent 100 parties complètes avec uniquement des coups légaux', () => {
    for (let g = 0; g < 100; g++) {
      const end = playGame(`bots-${g}`);
      expect(end.phase).toBe('gameOver');
      for (const hand of end.handHistory) expect(hand.trickPoints[0] + hand.trickPoints[1]).toBe(162);
    }
  });

  it('les parties entre bots ne sont pas toutes des chutes', () => {
    const hands = Array.from({ length: 30 }, (_, g) => playGame(`stats-${g}`).handHistory).flat();
    const success = hands.filter((h) => h.success).length;
    expect(success / hands.length).toBeGreaterThan(0.3);
  });

  it('une main forte en atout vaut plus qu’une main faible', () => {
    expect(estimateHand(cards('VC 9C AC 10C AP AK 7T 8T'), 'coeur')).toBeGreaterThan(90);
    expect(estimateHand(cards('7C 8C DP 9K 8K 7T 8T DT'), 'coeur')).toBeLessThan(40);
  });

  const rules = makeRules();
  const view = (seat: Seat, hand: string, t = trick(0, ''), bidder: Seat = 0) => ({
    seat,
    hand: cards(hand),
    bidding: createBiddingState(),
    contract: { value: 100, suit: 'pique' as const, bidder, multiplier: 1, coinchedBy: null, surcoinchedBy: null },
    trick: t,
    completedTricks: [],
    config: rules,
  });

  it('annonce avec une main forte, passe avec une main faible', () => {
    const base = { ...view(1, ''), contract: null };
    const strong = chooseBotAction({ ...base, hand: cards('VC 9C AC 10C AP AK 7T 8T') });
    expect(strong).toMatchObject({ type: 'bid', bid: { type: 'bid', suit: 'coeur' } });
    const weak = chooseBotAction({ ...base, hand: cards('7C 8C DP 9K 8K 7T 8T DT') });
    expect(weak).toEqual({ type: 'bid', bid: { type: 'pass' } });
  });

  it('charge des points quand le partenaire est maître en dernier', () => {
    // Le joueur 1 (partenaire du 3) tient le pli avec l’As de Cœur ; le joueur 3 joue en dernier sans Cœur.
    const action = chooseBotAction(view(3, '10K 7T 8P', trick(0, '7C AC 8C'), 1));
    expect(action).toEqual({ type: 'play', cardId: '10-carreau' });
  });

  it('prend le pli le moins cher possible en dernier', () => {
    // Le 10 suffit à battre le Roi : le bot garde son As.
    const action = chooseBotAction(view(3, 'AC 10C 7C', trick(0, 'RC 8C DC')));
    expect(action).toEqual({ type: 'play', cardId: '10-coeur' });
  });
});
