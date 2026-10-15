import { describe, expect, it } from 'vitest';
import { MAX_LISTENER_CONNECTIONS, parseListenMessage } from '../../src/voice/listen.ts';
import { audienceText } from '../../src/ui/online/audience.ts';

const sdp = 'v=0\r\no=- 1 2 IN IP4 127.0.0.1\r\n';

describe('Écoute des spectateurs : les messages du canal « ecoute: »', () => {
  it('accepte les messages bien formés', () => {
    expect(parseListenMessage({ type: 'listen-hello', listener: 'abc' })).toEqual({ type: 'listen-hello', listener: 'abc' });
    expect(parseListenMessage({ type: 'player-hello', seat: 2, session: 's', muted: false })).toEqual({
      type: 'player-hello',
      seat: 2,
      session: 's',
      muted: false,
    });
    expect(
      parseListenMessage({ type: 'listen-signal', from: 'player', seat: 0, session: 's', listener: 'l', description: { type: 'offer', sdp } }),
    ).toMatchObject({ type: 'listen-signal', from: 'player', description: { type: 'offer' } });
    expect(
      parseListenMessage({
        type: 'listen-signal',
        from: 'listener',
        seat: 0,
        session: 's',
        listener: 'l',
        candidate: { candidate: 'candidate:1 1 udp 1 1.2.3.4 5 typ host', sdpMid: '0', sdpMLineIndex: 0 },
      }),
    ).toMatchObject({ from: 'listener', candidate: { sdpMid: '0' } });
  });

  it('l’offre vient toujours d’un joueur et la réponse d’un auditeur : un auditeur ne peut pas appeler un joueur', () => {
    const base = { type: 'listen-signal', seat: 1, session: 's', listener: 'l' };
    expect(parseListenMessage({ ...base, from: 'listener', description: { type: 'offer', sdp } })).toBeNull();
    expect(parseListenMessage({ ...base, from: 'player', description: { type: 'answer', sdp } })).toBeNull();
  });

  it('refuse les messages abîmés ou trop gros', () => {
    expect(parseListenMessage(null)).toBeNull();
    expect(parseListenMessage({ type: 'listen-hello' })).toBeNull();
    expect(parseListenMessage({ type: 'listen-hello', listener: 'x'.repeat(65) })).toBeNull();
    expect(parseListenMessage({ type: 'player-hello', seat: 4, session: 's', muted: false })).toBeNull();
    expect(parseListenMessage({ type: 'listen-signal', from: 'player', seat: 0, session: 's', listener: 'l' })).toBeNull();
    expect(
      parseListenMessage({ type: 'listen-signal', from: 'player', seat: 0, session: 's', listener: 'l', description: { type: 'offer', sdp: 'x'.repeat(20_001) } }),
    ).toBeNull();
    expect(parseListenMessage({ type: 'hello', seat: 0, session: 's', muted: false })).toBeNull();
  });

  it('chaque joueur limite le nombre d’auditeurs qu’il appelle', () => {
    expect(MAX_LISTENER_CONNECTIONS).toBeGreaterThanOrEqual(5);
    expect(MAX_LISTENER_CONNECTIONS).toBeLessThanOrEqual(15);
  });
});

describe('Les joueurs savent toujours qui les regarde', () => {
  it('rien si personne ne regarde', () => {
    expect(audienceText([], 'listen')).toBeNull();
  });

  it('regarder, ou regarder et écouter (et combien les entendent en ce moment)', () => {
    expect(audienceText(['Sami'], 'watch')).toBe('👀 Sami regarde');
    expect(audienceText(['Sami', 'Mounir'], 'listen')).toBe('👀 Sami, Mounir regardent et peuvent écouter');
    expect(audienceText(['Sami'], 'listen', 1)).toBe('👀 Sami regarde et peut écouter · 🎧 1 vous entend');
    expect(audienceText(['A', 'B', 'C', 'D', 'E'], 'watch')).toBe('👀 A, B, C et 2 autres regardent');
  });
});
