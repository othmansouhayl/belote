import { beforeEach, describe, expect, it } from 'vitest';
import { SEATS } from '../../src/engine/index.ts';
import type { GameAction } from '../../src/engine/index.ts';
import { CAFE_TABLE_STALE_MINUTES, handleRequest, parseRequest } from '../../src/server/index.ts';
import type { ServerDeps } from '../../src/server/index.ts';
import { botView, chooseBotAction } from '../../src/bots/simpleBot.ts';
import { MemoryStore } from './memoryStore.ts';

let counter = 0;
const deps: ServerDeps = {
  newRoomId: () => `00000000-0000-4000-8000-${String(++counter).padStart(12, '0')}`,
  newRoomCode: () => `CAF${String(++counter).padStart(3, '2').slice(-3)}`.replace(/[01]/g, '9'),
  newSecureSeed: () => `graine-secrete-${++counter}-${'z'.repeat(24)}`,
};

const PLAYERS = ['joueur-a', 'joueur-b', 'joueur-c', 'joueur-d'];
const call = (store: MemoryStore, playerId: string, request: unknown) => handleRequest(store, deps, playerId, request);

async function tableRoom(store: MemoryStore, table: number, players = PLAYERS) {
  const created = await call(store, players[0]!, { type: 'create', nickname: 'Tarek', table });
  if (!created.ok) throw new Error(created.error);
  for (const [i, p] of players.slice(1).entries()) {
    const joined = await call(store, p, { type: 'join', code: created.code, nickname: `Ami ${i + 2}` });
    if (!joined.ok) throw new Error(joined.error);
  }
  return created;
}

describe('Tables du Café Tarek', () => {
  let store: MemoryStore;
  beforeEach(() => {
    store = new MemoryStore();
  });

  it('seules les tables 1 à 6 existent', () => {
    expect(parseRequest({ type: 'create', nickname: 'A', table: 1 })).toEqual({ type: 'create', nickname: 'A', table: 1 });
    expect(parseRequest({ type: 'create', nickname: 'A', table: 6 })).not.toBeNull();
    for (const table of [0, 7, 2.5, '3', -1]) expect(parseRequest({ type: 'create', nickname: 'A', table })).toBeNull();
    // Sans table : salon privé classique (rejoint par code).
    expect(parseRequest({ type: 'create', nickname: 'A' })).toEqual({ type: 'create', nickname: 'A' });
  });

  it('la table affiche les pseudos, jamais le code ni les identifiants', async () => {
    const { code, roomId } = await tableRoom(store, 3);
    const row = store.cafe.get(3)!;
    expect(row.roomId).toBe(roomId);
    expect(row.info.players.map((p) => p.nickname)).toEqual(['Tarek', 'Ami 2', 'Ami 3', 'Ami 4']);
    expect(row.info.status).toBe('lobby');
    const publicJson = JSON.stringify([row, store.watch.get(roomId)]);
    expect(publicJson).not.toContain(code);
    for (const p of PLAYERS) expect(publicJson).not.toContain(p);
  });

  it('une table occupée ne peut pas être prise, sauf si elle est abandonnée', async () => {
    await tableRoom(store, 2, ['a']);
    const taken = await call(store, 'b', { type: 'create', nickname: 'B', table: 2 });
    expect(taken).toEqual({ ok: false, error: 'Cette table vient d’être prise : choisis-en une autre.' });
    expect((await call(store, 'b', { type: 'create', nickname: 'B', table: 4 })).ok).toBe(true);
    store.now += (CAFE_TABLE_STALE_MINUTES + 1) * 60_000;
    expect((await call(store, 'b', { type: 'create', nickname: 'B', table: 2 })).ok).toBe(true);
  });

  it('la table se libère quand le dernier joueur quitte le salon d’attente', async () => {
    const { roomId } = await tableRoom(store, 5, ['a', 'b']);
    await call(store, 'b', { type: 'leave', roomId });
    expect(store.cafe.get(5)!.info.players).toHaveLength(1);
    await call(store, 'a', { type: 'leave', roomId });
    expect(store.cafe.has(5)).toBe(false);
    expect(store.watch.has(roomId)).toBe(false);
  });

  it('le spectateur ne voit jamais une main, du début à la fin de la partie', async () => {
    const { roomId } = await tableRoom(store, 1);
    for (const p of PLAYERS) await call(store, p, { type: 'ready', roomId, ready: true });
    expect(store.cafe.get(1)!.info.status).toBe('playing');
    for (let step = 0; step < 4000; step++) {
      const state = store.rooms.get(roomId)!.game!;
      const watch = store.watch.get(roomId)!;
      const json = JSON.stringify([watch, store.cafe.get(1)]);
      expect(json).not.toContain(state.seed);
      expect(watch.game!.hand).toEqual([]);
      expect(watch.game!.legalCardIds).toEqual([]);
      for (const seat of SEATS) {
        // Les cartes étalées (« تي إفرش عاد ») sont publiques ; les autres mains, jamais.
        for (const card of state.hands[seat] ?? []) expect(json).not.toContain(`"${card.id}"`);
      }
      if (state.phase === 'gameOver') break;
      if (state.phase === 'handOver') {
        for (const p of PLAYERS) await call(store, p, { type: 'continue', roomId });
        continue;
      }
      const seat = state.currentPlayer!;
      const action: GameAction = chooseBotAction(botView(state, seat));
      const result = await call(store, PLAYERS[seat]!, { type: 'game', roomId, action });
      if (!result.ok) throw new Error(result.error);
    }
    expect(store.cafe.get(1)!.info.status).toBe('finished');
    expect(store.cafe.get(1)!.info.scores).toEqual(store.rooms.get(roomId)!.game!.scores);
  });
});
