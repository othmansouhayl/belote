import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RULES,
  REFLECTION_FORCED_AFTER_MS,
  REFLECTION_NETWORK_MARGIN_MS,
  applyAction,
  bidTurnKey,
  createGame,
  getOutOfTurnBids,
  isThoughtBid,
} from '../../src/engine/index.ts';
import type { GameState } from '../../src/engine/index.ts';

const ok = (r: ReturnType<typeof applyAction>): GameState => {
  if (!r.ok) throw new Error(r.error);
  return r.state;
};
const start = (bidReflectionSeconds = 5) =>
  createGame({ seed: 'reflexion', dealer: 0, rules: { trumpBidMinimums: false, bidReflectionSeconds } });

describe('Règle [41] : la réflexion aux enchères (bleu direct, rouge réfléchi)', () => {
  it('le chrono dure 5 secondes par défaut', () => {
    expect(DEFAULT_RULES.bidReflectionSeconds).toBe(5);
  });

  it('chaque parole (passe comprise) garde la trace de la réflexion', () => {
    let state = start();
    state = ok(applyAction(state, state.currentPlayer!, { type: 'bid', bid: { type: 'bid', value: 90, suit: 'coeur' } }));
    state = ok(applyAction(state, state.currentPlayer!, { type: 'bid', bid: { type: 'pass' } }, { thought: true }));
    state = ok(applyAction(state, state.currentPlayer!, { type: 'bid', bid: { type: 'bid', value: 100, suit: 'pique' } }, { thought: true }));
    expect(state.bidding.history.map((h) => h.thought ?? false)).toEqual([false, true, true]);
  });

  it('une contrée hors tour n’est jamais « réfléchie », et sans chrono rien n’est noté', () => {
    let state = start();
    const bidder = state.currentPlayer!;
    state = ok(applyAction(state, bidder, { type: 'bid', bid: { type: 'bid', value: 110, suit: 'trefle' } }));
    // Un adversaire qui n'a pas la parole contre tout de suite.
    const opponent = ([0, 1, 2, 3] as const).find(
      (s) => s !== state.currentPlayer && s % 2 !== bidder % 2 && getOutOfTurnBids(state.bidding, s, state.config).length > 0,
    )!;
    state = ok(applyAction(state, opponent, { type: 'bid', bid: { type: 'coinche' } }, { thought: true }));
    expect(state.bidding.history.at(-1)).toEqual({ seat: opponent, action: { type: 'coinche' } });

    let off = start(0);
    off = ok(applyAction(off, off.currentPlayer!, { type: 'bid', bid: { type: 'pass' } }, { thought: true }));
    expect(off.bidding.history[0]!.thought).toBeUndefined();
  });

  it('un tour d’enchère a une clé qui change à chaque parole, et aucune hors des enchères', () => {
    let state = start();
    const first = bidTurnKey(state);
    expect(first).not.toBeNull();
    state = ok(applyAction(state, state.currentPlayer!, { type: 'bid', bid: { type: 'pass' } }));
    expect(bidTurnKey(state)).not.toBe(first);
    expect(bidTurnKey({ ...state, phase: 'playing' })).toBeNull();
  });

  it('le serveur tranche avec le temps qu’il a mesuré', () => {
    // Pas de chrono : jamais réfléchi.
    expect(isThoughtBid(0, 60_000, true)).toBe(false);
    // Le téléphone dit « réfléchi » : il faut que le serveur ait vu passer presque 5 s (marge réseau).
    expect(isThoughtBid(5, 5_000 - REFLECTION_NETWORK_MARGIN_MS, true)).toBe(true);
    expect(isThoughtBid(5, 1_000, true)).toBe(false);
    // Le téléphone dit « direct » : accepté, sauf très au-delà du chrono.
    expect(isThoughtBid(5, 5_800, false)).toBe(false);
    expect(isThoughtBid(5, 5_000 + REFLECTION_FORCED_AFTER_MS + 1, false)).toBe(true);
    // Sans avis du téléphone : le temps du serveur seul ; sans mesure (ancien salon) : l'avis du téléphone.
    expect(isThoughtBid(5, 5_001, undefined)).toBe(true);
    expect(isThoughtBid(5, 4_000, undefined)).toBe(false);
    expect(isThoughtBid(5, undefined, true)).toBe(true);
    expect(isThoughtBid(5, undefined, undefined)).toBe(false);
  });
});
