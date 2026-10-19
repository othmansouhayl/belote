import { applyRoomRequest, buildPublicTable, buildViews, createRoom, joinRoom, parseRequest, spectatorMode, trackBidTurn, unwatchRoom, watchRoom } from './rooms.ts';
import type { RoomResponse, RoomStore, ServerDeps } from './types.ts';

const MAX_ATTEMPTS = 6;

/**
 * Traite une requête d'un joueur (ou d'un spectateur) authentifié. Le serveur est la seule source de
 * vérité : il relit l'état, applique le moteur, puis enregistre l'état et les vues
 * filtrées en une seule opération (avec contrôle de version contre les accès simultanés).
 */
export async function handleRequest(
  store: RoomStore,
  deps: ServerDeps,
  playerId: string,
  raw: unknown,
): Promise<RoomResponse> {
  const request = parseRequest(raw);
  if (!request) return { ok: false, error: 'Requête invalide.' };

  if (request.type === 'create') {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const room = createRoom(playerId, request.nickname, deps, request.table);
      const saved = await store.insert(room, buildViews(room), buildPublicTable(room));
      if (saved === 'ok') return { ok: true, roomId: room.id, code: room.code };
      if (saved === 'tableTaken') return { ok: false, error: 'Cette table vient d’être prise : choisis-en une autre.' };
    }
    return { ok: false, error: 'Impossible de créer le salon, réessayez.' };
  }

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const room = request.type === 'join' ? await store.loadByCode(request.code) : await store.loadById(request.roomId);
    if (!room) return { ok: false, error: request.type === 'join' ? 'Aucun salon ne correspond à ce code.' : 'Salon introuvable.' };

    const result =
      request.type === 'join'
        ? joinRoom(room, playerId, request.nickname)
        : request.type === 'watch'
          ? watchRoom(room, playerId, request.nickname, (deps.now ?? Date.now)())
          : request.type === 'unwatch'
            ? unwatchRoom(room, playerId)
            : applyRoomRequest(room, playerId, request, deps);
    if (!result.ok) return result;

    // Chaque nouveau tour d'enchère démarre le chrono de réflexion côté serveur.
    const next = { ...trackBidTurn(result.room, (deps.now ?? Date.now)()), version: room.version + 1 };
    if (await store.save(next, room.version, buildViews(next), buildPublicTable(next))) {
      // Le spectateur ne reçoit jamais le code du salon (il permettrait de s'asseoir à la table).
      if (request.type === 'watch') return { ok: true, roomId: next.id, code: '', listen: spectatorMode(next) === 'listen' };
      if (request.type === 'unwatch') return { ok: true, roomId: next.id, code: '' };
      return { ok: true, roomId: next.id, code: next.code };
    }
  }
  return { ok: false, error: 'Le salon est très sollicité, réessayez.' };
}
