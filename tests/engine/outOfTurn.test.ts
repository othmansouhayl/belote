import { describe, expect, it } from 'vitest';
import { applyAction, createGame, legalBids, makeRules } from '../../src/engine/index.ts';
import type { ActionResult, BidAction, GameState, Seat } from '../../src/engine/index.ts';

function ok(result: ActionResult): GameState {
  if (!result.ok) throw new Error(result.error);
  return result.state;
}
const bid = (state: GameState, seat: Seat, b: BidAction) => applyAction(state, seat, { type: 'bid', bid: b });

/** Partie où le donneur est 0 : le joueur 1 parle en premier, puis 2, 3, 0. */
const start = () => createGame({ seed: 'hors-tour', dealer: 0 });

describe('Contrée et كبوط sans attendre son tour (le premier qui appuie)', () => {
  it('après « 110 ♥ » du joueur 1, le joueur 4 (place 0) contre sans attendre les joueurs 2 et 3', () => {
    let s = ok(bid(start(), 1, { type: 'bid', value: 110, suit: 'coeur' }));
    expect(s.currentPlayer).toBe(2);
    expect(legalBids(s, 0)).toContainEqual({ type: 'coinche' });
    s = ok(bid(s, 0, { type: 'coinche' }));
    expect(s.bidding.coinchedBy).toBe(0);
    // Plus personne ne peut surenchérir : l'équipe preneuse (1 et 3) peut surcontrer ou passer.
    expect(legalBids(s, 2)).toEqual([]);
    expect(legalBids(s, 3)).toEqual(expect.arrayContaining([{ type: 'pass' }, { type: 'surcoinche' }]));
    expect(legalBids(s, 1)).toEqual(expect.arrayContaining([{ type: 'pass' }, { type: 'surcoinche' }]));
  });

  it('le partenaire du preneur ne peut pas contrer, ni personne avant la première annonce', () => {
    const s0 = start();
    expect(legalBids(s0, 3).some((b) => b.type === 'coinche')).toBe(false);
    expect(bid(s0, 3, { type: 'coinche' }).ok).toBe(false);
    const s = ok(bid(s0, 1, { type: 'bid', value: 90, suit: 'pique' }));
    expect(bid(s, 3, { type: 'coinche' })).toEqual({ ok: false, error: "Ce n'est pas à vous de jouer." });
  });

  it('surcontrée hors tour : le premier des deux preneurs qui appuie', () => {
    let s = ok(bid(start(), 1, { type: 'bid', value: 100, suit: 'trefle' }));
    s = ok(bid(s, 2, { type: 'coinche' }));
    // C'est au joueur 3 de répondre en premier, mais le joueur 1 peut surcontrer tout de suite.
    expect(s.currentPlayer).toBe(3);
    s = ok(bid(s, 1, { type: 'surcoinche' }));
    expect(s.phase).toBe('playing');
    expect(s.contract?.multiplier).toBe(4);
  });

  it('les deux preneurs passent dans n’importe quel ordre : la contrée est jouée', () => {
    let s = ok(bid(start(), 1, { type: 'bid', value: 100, suit: 'trefle' }));
    s = ok(bid(s, 2, { type: 'coinche' }));
    s = ok(bid(s, 1, { type: 'pass' }));
    expect(s.phase).toBe('bidding');
    s = ok(bid(s, 3, { type: 'pass' }));
    expect(s.phase).toBe('playing');
    expect(s.contract?.multiplier).toBe(2);
  });

  it('كبوط annoncé hors tour, puis la parole reprend après celui qui l’a annoncé', () => {
    let s = ok(bid(start(), 1, { type: 'bid', value: 90, suit: 'coeur' }));
    s = ok(bid(s, 3, { type: 'bid', value: 'capot', suit: 'pique' }));
    expect(s.bidding.contract).toEqual({ value: 'capot', suit: 'pique', bidder: 3 });
    expect(s.currentPlayer).toBe(0);
    // Une enchère chiffrée hors tour reste interdite.
    expect(bid(s, 2, { type: 'bid', value: 160, suit: 'coeur' }).ok).toBe(false);
    // La défense peut contrer le capot à tout moment.
    expect(legalBids(s, 2)).toContainEqual({ type: 'coinche' });
  });

  it('les règles peuvent revenir à l’ancien fonctionnement (à son tour seulement)', () => {
    const rules = { allowOutOfTurnCoinche: false, allowOutOfTurnCapot: false };
    let s = createGame({ seed: 'hors-tour', dealer: 0, rules });
    expect(makeRules(rules).allowOutOfTurnCapot).toBe(false);
    s = ok(bid(s, 1, { type: 'bid', value: 110, suit: 'coeur' }));
    expect(legalBids(s, 0)).toEqual([]);
    expect(bid(s, 0, { type: 'coinche' }).ok).toBe(false);
  });
});
