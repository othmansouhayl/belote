import type { HandResult, Team } from '../engine/index.ts';

/**
 * Le carton de score, comme sur papier : on écrit en dizaines (160 → 16),
 * et au-delà de 1000 on met le signe ≠ (1120 → ≠12). Le moteur garde toujours le vrai score.
 */
export function sheetValue(score: number): string {
  const tens = Math.round(Math.max(0, score) / 10);
  const thousands = Math.floor(tens / 100);
  if (thousands === 0) return String(tens);
  return '≠'.repeat(thousands) + String(tens % 100).padStart(2, '0');
}

export interface SheetRow {
  /** Nous (l'équipe de celui qui regarde). */
  readonly n: string;
  /** Vous (l'équipe adverse). */
  readonly v: string;
}

/** Une ligne par donne : le total cumulé de chaque équipe après cette donne. */
export function sheetRows(history: readonly HandResult[], myTeam: Team): SheetRow[] {
  const totals: [number, number] = [0, 0];
  return history.map((hand) => {
    totals[0] += hand.handScore[0];
    totals[1] += hand.handScore[1];
    return { n: sheetValue(totals[myTeam]), v: sheetValue(totals[myTeam === 0 ? 1 : 0]) };
  });
}

/** Compteur de manches gagnées, vu par celui qui regarde : « N - V ». */
export function winsLabel(wins: readonly [number, number], myTeam: Team): string {
  return `${wins[myTeam]} - ${wins[myTeam === 0 ? 1 : 0]}`;
}
