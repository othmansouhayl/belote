import type { SpectatorMode } from '../../server/types.ts';

/**
 * Ce que les joueurs lisent sur la table : qui les regarde, et s'ils peuvent les entendre.
 * Rien si personne ne regarde.
 */
export function audienceText(names: readonly string[], mode: SpectatorMode, listeners = 0): string | null {
  if (names.length === 0 || mode === 'none') return null;
  const who = names.length <= 3 ? names.join(', ') : `${names.slice(0, 3).join(', ')} et ${names.length - 3} autres`;
  const verb = names.length > 1 ? 'regardent' : 'regarde';
  if (mode !== 'listen') return `👀 ${who} ${verb}`;
  const hearing = listeners > 0 ? ` · 🎧 ${listeners} vous ${listeners > 1 ? 'entendent' : 'entend'}` : '';
  return `👀 ${who} ${verb} et ${names.length > 1 ? 'peuvent' : 'peut'} écouter${hearing}`;
}
