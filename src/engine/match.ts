import type { Team } from './types.ts';

/**
 * Le match : plusieurs manches (une manche = une partie jusqu'au score cible, 1500 par défaut).
 * Au plus 5 manches ; la première équipe qui en gagne 3 remporte le match.
 * Les joueurs peuvent aussi arrêter le match après une manche.
 */
export const MATCH_WINS_NEEDED = 3;
export const MATCH_MAX_GAMES = 5;

export interface MatchGame {
  /** Score final de la manche. */
  readonly scores: readonly [number, number];
  readonly winner: Team;
}

export interface MatchState {
  readonly games: readonly MatchGame[];
  /** Arrêté par les joueurs avant qu'une équipe ait 3 manches. */
  readonly ended: boolean;
}

export const NEW_MATCH: MatchState = { games: [], ended: false };

/** Manches gagnées par chaque équipe. */
export function matchWins(match: MatchState): [number, number] {
  const wins: [number, number] = [0, 0];
  for (const game of match.games) wins[game.winner] += 1;
  return wins;
}

/** L'équipe qui a gagné le match (3 manches), ou null. */
export function matchWinner(match: MatchState): Team | null {
  const [a, b] = matchWins(match);
  if (a >= MATCH_WINS_NEEDED) return 0;
  if (b >= MATCH_WINS_NEEDED) return 1;
  return null;
}

export function isMatchOver(match: MatchState): boolean {
  return match.ended || matchWinner(match) !== null || match.games.length >= MATCH_MAX_GAMES;
}

/** Une manche vient de se terminer : on la note (sans effet si le match est déjà fini). */
export function recordGame(match: MatchState, scores: readonly [number, number], winner: Team): MatchState {
  if (isMatchOver(match)) return match;
  return { ...match, games: [...match.games, { scores: [scores[0], scores[1]], winner }] };
}

/** Les joueurs arrêtent le match après une manche. */
export function endMatch(match: MatchState): MatchState {
  return match.games.length === 0 ? match : { ...match, ended: true };
}
