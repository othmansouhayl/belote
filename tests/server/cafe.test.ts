import { beforeEach, describe, expect, it } from 'vitest';
import { SEATS } from '../../src/engine/index.ts';
import type { GameAction } from '../../src/engine/index.ts';
import { CAFE_TABLE_STALE_MINUTES, DRINKS, ORDER_SECONDS, handleRequest, parseRequest } from '../../src/server/index.ts';
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

/** Les 4 joueurs jouent (avec la stratégie des bots) jusqu'à la fin de la partie. */
async function playToEnd(store: MemoryStore, roomId: string, onStep: () => void = () => {}) {
  for (let step = 0; step < 4000; step++) {
    const state = store.rooms.get(roomId)!.game!;
    onStep();
    if (state.phase === 'gameOver') return;
    if (state.phase === 'handOver') {
      for (const p of PLAYERS) await call(store, p, { type: 'continue', roomId });
      continue;
    }
    const seat = state.currentPlayer!;
    const action: GameAction = chooseBotAction(botView(state, seat));
    const result = await call(store, PLAYERS[seat]!, { type: 'game', roomId, action });
    if (!result.ok) throw new Error(result.error);
  }
  throw new Error('partie trop longue');
}

describe('Le match et la commande des boissons', () => {
  let store: MemoryStore;
  beforeEach(() => {
    store = new MemoryStore();
  });

  it('les manches s’enchaînent : 1 - 0, puis « Manche suivante » sans nouvelle commande', async () => {
    const { roomId } = await tableRoom(store, 2);
    for (const p of PLAYERS) await call(store, p, { type: 'ready', roomId, ready: true });
    for (const p of PLAYERS) await call(store, p, { type: 'drink', roomId, drink: 'filtre' });
    await playToEnd(store, roomId);
    const game = store.rooms.get(roomId)!.game!;
    const view = store.viewFor(roomId, PLAYERS[0]!)!.view;
    expect(view.match.games).toEqual([{ scores: game.scores, winner: game.winner }]);
    for (const p of PLAYERS) await call(store, p, { type: 'continue', roomId });
    const next = store.rooms.get(roomId)!;
    expect(next.game!.phase).not.toBe('gameOver');
    expect(next.game!.scores).toEqual([0, 0]);
    expect(next.order ?? null).toBeNull();
    expect(next.match!.games).toHaveLength(1);
  });

  it('« Terminer le match » : seulement à la fin d’une manche ; ensuite un nouveau match recommence par la commande', async () => {
    const { roomId } = await tableRoom(store, 3);
    for (const p of PLAYERS) await call(store, p, { type: 'ready', roomId, ready: true });
    for (const p of PLAYERS) await call(store, p, { type: 'drink', roomId, drink: 'express' });
    expect((await call(store, PLAYERS[0]!, { type: 'endMatch', roomId })).ok).toBe(false);
    await playToEnd(store, roomId);
    expect((await call(store, PLAYERS[1]!, { type: 'endMatch', roomId })).ok).toBe(true);
    expect(store.rooms.get(roomId)!.match!.ended).toBe(true);
    for (const p of PLAYERS) await call(store, p, { type: 'continue', roomId });
    const room = store.rooms.get(roomId)!;
    expect(room.game).toBeNull();
    expect(room.order).not.toBeNull();
    expect(room.match!.games).toEqual([]);
  });

  it('commande : personne ne choisit à la place des autres avant 30 s, ensuite Naceur choisit', async () => {
    let now = 1_000_000;
    const timed = { ...deps, now: () => now };
    const created = await handleRequest(store, timed, PLAYERS[0]!, { type: 'create', nickname: 'Tarek', table: 4 });
    if (!created.ok) throw new Error(created.error);
    const roomId = created.roomId;
    for (const p of PLAYERS.slice(1)) await handleRequest(store, timed, p, { type: 'join', code: created.code, nickname: p });
    for (const p of PLAYERS) await handleRequest(store, timed, p, { type: 'ready', roomId, ready: true });
    await handleRequest(store, timed, PLAYERS[0]!, { type: 'drink', roomId, drink: 'capucin' });
    expect((await handleRequest(store, timed, PLAYERS[0]!, { type: 'drink', roomId })).ok).toBe(false);
    expect(store.viewFor(roomId, PLAYERS[1]!)!.view.order!.chosen).toEqual({ 0: 'capucin' });
    now += ORDER_SECONDS * 1000;
    expect((await handleRequest(store, timed, PLAYERS[1]!, { type: 'drink', roomId })).ok).toBe(true);
    const view = store.viewFor(roomId, PLAYERS[1]!)!.view;
    expect(view.order).toBeNull();
    expect(view.drinks[0]).toBe('capucin');
    expect(Object.values(view.drinks).every((d) => DRINKS.includes(d!))).toBe(true);
    expect(view.game?.hand).toHaveLength(8);
    expect(parseRequest({ type: 'drink', roomId, drink: 'whisky' })).toBeNull();
  });
});

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
    for (const p of PLAYERS) await call(store, p, { type: 'drink', roomId, drink: 'tey' });
    expect(store.cafe.get(1)!.info.status).toBe('playing');
    await playToEnd(store, roomId, () => {
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
    });
    // Fin de la première manche : le match continue, la table reste à eux.
    expect(store.cafe.get(1)!.info.status).toBe('playing');
    expect(store.cafe.get(1)!.info.scores).toEqual(store.rooms.get(roomId)!.game!.scores);
    expect(store.watch.get(roomId)!.match.games).toHaveLength(1);
  });

  it('un match fini libère la table tout de suite (« اللي شاح يلبس »)', async () => {
    const { roomId } = await tableRoom(store, 6);
    for (const p of PLAYERS) await call(store, p, { type: 'ready', roomId, ready: true });
    for (const p of PLAYERS) await call(store, p, { type: 'drink', roomId, drink: 'tey' });
    await playToEnd(store, roomId);
    expect(store.cafe.get(6)!.info.status).toBe('playing');
    // Les joueurs arrêtent le match après cette manche.
    expect((await call(store, PLAYERS[2]!, { type: 'endMatch', roomId })).ok).toBe(true);
    expect(store.cafe.get(6)!.info.status).toBe('finished');
    // D'autres joueurs s'installent aussitôt, sans attendre 10 minutes.
    const others = await call(store, 'e', { type: 'create', nickname: 'Suivant', table: 6 });
    expect(others.ok).toBe(true);
    expect(store.cafe.get(6)!.info.players.map((p) => p.nickname)).toEqual(['Suivant']);
    // Le nouveau match des anciens joueurs (nouvelle commande) ne leur rend pas la table déjà reprise.
    for (const p of PLAYERS) await call(store, p, { type: 'continue', roomId });
    expect(store.rooms.get(roomId)!.order).not.toBeNull();
    expect(store.cafe.get(6)!.info.players.map((p) => p.nickname)).toEqual(['Suivant']);
  });

  it('« Quitter la table » : la table se libère quand les 4 joueurs sont partis, même en pleine partie', async () => {
    const { roomId, code } = await tableRoom(store, 3);
    for (const p of PLAYERS) await call(store, p, { type: 'ready', roomId, ready: true });
    for (const p of PLAYERS) await call(store, p, { type: 'drink', roomId, drink: 'tey' });
    expect(store.cafe.get(3)!.info.status).toBe('playing');
    for (const p of PLAYERS.slice(0, 3)) expect((await call(store, p, { type: 'quit', roomId })).ok).toBe(true);
    // Il reste quelqu'un : la table est toujours occupée, les autres voient qui est parti.
    expect(store.cafe.get(3)!.info.players).toHaveLength(4);
    const view = store.viewFor(roomId, PLAYERS[3]!)!.view;
    expect(view.players.filter((p) => p.left).map((p) => p.seat)).toEqual([0, 1, 2]);
    await call(store, PLAYERS[3]!, { type: 'quit', roomId });
    expect(store.cafe.has(3)).toBe(false);
    expect(store.watch.has(roomId)).toBe(false);
    expect((await call(store, 'e', { type: 'create', nickname: 'Suivant', table: 3 })).ok).toBe(true);
    // Revenir avec le code redonne sa place (sans reprendre la table, déjà prise).
    expect((await call(store, PLAYERS[0]!, { type: 'join', code, nickname: 'Tarek' })).ok).toBe(true);
    expect(store.rooms.get(roomId)!.left).toEqual([PLAYERS[1], PLAYERS[2], PLAYERS[3]]);
    expect(store.cafe.get(3)!.info.players.map((p) => p.nickname)).toEqual(['Suivant']);
  });

  it('« Quitter la table » dans le salon d’attente : on quitte le salon', async () => {
    const { roomId } = await tableRoom(store, 2, ['a', 'b']);
    expect((await call(store, 'b', { type: 'quit', roomId })).ok).toBe(true);
    expect(store.rooms.get(roomId)!.players.map((p) => p.playerId)).toEqual(['a']);
  });

  it('une revanche reprend sa table si personne ne l’a prise entre-temps', async () => {
    const { roomId } = await tableRoom(store, 4);
    for (const p of PLAYERS) await call(store, p, { type: 'ready', roomId, ready: true });
    for (const p of PLAYERS) await call(store, p, { type: 'drink', roomId, drink: 'tey' });
    await playToEnd(store, roomId);
    for (const p of PLAYERS) await call(store, p, { type: 'continue', roomId });
    expect(store.cafe.get(4)!.roomId).toBe(roomId);
    expect(store.cafe.get(4)!.info.status).toBe('playing');
    expect((await call(store, 'e', { type: 'create', nickname: 'Suivant', table: 4 })).ok).toBe(false);
  });
});
