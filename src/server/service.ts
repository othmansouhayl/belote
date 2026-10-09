import { applyRoomRequest, buildViews, createRoom, joinRoom, parseRequest } from './rooms.ts';
import type { RoomResponse, RoomStore, ServerDeps } from './types.ts';

const MAX_ATTEMPTS = 6;

/**
 * Traite une requête d'un joueur authentifié. Le serveur est la seule source de
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
      const room = createRoom(playerId, request.nickname, deps);
      if (await store.insert(room, buildViews(room))) return { ok: true, roomId: room.id, code: room.code };
    }
    return { ok: false, error: 'Impossible de créer le salon, réessayez.' };
  }

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const room = request.type === 'join' ? await store.loadByCode(request.code) : await store.loadById(request.roomId);
    if (!room) return { ok: false, error: request.type === 'join' ? 'Aucun salon ne correspond à ce code.' : 'Salon introuvable.' };

    const result =
      request.type === 'join' ? joinRoom(room, playerId, request.nickname) : applyRoomRequest(room, playerId, request, deps);
    if (!result.ok) return result;

    const next = { ...result.room, version: room.version + 1 };
    if (await store.save(next, room.version, buildViews(next))) return { ok: true, roomId: next.id, code: next.code };
  }
  return { ok: false, error: 'Le salon est très sollicité, réessayez.' };
}
