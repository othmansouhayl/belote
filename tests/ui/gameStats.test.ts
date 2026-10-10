import { describe, expect, it } from 'vitest';
import { matchSheet, teamStats } from '../../src/ui/gameStats.ts';
import type { HandResult } from '../../src/engine/index.ts';

const hand = (p: Partial<HandResult> & Pick<HandResult, 'takerTeam' | 'success' | 'handScore'>): HandResult =>
  ({
    contract: { value: 100, suit: 'coeur', bidder: p.takerTeam, multiplier: 1, coinchedBy: null, surcoinchedBy: null },
    trickPoints: [81, 81],
    tricksWon: [4, 4],
    belotePoints: [0, 0],
    contractPoints: [81, 81],
    capot: null,
    ...p,
  }) as HandResult;

const HISTORY: HandResult[] = [
  hand({ takerTeam: 0, success: true, handScore: [100, 40], belotePoints: [20, 0] }),
  hand({
    takerTeam: 1,
    success: false,
    handScore: [520, 0],
    contract: { value: 100, suit: 'pique', bidder: 1, multiplier: 2, coinchedBy: 0, surcoinchedBy: null },
  }),
  hand({ takerTeam: 0, success: true, handScore: [250, 0], capot: 'non-annonce' }),
];

describe('Statistiques de fin de partie', () => {
  it('compte contrats, capots, belotes et coinches par équipe', () => {
    expect(teamStats(HISTORY, 0)).toEqual({ contractsTaken: 2, contractsMade: 2, capots: 1, belotes: 1, coinches: 1 });
    expect(teamStats(HISTORY, 1)).toEqual({ contractsTaken: 1, contractsMade: 0, capots: 0, belotes: 0, coinches: 0 });
  });

  it('la feuille de match cumule les scores du point de vue du joueur', () => {
    const fromTeam1 = matchSheet(HISTORY, 1);
    expect(fromTeam1.map((r) => [r.us, r.them, r.totalUs, r.totalThem])).toEqual([
      [40, 100, 40, 100],
      [0, 520, 40, 620],
      [0, 250, 40, 870],
    ]);
  });
});
