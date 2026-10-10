import { describe, expect, it } from 'vitest';
import { handleRequest, parseSettings } from '../../src/server/index.ts';
import type { ServerDeps } from '../../src/server/index.ts';
import { MemoryStore } from './memoryStore.ts';

let n = 0;
const deps: ServerDeps = {
  newRoomId: () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`,
  newRoomCode: () => `SET${String(n).padStart(3, '2').slice(-3)}`.replace(/[01]/g, '9'),
  newSecureSeed: () => `graine-reglages-${++n}-${'q'.repeat(24)}`,
};
const PLAYERS = ['hote', 'b', 'c', 'd'];

const settings = (overrides: Record<string, unknown> = {}, delay: unknown = 30) => ({
  rules: {
    targetScore: 1000,
    contractSuccessScoring: 'contractPlusPoints',
    allowRebidAfterPass: true,
    allowOverbidSameSuit: false,
    requireUndertrump: false,
    beloteAlwaysScored: false,
    capotMultiplied: false,
    ...overrides,
  },
  absenceDelaySeconds: delay,
});

async function room(store: MemoryStore) {
  const created = await handleRequest(store, deps, PLAYERS[0]!, { type: 'create', nickname: 'Hôte' });
  if (!created.ok) throw new Error(created.error);
  for (const p of PLAYERS.slice(1)) await handleRequest(store, deps, p, { type: 'join', code: created.code, nickname: p });
  return created;
}

describe('Réglages du salon', () => {
  it('accepte uniquement les valeurs prévues', () => {
    expect(parseSettings(settings())).not.toBeNull();
    expect(parseSettings(settings({ targetScore: 1234 }))).toBeNull();
    expect(parseSettings(settings({ contractSuccessScoring: 'autre' }))).toBeNull();
    expect(parseSettings(settings({ allowRebidAfterPass: 'oui' }))).toBeNull();
    expect(parseSettings(settings({}, 5))).toBeNull();
    // Une règle non prévue (ex. multiplicateur) est ignorée, jamais transmise au moteur.
    const parsed = parseSettings(settings({ coincheMultiplier: 100 }));
    expect(parsed?.rules).not.toHaveProperty('coincheMultiplier');
  });

  it('seul l’hôte modifie les réglages ; chacun redevient « pas prêt »', async () => {
    const store = new MemoryStore();
    const { roomId } = await room(store);
    await handleRequest(store, deps, 'b', { type: 'ready', roomId, ready: true });
    expect(await handleRequest(store, deps, 'b', { type: 'settings', roomId, settings: settings() })).toEqual({
      ok: false,
      error: "Seul l'hôte du salon peut modifier les réglages.",
    });
    expect((await handleRequest(store, deps, 'hote', { type: 'settings', roomId, settings: settings() })).ok).toBe(true);
    const view = store.viewFor(roomId, 'b')!.view;
    expect(view.settings.rules.targetScore).toBe(1000);
    expect(view.settings.absenceDelaySeconds).toBe(30);
    expect(view.hostSeat).toBe(0);
    expect(view.players.every((p) => !p.ready)).toBe(true);
  });

  it('la partie utilise les règles choisies', async () => {
    const store = new MemoryStore();
    const { roomId } = await room(store);
    await handleRequest(store, deps, 'hote', { type: 'settings', roomId, settings: settings({ targetScore: 500 }) });
    for (const p of PLAYERS) await handleRequest(store, deps, p, { type: 'ready', roomId, ready: true });
    const config = store.rooms.get(roomId)!.game!.config;
    expect(config.targetScore).toBe(500);
    expect(config.contractSuccessScoring).toBe('contractPlusPoints');
    expect(config.allowRebidAfterPass).toBe(true);
    expect(store.viewFor(roomId, 'c')!.view.game!.config.targetScore).toBe(500);
    // Une fois la partie lancée, plus de changement possible.
    expect((await handleRequest(store, deps, 'hote', { type: 'settings', roomId, settings: settings() })).ok).toBe(false);
  });

  it('si l’hôte quitte le salon, le joueur à la plus petite place devient hôte', async () => {
    const store = new MemoryStore();
    const { roomId } = await room(store);
    await handleRequest(store, deps, 'hote', { type: 'leave', roomId });
    expect(store.viewFor(roomId, 'b')!.view.hostSeat).toBe(1);
    expect((await handleRequest(store, deps, 'b', { type: 'settings', roomId, settings: settings() })).ok).toBe(true);
  });
});
