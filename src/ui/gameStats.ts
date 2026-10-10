import type { HandResult, Team } from '../engine/index.ts';

export interface TeamStats {
  readonly contractsTaken: number;
  readonly contractsMade: number;
  readonly capots: number;
  readonly belotes: number;
  readonly coinches: number;
}

export interface MatchRow {
  readonly index: number;
  readonly result: HandResult;
  readonly us: number;
  readonly them: number;
  readonly totalUs: number;
  readonly totalThem: number;
}

/** Statistiques d'une équipe sur toute la partie (vue du joueur : « nous » / « eux »). */
export function teamStats(history: readonly HandResult[], team: Team): TeamStats {
  const taken = history.filter((h) => h.takerTeam === team);
  return {
    contractsTaken: taken.length,
    contractsMade: taken.filter((h) => h.success).length,
    capots: taken.filter((h) => h.success && h.capot !== null).length,
    belotes: history.filter((h) => h.belotePoints[team] > 0).length,
    coinches: history.filter((h) => h.takerTeam !== team && h.contract.coinchedBy !== null).length,
  };
}

/** Feuille de match : score de chaque manche et total cumulé. */
export function matchSheet(history: readonly HandResult[], myTeam: Team): MatchRow[] {
  const them: Team = myTeam === 0 ? 1 : 0;
  let totalUs = 0;
  let totalThem = 0;
  return history.map((result, i) => {
    totalUs += result.handScore[myTeam];
    totalThem += result.handScore[them];
    return { index: i + 1, result, us: result.handScore[myTeam], them: result.handScore[them], totalUs, totalThem };
  });
}
