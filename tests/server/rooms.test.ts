import { beforeEach, describe, expect, it } from 'vitest';
import { SEATS } from '../../src/engine/index.ts';
import type { GameAction, Seat } from '../../src/engine/index.ts';
import { handleRequest, parseRequest } from '../../src/server/index.ts';
import type { ServerDeps } from '../../src/server/index.ts';
import { botView, chooseBotAction } from '../../src/bots/simpleBot.ts';
import { MemoryStore } from './memoryStore.ts';

let counter = 0;
const deps: ServerDeps = {
  newRoomId: () => `00000000-0000-4000-8000-${String(++counter).padStart(12, '0')}`,
  newRoomCode: () => `ABC${String(counter).padStart(3, '2').slice(-3)}`.replace(/[01]/g, '9'),
  newSecureSeed: () => `graine-secrete-${++counter}-${'z'.repeat(24)}`,
};

const PLAYERS = ['joueur-a', 'joueur-b', 'joueur-c', 'joueur-d'];

async function call(store: MemoryStore, playerId: string, request: unknown) {
  return handleRequest(store, deps, playerId, request);
}

async function fullRoom(store: MemoryStore) {
  const created = await call(store, PLAYERS[0]!, { type: 'create', nickname: 'Amel' });
  if (!created.ok) throw new Error(created.error);
  for (const [i, p] of PLAYERS.slice(1).entries()) {
    const joined = await call(store, p, { type: 'join', code: created.code, nickname: `Joueur ${i + 2}` });
    if (!joined.ok) throw new Error(joined.error);
  }
  return created;
}

describe('Salons privés', () => {
  let store: MemoryStore;
  beforeEach(() => {
    store = new MemoryStore();
  });

  it('création, arrivée des joueurs et attribution des places par le serveur', async () => {
    const { roomId } = await fullRoom(store);
    const seats = PLAYERS.map((p) => store.viewFor(roomId, p)!.seat);
    expect(seats).toEqual([0, 1, 2, 3]);
    const view = store.viewFor(roomId, PLAYERS[1]!)!.view;
    expect(view.players.map((p) => p.nickname)).toEqual(['Amel', 'Joueur 2', 'Joueur 3', 'Joueur 4']);
    expect(view.status).toBe('lobby');
    expect(view.game).toBeNull();
    expect(JSON.stringify(view)).not.toContain('joueur-a');
  });

  it('refuse un cinquième joueur et un code inconnu', async () => {
    const { code } = await fullRoom(store);
    expect(await call(store, 'intrus', { type: 'join', code, nickname: 'Intrus' })).toEqual({
      ok: false,
      error: 'Le salon est complet.',
    });
    expect((await call(store, 'x', { type: 'join', code: 'ZZZZZZ', nickname: 'X' })).ok).toBe(false);
  });

  it('changer de place avant le début, mais jamais vers une place prise', async () => {
    const { roomId } = await fullRoom(store);
    expect((await call(store, PLAYERS[0]!, { type: 'seat', roomId, seat: 2 })).ok).toBe(false);
    await call(store, PLAYERS[3]!, { type: 'leave', roomId });
    expect((await call(store, PLAYERS[0]!, { type: 'seat', roomId, seat: 3 })).ok).toBe(true);
    expect(store.viewFor(roomId, PLAYERS[0]!)!.seat).toBe(3);
  });

  it('la partie démarre quand les 4 joueurs sont prêts', async () => {
    const { roomId } = await fullRoom(store);
    for (const p of PLAYERS.slice(0, 3)) await call(store, p, { type: 'ready', roomId, ready: true });
    expect(store.viewFor(roomId, PLAYERS[0]!)!.view.status).toBe('lobby');
    await call(store, PLAYERS[3]!, { type: 'ready', roomId, ready: true });
    const view = store.viewFor(roomId, PLAYERS[0]!)!.view;
    expect(view.status).toBe('playing');
    expect(view.game?.hand).toHaveLength(8);
    // Plus personne ne peut changer de place ni partir.
    expect((await call(store, PLAYERS[0]!, { type: 'seat', roomId, seat: 1 })).ok).toBe(false);
    expect((await call(store, PLAYERS[0]!, { type: 'leave', roomId })).ok).toBe(false);
  });

  it('refuse les requêtes mal formées', () => {
    expect(parseRequest(null)).toBeNull();
    expect(parseRequest({ type: 'create', nickname: '   ' })).toBeNull();
    expect(parseRequest({ type: 'seat', roomId: 'pas-un-uuid', seat: 1 })).toBeNull();
    expect(parseRequest({ type: 'game', roomId: '00000000-0000-4000-8000-000000000001', action: { type: 'bid', bid: { type: 'bid', value: 'cent', suit: 'coeur' } } })).toBeNull();
    expect(parseRequest({ type: 'create', nickname: 'a'.repeat(50) })).toEqual({ type: 'create', nickname: 'a'.repeat(20) });
  });
});

/** Fait jouer toute la partie par des bots, au travers du serveur uniquement. */
async function playThroughServer(store: MemoryStore, roomId: string, maxRequests: number) {
  for (let i = 0; i < maxRequests; i++) {
    const views = PLAYERS.map((p) => ({ p, stored: store.viewFor(roomId, p)! }));
    const game = views[0]!.stored.view.game!;
    if (game.phase === 'gameOver') return;
    if (game.phase === 'handOver') {
      for (const { p } of views) await call(store, p, { type: 'continue', roomId });
      continue;
    }
    const turn = views.find((v) => v.stored.seat === game.currentPlayer)!;
    // Le bot joue à partir de l'état complet ici uniquement pour choisir un coup légal.
    const state = store.rooms.get(roomId)!.game!;
    const action: GameAction = chooseBotAction(botView(state, turn.stored.seat));
    const result = await call(store, turn.p, { type: 'game', roomId, action });
    if (!result.ok) throw new Error(result.error);
  }
}

describe('Test 13 (serveur) — les vues enregistrées ne révèlent jamais les mains adverses', () => {
  it('pendant une partie complète jouée au travers du serveur', async () => {
    const store = new MemoryStore();
    const { roomId } = await fullRoom(store);
    for (const p of PLAYERS) await call(store, p, { type: 'ready', roomId, ready: true });
    for (let step = 0; step < 4000; step++) {
      const state = store.rooms.get(roomId)!.game!;
      for (const p of PLAYERS) {
        const { seat, view } = store.viewFor(roomId, p)!;
        const json = JSON.stringify(view);
        expect(json).not.toContain(state.seed);
        for (const other of SEATS.filter((s) => s !== seat)) {
          for (const card of state.hands[other] ?? []) expect(json).not.toContain(`"${card.id}"`);
        }
      }
      if (state.phase === 'gameOver') break;
      await playThroughServer(store, roomId, 1);
    }
    expect(store.rooms.get(roomId)!.game!.phase).toBe('gameOver');
  });

  it('chaque manche utilise une nouvelle graine secrète', async () => {
    const store = new MemoryStore();
    const { roomId } = await fullRoom(store);
    for (const p of PLAYERS) await call(store, p, { type: 'ready', roomId, ready: true });
    const firstSeed = store.rooms.get(roomId)!.game!.seed;
    while (store.rooms.get(roomId)!.game!.handNumber === 1) await playThroughServer(store, roomId, 1);
    expect(store.rooms.get(roomId)!.game!.seed).not.toBe(firstSeed);
  });
});

describe('Test 14 — reprise après déconnexion', () => {
  it('un joueur qui revient avec la même identité retrouve sa place et sa main', async () => {
    const store = new MemoryStore();
    const { roomId, code } = await fullRoom(store);
    for (const p of PLAYERS) await call(store, p, { type: 'ready', roomId, ready: true });
    await playThroughServer(store, roomId, 12);
    const before = store.viewFor(roomId, PLAYERS[2]!)!;

    // Le joueur ferme son navigateur : rien ne change côté serveur, la partie est conservée.
    // Il revient avec le même code et la même identité de session.
    const back = await call(store, PLAYERS[2]!, { type: 'join', code, nickname: 'Joueur 3' });
    expect(back).toEqual({ ok: true, roomId, code });
    const after = store.viewFor(roomId, PLAYERS[2]!)!;
    expect(after.seat).toBe(before.seat);
    expect(after.view.game).toEqual(before.view.game);
  });

  it('il peut reprendre la partie là où elle en était', async () => {
    const store = new MemoryStore();
    const { roomId, code } = await fullRoom(store);
    for (const p of PLAYERS) await call(store, p, { type: 'ready', roomId, ready: true });
    await call(store, PLAYERS[1]!, { type: 'join', code, nickname: 'Revenu' });
    await playThroughServer(store, roomId, 40);
    const view = store.viewFor(roomId, PLAYERS[1]!)!.view;
    expect(view.players[1]!.nickname).toBe('Revenu');
    expect(view.game!.handNumber).toBeGreaterThanOrEqual(1);
  });

  it('une autre identité ne peut ni prendre sa place ni jouer à sa place', async () => {
    const store = new MemoryStore();
    const { roomId, code } = await fullRoom(store);
    for (const p of PLAYERS) await call(store, p, { type: 'ready', roomId, ready: true });
    expect(await call(store, 'usurpateur', { type: 'join', code, nickname: 'Joueur 3' })).toEqual({
      ok: false,
      error: 'La partie a déjà commencé dans ce salon.',
    });
    const view = store.viewFor(roomId, PLAYERS[0]!)!.view;
    const action = { type: 'game', roomId, action: { type: 'bid', bid: { type: 'pass' } } };
    expect(await call(store, 'usurpateur', action)).toEqual({ ok: false, error: 'Vous ne faites pas partie de ce salon.' });
    // Un vrai joueur qui n'est pas attendu est refusé par le moteur.
    const notMyTurn = PLAYERS.find((p) => store.viewFor(roomId, p)!.seat !== view.game!.currentPlayer)!;
    expect(await call(store, notMyTurn, action)).toEqual({ ok: false, error: "Ce n'est pas à vous de jouer." });
  });

  it('deux requêtes simultanées ne s’écrasent pas (contrôle de version)', async () => {
    const store = new MemoryStore();
    const created = await call(store, PLAYERS[0]!, { type: 'create', nickname: 'Amel' });
    if (!created.ok) throw new Error(created.error);
    await Promise.all(PLAYERS.slice(1).map((p, i) => call(store, p, { type: 'join', code: created.code, nickname: `J${i}` })));
    const seats = PLAYERS.map((p) => store.viewFor(created.roomId, p)?.seat).sort();
    expect(seats).toEqual([0, 1, 2, 3] satisfies Seat[]);
  });
});
