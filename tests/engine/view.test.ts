import { describe, expect, it } from 'vitest';
import { SEATS, applyAction, createGame, getPlayerView, startNextHand } from '../../src/engine/index.ts';
import type { GameState, Seat } from '../../src/engine/index.ts';
import { botView, chooseBotAction } from '../../src/bots/simpleBot.ts';

/** Vérifie qu'aucune carte cachée ni la graine n'apparaît dans la vue d'un joueur. */
function assertNoLeak(state: GameState, seat: Seat) {
  const json = JSON.stringify(getPlayerView(state, seat));
  expect(json).not.toContain(state.seed);
  for (const other of SEATS) {
    if (other === seat) continue;
    for (const card of state.hands[other] ?? []) {
      if (json.includes(`"${card.id}"`)) {
        throw new Error(`La vue du joueur ${seat} contient ${card.id}, carte cachée du joueur ${other}`);
      }
    }
  }
}

describe('Test 13 — un joueur ne reçoit jamais les cartes des autres', () => {
  it('à chaque étape de 20 parties complètes, aucune vue ne révèle une main adverse', () => {
    for (let g = 0; g < 20; g++) {
      let state = createGame({ seed: `fuite-${g}-${'x'.repeat(20)}` });
      let steps = 0;
      while (state.phase !== 'gameOver' && steps++ < 5000) {
        for (const seat of SEATS) assertNoLeak(state, seat);
        if (state.phase === 'handOver') {
          const next = startNextHand(state);
          if (!next.ok) throw new Error(next.error);
          state = next.state;
          continue;
        }
        const seat = state.currentPlayer!;
        const result = applyAction(state, seat, chooseBotAction(botView(state, seat)));
        if (!result.ok) throw new Error(result.error);
        state = result.state;
      }
      expect(state.phase).toBe('gameOver');
    }
  });

  it('la vue contient bien la main du joueur et les cartes jouables calculées par le moteur', () => {
    const state = createGame({ seed: 'vue', dealer: 0 });
    const view = getPlayerView(state, 1);
    expect(view.hand).toEqual(state.hands[1]);
    expect(view.handCounts).toEqual([8, 8, 8, 8]);
    expect(view.legalBids.length).toBeGreaterThan(0);
    expect(getPlayerView(state, 2).legalBids).toEqual([]);
    expect(view).not.toHaveProperty('seed');
    expect(view).not.toHaveProperty('hands');
    expect(view).not.toHaveProperty('beloteHolder');
  });
});
