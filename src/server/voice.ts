import { DEFAULT_ICE_SERVERS, parseIceServers } from '../voice/protocol.ts';
import type { IceServer } from '../voice/protocol.ts';
import type { RoomStore } from './types.ts';

export type VoiceConfigResponse =
  | { readonly ok: true; readonly iceServers: readonly IceServer[] }
  | { readonly ok: false; readonly error: string };

/** Variables d'environnement (secrets Supabase) pour le serveur TURN. Toutes facultatives. */
export interface TurnEnv {
  /** Fournisseur à identifiants fixes (ex. Metered Open Relay) : URLs séparées par des virgules. */
  readonly TURN_URLS?: string;
  readonly TURN_USERNAME?: string;
  readonly TURN_CREDENTIAL?: string;
  /** Cloudflare Realtime TURN : identifiants temporaires générés à chaque demande. */
  readonly CLOUDFLARE_TURN_KEY_ID?: string;
  readonly CLOUDFLARE_TURN_API_TOKEN?: string;
}

/** Serveur TURN à identifiants fixes, ou null s'il n'est pas configuré. */
export function staticTurnServer(env: TurnEnv): IceServer | null {
  const urls = (env.TURN_URLS ?? '')
    .split(',')
    .map((u) => u.trim())
    .filter((u) => /^turns?:/.test(u));
  if (urls.length === 0 || !env.TURN_USERNAME || !env.TURN_CREDENTIAL) return null;
  return { urls, username: env.TURN_USERNAME, credential: env.TURN_CREDENTIAL };
}

/** Lit la réponse de l'API Cloudflare (objet unique ou liste de serveurs). */
export function parseCloudflareResponse(json: unknown): IceServer[] | null {
  if (typeof json !== 'object' || json === null) return null;
  const raw = (json as { iceServers?: unknown }).iceServers;
  return parseIceServers(Array.isArray(raw) ? raw : raw ? [raw] : null);
}

const isUuid = (v: unknown): v is string =>
  typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

/**
 * Donne les serveurs STUN/TURN aux seuls membres du salon : les identifiants TURN
 * ne sont pas publiés dans le site, ce qui limite leur usage abusif.
 */
export async function handleVoiceConfig(
  store: RoomStore,
  playerId: string,
  raw: unknown,
  fetchTurnServers: () => Promise<readonly IceServer[] | null>,
): Promise<VoiceConfigResponse> {
  const roomId = typeof raw === 'object' && raw !== null ? (raw as { roomId?: unknown }).roomId : undefined;
  if (!isUuid(roomId)) return { ok: false, error: 'Requête invalide.' };
  const room = await store.loadById(roomId);
  if (!room || !room.players.some((p) => p.playerId === playerId)) {
    return { ok: false, error: 'Vous ne faites pas partie de ce salon.' };
  }
  let turn: readonly IceServer[] | null = null;
  try {
    turn = await fetchTurnServers();
  } catch {
    // Sans TURN, le vocal fonctionne quand même sur la plupart des réseaux.
  }
  return { ok: true, iceServers: [...DEFAULT_ICE_SERVERS, ...(turn ?? [])] };
}
