// Fonction serveur unique du jeu : authentifie le joueur, applique le moteur et
// enregistre l'état + les vues filtrées. Le code du moteur est copié dans _shared
// au déploiement (npm run edge:sync) pour rester identique à celui du navigateur.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH, handleRequest } from '../_shared/server/index.ts';
import type { RoomAggregate, RoomStore, ServerDeps, StoredView } from '../_shared/server/index.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function serverKey(): string {
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (legacy) return legacy;
  const keys = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (keys) {
    const first = Object.values(JSON.parse(keys) as Record<string, unknown>)[0];
    if (typeof first === 'string') return first;
  }
  throw new Error('Clé serveur Supabase introuvable dans l’environnement.');
}

const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', serverKey(), {
  auth: { persistSession: false, autoRefreshToken: false },
});

function randomFrom(alphabet: string, length: number): string {
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

function secureSeed(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

const deps: ServerDeps = {
  newRoomId: () => crypto.randomUUID(),
  newRoomCode: () => randomFrom(ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH),
  newSecureSeed: secureSeed,
};

const toRows = (views: readonly StoredView[]) =>
  views.map((v) => ({ player_id: v.playerId, seat: v.seat, view: v.view }));

async function load(column: 'id' | 'code', value: string): Promise<RoomAggregate | null> {
  const { data, error } = await admin.from('rooms').select('version, data').eq(column, value).maybeSingle();
  if (error) throw new Error(`Lecture du salon impossible : ${error.message}`);
  return data ? ({ ...(data.data as RoomAggregate), version: data.version as number }) : null;
}

async function saveRoom(room: RoomAggregate, expectedVersion: number | null, views: readonly StoredView[]) {
  const { data, error } = await admin.rpc('save_room', {
    p_id: room.id,
    p_code: room.code,
    p_expected_version: expectedVersion,
    p_data: room,
    p_views: toRows(views),
  });
  if (error) throw new Error(`Enregistrement du salon impossible : ${error.message}`);
  return data === true;
}

const store: RoomStore = {
  loadById: (id) => load('id', id),
  loadByCode: (code) => load('code', code),
  insert: (room, views) => saveRoom(room, null, views),
  save: (room, expectedVersion, views) => saveRoom(room, expectedVersion, views),
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ ok: false, error: 'Méthode non autorisée.' }, 405);

  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  const { data: auth } = await admin.auth.getUser(token);
  if (!auth.user) return json({ ok: false, error: 'Session invalide : rechargez la page.' }, 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: 'Requête invalide.' }, 400);
  }

  try {
    return json(await handleRequest(store, deps, auth.user.id, body));
  } catch (error) {
    // Ne jamais journaliser l'état du salon : il contient les mains cachées (§11.4).
    console.error('Erreur serveur :', error instanceof Error ? error.message : 'inconnue');
    return json({ ok: false, error: 'Erreur du serveur, réessayez.' }, 500);
  }
});
