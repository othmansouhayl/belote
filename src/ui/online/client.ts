import type { Session, SupabaseClient } from '@supabase/supabase-js';
import type { RoomRequest, RoomResponse } from '../../server/types.ts';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Faux si les variables Supabase n'ont pas été fournies au moment de la construction du site. */
export const onlineConfigured = Boolean(url && key);

let clientPromise: Promise<SupabaseClient> | null = null;

/** Client Supabase chargé à la demande : le mode hors ligne reste léger. */
export function getClient(): Promise<SupabaseClient> {
  if (!url || !key) return Promise.reject(new Error("Le jeu en ligne n'est pas encore configuré."));
  clientPromise ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'belote-session' } }),
  );
  return clientPromise;
}

/** Identité anonyme, conservée dans le navigateur : elle permet de revenir dans son salon. */
export async function ensureSession(client: SupabaseClient): Promise<Session> {
  const { data } = await client.auth.getSession();
  if (data.session) return data.session;
  const { data: signed, error } = await client.auth.signInAnonymously();
  if (error || !signed.session) throw new Error('Connexion impossible au serveur de jeu. Réessayez dans un instant.');
  return signed.session;
}

/** Envoie une demande au serveur (Edge Function « game »), seul juge des règles. */
export async function sendRequest(request: RoomRequest): Promise<RoomResponse> {
  try {
    const client = await getClient();
    await ensureSession(client);
    const { data, error } = await client.functions.invoke<RoomResponse>('game', { body: request });
    if (!error && data) return data;
    const context = (error as { context?: unknown } | null)?.context;
    if (context instanceof Response) {
      const body = (await context.json().catch(() => null)) as { error?: unknown } | null;
      if (body && typeof body.error === 'string') return { ok: false, error: body.error };
    }
    return { ok: false, error: 'Serveur injoignable : vérifiez votre connexion internet.' };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erreur inattendue.' };
  }
}

const ROOM_KEY = 'belote.salon';
const NICK_KEY = 'belote.pseudo';

export interface SavedRoom {
  readonly roomId: string;
  readonly code: string;
}

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Stockage indisponible (navigation privée) : on continue sans mémoriser.
  }
}

export function loadSavedRoom(): SavedRoom | null {
  const raw = readStorage(ROOM_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as SavedRoom;
    return typeof parsed.roomId === 'string' && typeof parsed.code === 'string' ? parsed : null;
  } catch {
    return null;
  }
}

export const saveRoom = (room: SavedRoom | null) => writeStorage(ROOM_KEY, room ? JSON.stringify(room) : null);
export const loadNickname = () => readStorage(NICK_KEY) ?? '';
export const saveNickname = (nickname: string) => writeStorage(NICK_KEY, nickname);

export function inviteLink(code: string): string {
  return `${window.location.origin}${window.location.pathname}?salon=${code}`;
}
