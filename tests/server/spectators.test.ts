import { beforeEach, describe, expect, it } from 'vitest';
import { MAX_SPECTATORS, SPECTATOR_STALE_HOURS, handleRequest, handleVoiceConfig, parseRequest, parseSettings } from '../../src/server/index.ts';
import type { ServerDeps, SpectatorMode } from '../../src/server/index.ts';
import { MemoryStore } from './memoryStore.ts';

let counter = 0;
let clock = 1_000_000;
const deps: ServerDeps = {
  newRoomId: () => `00000000-0000-4000-8000-${String(++counter).padStart(12, '0')}`,
  newRoomCode: () => `SPE${String(++counter).padStart(3, '2').slice(-3)}`.replace(/[01]/g, '9'),
  newSecureSeed: () => `graine-spectateurs-${++counter}-${'s'.repeat(24)}`,
  now: () => clock,
};
const PLAYERS = ['hote', 'b', 'c', 'd'];
const call = (store: MemoryStore, userId: string, request: unknown) => handleRequest(store, deps, userId, request);

const settings = (spectators?: SpectatorMode) => ({
  rules: {
    targetScore: 1500,
    contractSuccessScoring: 'realizedPoints',
    allowRebidAfterPass: true,
    allowOverbidSameSuit: true,
    requireUndertrump: true,
    beloteAlwaysScored: true,
    capotMultiplied: true,
  },
  absenceDelaySeconds: 30,
  ...(spectators ? { spectators } : {}),
});

/** Une table du café avec 4 joueurs, et le réglage des spectateurs choisi par le créateur. */
async function table(store: MemoryStore, mode?: SpectatorMode) {
  const created = await call(store, PLAYERS[0]!, { type: 'create', nickname: 'Hôte', table: 3 });
  if (!created.ok) throw new Error(created.error);
  for (const p of PLAYERS.slice(1)) await call(store, p, { type: 'join', code: created.code, nickname: `Joueur ${p}` });
  if (mode) {
    const set = await call(store, PLAYERS[0]!, { type: 'settings', roomId: created.roomId, settings: settings(mode) });
    if (!set.ok) throw new Error(set.error);
  }
  return created.roomId;
}

describe('Spectateurs : le créateur du salon décide, le spectateur donne son nom', () => {
  let store: MemoryStore;
  beforeEach(() => {
    store = new MemoryStore();
  });

  it('le réglage : refusés, regarder, ou regarder et écouter (rien d’autre)', () => {
    expect(parseSettings(settings('none'))?.spectators).toBe('none');
    expect(parseSettings(settings('listen'))?.spectators).toBe('listen');
    expect(parseSettings({ ...settings(), spectators: 'tout' })).toBeNull();
    // Un ancien écran sans ce réglage : accepté, le réglage actuel est gardé.
    expect(parseSettings(settings())?.spectators).toBeUndefined();
  });

  it('seul le créateur change le réglage', async () => {
    const roomId = await table(store);
    const refused = await call(store, 'b', { type: 'settings', roomId, settings: settings('listen') });
    expect(refused.ok).toBe(false);
    expect(store.rooms.get(roomId)!.settings.spectators ?? 'watch').toBe('watch');
  });

  it('il faut un nom pour regarder', () => {
    const roomId = '00000000-0000-4000-8000-000000000001';
    expect(parseRequest({ type: 'watch', roomId })).toBeNull();
    expect(parseRequest({ type: 'watch', roomId, nickname: '   ' })).toBeNull();
    expect(parseRequest({ type: 'watch', roomId, nickname: ' Sami ' })).toEqual({ type: 'watch', roomId, nickname: 'Sami' });
  });

  it('« regarder » : le spectateur inscrit lit la partie, pas les autres ; les joueurs voient son nom', async () => {
    const roomId = await table(store, 'watch');
    expect(store.watchFor(roomId, 'curieux')).toBeUndefined();
    const watched = await call(store, 'curieux', { type: 'watch', roomId, nickname: 'Sami' });
    expect(watched).toEqual({ ok: true, roomId, code: '', listen: false });
    expect(store.watchFor(roomId, 'curieux')?.spectators).toEqual(['Sami']);
    expect(store.watchFor(roomId, 'inconnu')).toBeUndefined();
    expect(store.viewFor(roomId, 'hote')!.view.spectators).toEqual(['Sami']);
    // Le code du salon ne quitte jamais les joueurs.
    expect(JSON.stringify(store.watch.get(roomId))).not.toContain(store.rooms.get(roomId)!.code);
    // Pas de vocal pour lui.
    const voice = await handleVoiceConfig(store, 'curieux', { roomId }, async () => null);
    expect(voice.ok).toBe(false);
  });

  it('« regarder et écouter » : le spectateur peut aussi rejoindre le vocal (en écoute)', async () => {
    const roomId = await table(store, 'listen');
    const watched = await call(store, 'auditeur', { type: 'watch', roomId, nickname: 'Mounir' });
    expect(watched).toEqual({ ok: true, roomId, code: '', listen: true });
    expect(store.spectators.get(roomId)).toEqual([{ userId: 'auditeur', name: 'Mounir', canListen: true }]);
    const voice = await handleVoiceConfig(store, 'auditeur', { roomId }, async () => null);
    expect(voice.ok).toBe(true);
    expect(store.cafe.get(3)!.info.spectators).toBe('listen');
  });

  it('« refusés » : personne ne peut regarder, aucune vue de la partie n’est publiée', async () => {
    const roomId = await table(store, 'none');
    const refused = await call(store, 'curieux', { type: 'watch', roomId, nickname: 'Sami' });
    expect(refused.ok).toBe(false);
    expect(store.watch.has(roomId)).toBe(false);
    expect(store.cafe.get(3)!.info.spectators).toBe('none');
  });

  it('passer à « refusés » met dehors les spectateurs déjà là', async () => {
    const roomId = await table(store, 'listen');
    await call(store, 'curieux', { type: 'watch', roomId, nickname: 'Sami' });
    await call(store, 'hote', { type: 'settings', roomId, settings: settings('none') });
    expect(store.rooms.get(roomId)!.spectators).toEqual([]);
    expect(store.watchFor(roomId, 'curieux')).toBeUndefined();
    expect(store.viewFor(roomId, 'hote')!.view.spectators).toEqual([]);
  });

  it('un joueur ne s’inscrit pas comme spectateur de sa propre table', async () => {
    const roomId = await table(store, 'watch');
    expect((await call(store, 'b', { type: 'watch', roomId, nickname: 'B' })).ok).toBe(false);
  });

  it('un spectateur ne prend pas le nom d’un joueur ni d’un autre spectateur', async () => {
    const roomId = await table(store, 'watch');
    const taken = { ok: false, error: 'Ce nom est déjà pris à cette table : choisissez-en un autre.' };
    expect(await call(store, 'x', { type: 'watch', roomId, nickname: 'hôte' })).toEqual(taken);
    expect(await call(store, 'x', { type: 'watch', roomId, nickname: 'JOUEUR B' })).toEqual(taken);
    expect((await call(store, 'x', { type: 'watch', roomId, nickname: 'Sami' })).ok).toBe(true);
    expect(await call(store, 'y', { type: 'watch', roomId, nickname: 'sami' })).toEqual(taken);
    // Le même spectateur peut se réinscrire avec son propre nom.
    expect((await call(store, 'x', { type: 'watch', roomId, nickname: 'Sami' })).ok).toBe(true);
  });

  it('partir : « ne plus regarder » ; revenir met le nom à jour ; liste bornée et oubli après 6 heures', async () => {
    const roomId = await table(store, 'watch');
    await call(store, 'x', { type: 'watch', roomId, nickname: 'Sami' });
    await call(store, 'x', { type: 'watch', roomId, nickname: 'Sami B.' });
    expect(store.viewFor(roomId, 'hote')!.view.spectators).toEqual(['Sami B.']);
    await call(store, 'x', { type: 'unwatch', roomId });
    expect(store.watchFor(roomId, 'x')).toBeUndefined();

    for (let i = 0; i < MAX_SPECTATORS + 5; i++) await call(store, `s${i}`, { type: 'watch', roomId, nickname: `S${i}` });
    expect(store.rooms.get(roomId)!.spectators).toHaveLength(MAX_SPECTATORS);
    expect(store.watchFor(roomId, 's0')).toBeUndefined();
    expect(store.watchFor(roomId, `s${MAX_SPECTATORS + 4}`)).toBeDefined();

    clock += SPECTATOR_STALE_HOURS * 3_600_000 + 1;
    await call(store, 'nouveau', { type: 'watch', roomId, nickname: 'Nouveau' });
    expect(store.rooms.get(roomId)!.spectators!.map((s) => s.name)).toEqual(['Nouveau']);
  });
});
