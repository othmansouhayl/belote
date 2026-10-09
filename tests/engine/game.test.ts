import { describe, expect, it } from 'vitest';
import { applyAction, createGame, legalBids, legalCards, startNextHand } from '../../src/engine/index.ts';
import type { ActionResult, GameAction, GameState, Seat } from '../../src/engine/index.ts';

function ok(result: ActionResult): GameState {
  if (!result.ok) throw new Error(result.error);
  return result.state;
}

function act(state: GameState, action: GameAction): GameState {
  return ok(applyAction(state, state.currentPlayer!, action));
}

const pass: GameAction = { type: 'bid', bid: { type: 'pass' } };

/** Joue la manche en entier en choisissant toujours la première carte légale. */
function playOut(state: GameState): GameState {
  let s = state;
  while (s.phase === 'playing') s = act(s, { type: 'play', cardId: legalCards(s, s.currentPlayer!)[0]!.id });
  return s;
}

describe('Déroulement d’une manche', () => {
  it('le premier à parler est le joueur à droite du donneur (place suivante)', () => {
    const game = createGame({ seed: 'a', dealer: 2 });
    expect(game.phase).toBe('bidding');
    expect(game.currentPlayer).toBe(3);
    expect(createGame({ seed: 'a', dealer: 2, rules: { playDirection: 'clockwise' } }).currentPlayer).toBe(1);
  });

  it('une même graine rejoue exactement la même donne', () => {
    const a = createGame({ seed: 'identique' });
    const b = createGame({ seed: 'identique' });
    expect(a.hands).toEqual(b.hands);
    expect(a.dealer).toBe(b.dealer);
    expect(createGame({ seed: 'autre' }).hands).not.toEqual(a.hands);
  });

  it('enchères puis jeu : le premier pli est entamé par le joueur à droite du donneur', () => {
    let s = createGame({ seed: 'manche', dealer: 0 });
    s = act(s, { type: 'bid', bid: { type: 'bid', value: 100, suit: 'coeur' } });
    s = act(s, pass);
    s = act(s, pass);
    s = act(s, pass);
    expect(s.phase).toBe('playing');
    expect(s.contract).toMatchObject({ value: 100, suit: 'coeur', bidder: 1, multiplier: 1 });
    expect(s.currentPlayer).toBe(1);
    expect(s.trick).toEqual({ leader: 1, cards: [] });
  });

  it('manche complète : 8 plis, 162 points, scores ajoutés, puis manche suivante', () => {
    let s = createGame({ seed: 'complete', dealer: 0 });
    s = act(s, { type: 'bid', bid: { type: 'bid', value: 90, suit: 'pique' } });
    s = act(s, pass);
    s = act(s, pass);
    s = act(s, pass);
    s = playOut(s);
    expect(s.phase).toBe('handOver');
    expect(s.completedTricks).toHaveLength(8);
    expect(s.hands.every((h) => h.length === 0)).toBe(true);
    const r = s.lastHandResult!;
    expect(r.trickPoints[0] + r.trickPoints[1]).toBe(162);
    expect(s.scores).toEqual(r.handScore);

    const next = ok(startNextHand(s));
    expect(next.handNumber).toBe(2);
    expect(next.dealer).toBe(1);
    expect(next.currentPlayer).toBe(2);
    expect(next.scores).toEqual(s.scores);
    expect(next.hands.every((h) => h.length === 8)).toBe(true);
  });

  it('coinche puis surcoinche : multiplicateur ×4 sur le contrat', () => {
    let s = createGame({ seed: 'coinche', dealer: 0 });
    s = act(s, { type: 'bid', bid: { type: 'bid', value: 90, suit: 'trefle' } }); // joueur 1
    s = act(s, { type: 'bid', bid: { type: 'coinche' } }); // joueur 2
    expect(s.currentPlayer).toBe(3);
    s = act(s, { type: 'bid', bid: { type: 'surcoinche' } });
    expect(s.phase).toBe('playing');
    expect(s.contract).toMatchObject({ multiplier: 4, coinchedBy: 2, surcoinchedBy: 3 });
  });

  it('si tout le monde passe, la donne est annulée et le donneur suivant redistribue', () => {
    let s = createGame({ seed: 'passe', dealer: 0 });
    const before = s.hands;
    for (let i = 0; i < 4; i++) s = act(s, pass);
    expect(s.phase).toBe('bidding');
    expect(s.dealer).toBe(1);
    expect(s.redeals).toBe(1);
    expect(s.handNumber).toBe(1);
    expect(s.hands).not.toEqual(before);
    expect(s.bidding.history).toHaveLength(0);
  });

  it('belote puis rebelote quand le détenteur joue le Roi et la Dame d’atout', () => {
    // Cherche une graine où un joueur détient Roi et Dame de Cœur.
    let seed = 0;
    let s: GameState;
    let holder: number;
    do {
      s = createGame({ seed: `belote-${seed++}`, dealer: 0 });
      holder = s.hands.findIndex((h) => h.some((c) => c.id === 'R-coeur') && h.some((c) => c.id === 'D-coeur'));
    } while (holder === -1);
    s = act(s, { type: 'bid', bid: { type: 'bid', value: 90, suit: 'coeur' } });
    s = act(s, pass);
    s = act(s, pass);
    s = act(s, pass);
    expect(s.beloteHolder).toBe(holder);
    s = playOut(s);
    expect(s.beloteEvents).toEqual([
      { seat: holder, announce: 'belote' },
      { seat: holder, announce: 'rebelote' },
    ]);
    expect(s.lastHandResult!.belotePoints[holder % 2]).toBe(20);
  });
});

describe('Test 6 — seul le joueur attendu peut agir', () => {
  it('refuse une enchère hors tour', () => {
    const s = createGame({ seed: 'tour', dealer: 0 });
    for (const seat of [0, 2, 3] as Seat[]) {
      expect(applyAction(s, seat, pass)).toEqual({ ok: false, error: "Ce n'est pas à vous de jouer." });
      expect(legalBids(s, seat)).toEqual([]);
    }
    expect(applyAction(s, 1, pass).ok).toBe(true);
  });

  it('refuse une carte jouée hors tour, même légale', () => {
    let s = createGame({ seed: 'tour', dealer: 0 });
    s = act(s, { type: 'bid', bid: { type: 'bid', value: 90, suit: 'pique' } });
    s = act(s, pass);
    s = act(s, pass);
    s = act(s, pass);
    const intruder: Seat = 2;
    const card = s.hands[intruder]![0]!;
    expect(applyAction(s, intruder, { type: 'play', cardId: card.id }).ok).toBe(false);
    expect(legalCards(s, intruder)).toEqual([]);
  });

  it('refuse de jouer une carte pendant les enchères et d’enchérir pendant le jeu', () => {
    let s = createGame({ seed: 'phase', dealer: 0 });
    expect(applyAction(s, 1, { type: 'play', cardId: s.hands[1]![0]!.id })).toEqual({
      ok: false,
      error: 'Les enchères ne sont pas terminées.',
    });
    s = act(s, { type: 'bid', bid: { type: 'bid', value: 90, suit: 'pique' } });
    s = act(s, pass);
    s = act(s, pass);
    s = act(s, pass);
    expect(applyAction(s, 1, pass)).toEqual({ ok: false, error: 'Les enchères sont terminées.' });
  });

  it('l’état de départ n’est jamais modifié par une action', () => {
    const s = createGame({ seed: 'immuable', dealer: 0 });
    const snapshot = JSON.stringify(s);
    applyAction(s, 1, { type: 'bid', bid: { type: 'bid', value: 90, suit: 'pique' } });
    expect(JSON.stringify(s)).toBe(snapshot);
  });
});
