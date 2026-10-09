import { describe, expect, it } from 'vitest';
import { handleRequest, handleVoiceConfig, parseCloudflareResponse, staticTurnServer } from '../../src/server/index.ts';
import { DEFAULT_ICE_SERVERS } from '../../src/voice/protocol.ts';
import { MemoryStore } from './memoryStore.ts';

const deps = {
  newRoomId: () => '00000000-0000-4000-8000-0000000000aa',
  newRoomCode: () => 'VOX234',
  newSecureSeed: () => 'graine-vocal-tres-longue-et-secrete',
};

describe('Configuration du vocal (serveurs STUN/TURN)', () => {
  it('TURN à identifiants fixes, seulement si tout est fourni', () => {
    expect(staticTurnServer({})).toBeNull();
    expect(staticTurnServer({ TURN_URLS: 'turn:a:3478', TURN_USERNAME: 'u' })).toBeNull();
    expect(
      staticTurnServer({ TURN_URLS: 'turn:a:80, turns:a:443, http://x', TURN_USERNAME: 'u', TURN_CREDENTIAL: 'c' }),
    ).toEqual({ urls: ['turn:a:80', 'turns:a:443'], username: 'u', credential: 'c' });
  });

  it('lit les deux formats de réponse de Cloudflare', () => {
    const single = { iceServers: { urls: ['turn:turn.cloudflare.com:3478'], username: 'u', credential: 'c' } };
    expect(parseCloudflareResponse(single)).toEqual([single.iceServers]);
    const list = { iceServers: [{ urls: 'stun:stun.cloudflare.com:3478' }, single.iceServers] };
    expect(parseCloudflareResponse(list)).toHaveLength(2);
    expect(parseCloudflareResponse({ erreur: true })).toBeNull();
  });

  it('ne donne les identifiants TURN qu’aux membres du salon', async () => {
    const store = new MemoryStore();
    const created = await handleRequest(store, deps, 'membre', { type: 'create', nickname: 'Amel' });
    if (!created.ok) throw new Error(created.error);
    const turn = [{ urls: ['turn:t:3478'], username: 'u', credential: 'secret' }];
    const fetchTurn = async () => turn;

    const member = await handleVoiceConfig(store, 'membre', { roomId: created.roomId }, fetchTurn);
    expect(member).toEqual({ ok: true, iceServers: [...DEFAULT_ICE_SERVERS, ...turn] });

    const stranger = await handleVoiceConfig(store, 'inconnu', { roomId: created.roomId }, fetchTurn);
    expect(stranger.ok).toBe(false);
    expect(JSON.stringify(stranger)).not.toContain('secret');

    expect((await handleVoiceConfig(store, 'membre', { roomId: 'pas-un-uuid' }, fetchTurn)).ok).toBe(false);
  });

  it('sans TURN (ou en cas de panne du fournisseur), donne au moins les serveurs STUN', async () => {
    const store = new MemoryStore();
    const created = await handleRequest(store, deps, 'membre', { type: 'create', nickname: 'Amel' });
    if (!created.ok) throw new Error(created.error);
    const failing = async () => {
      throw new Error('fournisseur indisponible');
    };
    expect(await handleVoiceConfig(store, 'membre', { roomId: created.roomId }, failing)).toEqual({
      ok: true,
      iceServers: DEFAULT_ICE_SERVERS,
    });
  });
});
