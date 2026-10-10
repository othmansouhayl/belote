import { describe, expect, it } from 'vitest';
import {
  SEATS,
  TOTAL_HAND_POINTS,
  applyAction,
  canClaim,
  canClaimWith,
  createDeck,
  createGame,
  getPlayerView,
  legalCards,
  teamOf,
} from '../../src/engine/index.ts';
import type { Card, GameAction, GameState } from '../../src/engine/index.ts';
import { botView, chooseBotAction } from '../../src/bots/simpleBot.ts';
import { cards } from './helpers.ts';

/** Toutes les cartes d'une couleur sauf celles listées. */
const allOf = (suit: Card['suit'], except: Card[] = []) =>
  createDeck().filter((c) => c.suit === suit && !except.some((e) => e.id === c.id));

describe('« تي إفرش عاد » : étaler ses cartes quand elles sont toutes maîtresses', () => {
  it('5 atouts déjà tombés, il reste les 3 autres au joueur', () => {
    const hand = cards('VC 9C AC');
    expect(canClaimWith(hand, cards('7C 8C DC RC 10C'), 'coeur')).toBe(true);
  });

  it('atouts tombés, As + 10 + Roi de Pique en main', () => {
    const hand = cards('AP 10P RP');
    expect(canClaimWith(hand, allOf('coeur'), 'coeur')).toBe(true);
    // Un atout encore caché : un adversaire peut couper.
    expect(canClaimWith(hand, allOf('coeur', cards('7C')), 'coeur')).toBe(false);
  });

  it('une carte cachée plus forte dans la couleur empêche d’étaler', () => {
    // Le Roi de Pique est caché : la Dame n'est pas maîtresse.
    expect(canClaimWith(cards('AP 10P DP'), allOf('coeur'), 'coeur')).toBe(false);
  });

  it('Valet + 9 d’atout : toujours maîtres, même s’il reste d’autres atouts cachés', () => {
    expect(canClaimWith(cards('VC 9C'), [], 'coeur')).toBe(true);
    // Avec une autre couleur, il faut d'abord pouvoir faire tomber tous les atouts cachés.
    expect(canClaimWith(cards('VC 9C AP'), cards('10P RP DP'), 'coeur')).toBe(false);
    expect(canClaimWith(cards('VC 9C AP'), cards('10P RP DP 7C 8C DC'), 'coeur')).toBe(false);
    // Deux atouts cachés seulement : le Valet puis le 9 les font tomber.
    expect(canClaimWith(cards('VC 9C AP'), cards('10P RP DP 7C 8C DC RC'), 'coeur')).toBe(true);
    expect(canClaimWith(cards('VC 9C AP'), cards('10P RP DP 7C 8C DC RC 10C'), 'coeur')).toBe(true);
  });

  it('les atouts entamés en premier font tomber les atouts plus faibles', () => {
    // Le 8 d'atout est caché : le Valet le fait tomber, puis le 7 devient maître.
    const played = createDeck().filter((c) => c.suit === 'coeur' && !['V', '7', '8'].includes(c.rank));
    expect(canClaimWith(cards('VC 7C'), played, 'coeur')).toBe(true);
  });
});

/** Joue des parties avec les bots (qui étalent dès qu'ils le peuvent) jusqu'à trouver une manche étalée. */
function findClaim(): { before: GameState; after: GameState } {
  for (let g = 0; g < 200; g++) {
    let state = createGame({ seed: `etaler-${g}` });
    for (let step = 0; step < 200 && state.phase !== 'handOver' && state.phase !== 'gameOver'; step++) {
      const seat = state.currentPlayer!;
      const action: GameAction = chooseBotAction(botView(state, seat));
      const result = applyAction(state, seat, action);
      if (!result.ok) throw new Error(result.error);
      if (action.type === 'claim') return { before: state, after: result.state };
      state = result.state;
    }
  }
  throw new Error('Aucune manche étalée trouvée');
}

describe('Fin de manche anticipée', () => {
  it('étaler : l’équipe du joueur remporte les plis restants, 162 points au total', () => {
    const { before, after } = findClaim();
    const seat = before.currentPlayer!;
    const result = after.lastHandResult!;
    expect(result.ending).toEqual({ type: 'claim', seat });
    expect(result.trickPoints[0] + result.trickPoints[1]).toBe(TOTAL_HAND_POINTS);
    expect(result.tricksWon[0] + result.tricksWon[1]).toBe(8);
    expect(result.tricksWon[teamOf(seat)]).toBeGreaterThanOrEqual(8 - before.completedTricks.length);
    expect(after.revealed).toEqual({ seat, cards: before.hands[seat] });
    expect(after.hands.every((h) => h.length === 0)).toBe(true);
    // Les cartes cachées des autres joueurs ne sont jamais montrées.
    for (const viewer of SEATS) {
      const json = JSON.stringify(getPlayerView(after, viewer));
      for (const other of SEATS) {
        if (other === viewer || other === seat) continue;
        for (const card of before.hands[other]!) expect(json).not.toContain(`"${card.id}"`);
      }
    }
  });

  it('étaler est refusé quand les cartes ne sont pas toutes maîtresses', () => {
    let state = createGame({ seed: 'refus-etaler', dealer: 0 });
    const bids: GameAction[] = [
      { type: 'bid', bid: { type: 'bid', value: 90, suit: 'coeur' } },
      { type: 'bid', bid: { type: 'pass' } },
      { type: 'bid', bid: { type: 'pass' } },
      { type: 'bid', bid: { type: 'pass' } },
    ];
    for (const action of bids) {
      const r = applyAction(state, state.currentPlayer!, action);
      if (!r.ok) throw new Error(r.error);
      state = r.state;
    }
    expect(state.phase).toBe('playing');
    const seat = state.currentPlayer!;
    if (!canClaim(state, seat)) {
      const refused = applyAction(state, seat, { type: 'claim' });
      expect(refused.ok).toBe(false);
    }
    // Un joueur qui n'a pas la main ne peut jamais étaler.
    const other = SEATS.find((s) => s !== seat)!;
    expect(applyAction(state, other, { type: 'claim' }).ok).toBe(false);
  });

  it('capot annoncé chuté : la manche s’arrête dès le premier pli de la défense', () => {
    let checked = 0;
    for (let g = 0; g < 60 && checked < 10; g++) {
      let state = createGame({ seed: `capot-chute-${g}`, dealer: 0 });
      const ok = (r: ReturnType<typeof applyAction>) => {
        if (!r.ok) throw new Error(r.error);
        return r.state;
      };
      state = ok(applyAction(state, 1, { type: 'bid', bid: { type: 'bid', value: 'capot', suit: 'pique' } }));
      for (const seat of [2, 3, 0] as const) state = ok(applyAction(state, seat, { type: 'bid', bid: { type: 'pass' } }));
      while (state.phase === 'playing') {
        const seat = state.currentPlayer!;
        state = ok(applyAction(state, seat, { type: 'play', cardId: legalCards(state, seat)[0]!.id }));
      }
      const result = state.lastHandResult!;
      if (result.success) continue;
      checked++;
      const last = state.completedTricks[state.completedTricks.length - 1]!;
      expect(teamOf(last.winner)).toBe(0);
      expect(state.completedTricks.filter((t) => teamOf(t.winner) === 0)).toHaveLength(1);
      expect(result.ending).toEqual({ type: 'capotFailed', seat: last.winner });
      expect(result.trickPoints[0] + result.trickPoints[1]).toBe(TOTAL_HAND_POINTS);
      // 500 pour la défense, + 20 de belote si quelqu'un l'avait (même non jouée).
      expect(result.handScore).toEqual([state.beloteHolder === null ? 500 : 520, 0]);
    }
    expect(checked).toBeGreaterThan(0);
  });
});
