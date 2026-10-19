import { describe, expect, it } from 'vitest';
import { handleRequest, parseRequest } from '../../src/server/index.ts';
import type { ServerDeps } from '../../src/server/index.ts';
import { MemoryStore } from './memoryStore.ts';

let counter = 0;
let clock = 5_000_000;
const deps: ServerDeps = {
  newRoomId: () => `00000000-0000-4000-8000-${String(++counter).padStart(12, '0')}`,
  newRoomCode: () => `REF${String(++counter).padStart(3, '2').slice(-3)}`.replace(/[01]/g, '9'),
  newSecureSeed: () => `graine-reflexion-${++counter}-${'r'.repeat(24)}`,
  now: () => clock,
};
const PLAYERS = ['a', 'b', 'c', 'd'];
const call = (store: MemoryStore, userId: string, request: unknown) => handleRequest(store, deps, userId, request);

async function startedGame(store: MemoryStore) {
  const created = await call(store, 'a', { type: 'create', nickname: 'A' });
  if (!created.ok) throw new Error(created.error);
  const roomId = created.roomId;
  for (const p of PLAYERS.slice(1)) await call(store, p, { type: 'join', code: created.code, nickname: p.toUpperCase() });
  for (const p of PLAYERS) await call(store, p, { type: 'ready', roomId, ready: true });
  for (const p of PLAYERS) await call(store, p, { type: 'drink', roomId, drink: 'tey' });
  return roomId;
}

/** Celui dont c'est le tour passe, après `seconds` secondes, en disant (ou non) ce que montrait son chrono. */
async function passAfter(store: MemoryStore, roomId: string, seconds: number, thought?: boolean) {
  const game = store.rooms.get(roomId)!.game!;
  const player = store.rooms.get(roomId)!.players.find((p) => p.seat === game.currentPlayer)!.playerId;
  clock += seconds * 1000;
  const result = await call(store, player, {
    type: 'game',
    roomId,
    action: { type: 'bid', bid: { type: 'pass' } },
    ...(thought === undefined ? {} : { thought }),
  });
  if (!result.ok) throw new Error(result.error);
}

describe('Règle [41] : le serveur mesure la réflexion de chaque parole', () => {
  it('le téléphone dit ce que montrait son chrono ; le serveur vérifie avec son propre temps', async () => {
    const store = new MemoryStore();
    const roomId = await startedGame(store);
    expect(store.rooms.get(roomId)!.bidTurn).toBeDefined();
    await passAfter(store, roomId, 1, false); // direct
    await passAfter(store, roomId, 6, true); // réfléchi (la passe compte aussi)
    await passAfter(store, roomId, 1, true); // le téléphone prétend « réfléchi » trop tôt : direct
    const history = store.rooms.get(roomId)!.game!.bidding.history;
    expect(history.map((h) => h.thought ?? false)).toEqual([false, true, false]);
    // Les autres joueurs (et les spectateurs) le voient dans leur vue.
    const seen = store.viewFor(roomId, 'c')!.view.game!.bidding.history.map((h) => h.thought ?? false);
    expect(seen).toEqual([false, true, false]);
  });

  it('« direct » longtemps après le chrono ne passe pas : la parole est réfléchie', async () => {
    const store = new MemoryStore();
    const roomId = await startedGame(store);
    await passAfter(store, roomId, 12, false);
    expect(store.rooms.get(roomId)!.game!.bidding.history[0]!.thought).toBe(true);
  });

  it('quatre passes : la donne redistribuée relance le chrono', async () => {
    const store = new MemoryStore();
    const roomId = await startedGame(store);
    for (let i = 0; i < 4; i++) await passAfter(store, roomId, 1);
    // Quatre passes : la donne est redistribuée, un nouveau tour d'enchère commence.
    expect(store.rooms.get(roomId)!.bidTurn!.key.startsWith('1:1:0:')).toBe(true);
  });

  it('la requête accepte seulement un vrai/faux pour la réflexion', () => {
    const roomId = '00000000-0000-4000-8000-000000000001';
    const action = { type: 'bid', bid: { type: 'pass' } };
    expect(parseRequest({ type: 'game', roomId, action, thought: true })).toEqual({ type: 'game', roomId, action, thought: true });
    expect(parseRequest({ type: 'game', roomId, action, thought: 'oui' })).toEqual({ type: 'game', roomId, action });
  });
});
