import { CAFE_TABLE_STALE_MINUTES } from '../../server/rooms.ts';
import type { CafeTableInfo } from '../../server/types.ts';

/** Une table du café telle que tout le monde la voit (pseudos, état, scores). */
export interface CafeTable {
  readonly number: number;
  readonly roomId: string;
  readonly info: CafeTableInfo;
  readonly updatedAt: number;
}

/** Une partie qui vient de se terminer : le patron passe à la table. */
export interface CafeEnding {
  /** Identifie une fin de partie (une même partie ne fait venir le patron qu'une fois). */
  readonly key: string;
  readonly number: number;
}

/** Pendant combien de temps une fin de partie fait encore venir le patron (téléphone ouvert un peu après). */
export const ENDING_WINDOW_MS = 3 * 60_000;

/**
 * Tables occupées : ni abandonnées (10 minutes sans aucune activité), ni finies.
 * Une partie terminée libère sa table tout de suite : « اللي شاح يلبس ».
 */
export function splitCafeTables(rows: readonly CafeTable[], now: number) {
  const occupied = rows.filter((t) => t.info.status !== 'finished' && now - t.updatedAt < CAFE_TABLE_STALE_MINUTES * 60_000);
  const endings: CafeEnding[] = rows
    .filter((t) => t.info.status === 'finished' && now - t.updatedAt < ENDING_WINDOW_MS)
    .map((t) => ({ key: `${t.roomId}:${t.info.scores?.join('-') ?? ''}`, number: t.number }));
  return { occupied, endings };
}
