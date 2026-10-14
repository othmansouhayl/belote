/**
 * Qui s'installe où dans la salle de belote (calcul pur, sans 3D) :
 * - les habitués jouent à quelques tables libres (jamais toutes : il en reste toujours au moins
 *   deux vides pour les vrais joueurs) ; dès qu'une table est prise, ils vont à une autre ;
 * - les « شوافة » (ceux qui regardent) se tiennent debout derrière les joueurs des tables en jeu,
 *   et derrière les habitués s'il en reste.
 */
export type TableStatus = 'free' | 'lobby' | 'playing' | 'finished';

export const REGULAR_GROUPS = 2;
export const WATCHERS = 4;
/** Tables libres laissées vides au minimum (on doit toujours pouvoir s'asseoir). */
const KEEP_EMPTY = 2;
/** Ordre de préférence des habitués : les tables du fond d'abord. */
const REGULAR_ORDER = [5, 6, 3, 4, 1, 2];

export interface CrowdPlan {
  /** Tables (numéros) où jouent les groupes d'habitués, groupe par groupe. */
  readonly regulars: readonly number[];
  /** Table regardée par chacun des spectateurs debout (null : il ne se montre pas). */
  readonly watchers: readonly (number | null)[];
}

export function planCrowd(statuses: ReadonlyMap<number, TableStatus>, excluded?: number): CrowdPlan {
  const tables = [...statuses.keys()].filter((n) => n !== excluded);
  const free = tables.filter((n) => statuses.get(n) === 'free');
  const count = Math.min(REGULAR_GROUPS, Math.max(0, free.length - KEEP_EMPTY));
  const regulars = REGULAR_ORDER.filter((n) => free.includes(n)).slice(0, count);
  const playing = tables.filter((n) => statuses.get(n) === 'playing').sort((a, b) => a - b);
  // Deux spectateurs par table en jeu, puis un par table d'habitués.
  const wanted = [...playing.flatMap((n) => [n, n]), ...regulars];
  const watchers = Array.from({ length: WATCHERS }, (_, i) => wanted[i] ?? null);
  return { regulars, watchers };
}
