import { describe, expect, it } from 'vitest';
import { SpeakingDetector, parseIceServers, parseVoiceMessage, rmsLevel, shouldInitiate } from '../../src/voice/protocol.ts';

describe('Protocole vocal', () => {
  it('une seule des deux places lance l’appel, quel que soit le couple', () => {
    for (const a of [0, 1, 2, 3] as const) {
      for (const b of [0, 1, 2, 3] as const) {
        if (a === b) continue;
        expect(shouldInitiate(a, b)).not.toBe(shouldInitiate(b, a));
      }
    }
  });

  it('accepte les messages bien formés', () => {
    expect(parseVoiceMessage({ type: 'hello', seat: 2, session: 'abc', muted: false })).toEqual({
      type: 'hello',
      seat: 2,
      session: 'abc',
      muted: false,
    });
    const offer = { type: 'signal', seat: 0, session: 's0', to: 3, toSession: 's3', description: { type: 'offer', sdp: 'v=0' } };
    expect(parseVoiceMessage(offer)).toEqual(offer);
    const candidate = {
      type: 'signal',
      seat: 1,
      session: 's1',
      to: 2,
      toSession: 's2',
      candidate: { candidate: 'candidate:1 1 udp 1 1.2.3.4 5 typ host', sdpMid: '0', sdpMLineIndex: 0 },
    };
    expect(parseVoiceMessage(candidate)).toEqual(candidate);
  });

  it('refuse les messages mal formés ou suspects', () => {
    expect(parseVoiceMessage(null)).toBeNull();
    expect(parseVoiceMessage({ type: 'hello', seat: 4, session: 'x', muted: false })).toBeNull();
    expect(parseVoiceMessage({ type: 'hello', seat: 1, session: '', muted: false })).toBeNull();
    expect(parseVoiceMessage({ type: 'hello', seat: 1, session: 'x' })).toBeNull();
    expect(parseVoiceMessage({ type: 'signal', seat: 1, session: 'x', to: 2, toSession: 'y' })).toBeNull();
    expect(
      parseVoiceMessage({ type: 'signal', seat: 1, session: 'x', to: 2, toSession: 'y', description: { type: 'pirate', sdp: '' } }),
    ).toBeNull();
    expect(
      parseVoiceMessage({ type: 'signal', seat: 1, session: 'x', to: 2, toSession: 'y', description: { type: 'offer', sdp: 'a'.repeat(30_000) } }),
    ).toBeNull();
    expect(parseVoiceMessage({ type: 'inconnu', seat: 1, session: 'x' })).toBeNull();
  });

  it('valide les serveurs STUN/TURN', () => {
    expect(parseIceServers([{ urls: 'stun:stun.example.com' }])).toEqual([{ urls: ['stun:stun.example.com'] }]);
    expect(parseIceServers([{ urls: ['turn:t.example.com:3478', 'turns:t.example.com:443'], username: 'u', credential: 'c' }])).toEqual([
      { urls: ['turn:t.example.com:3478', 'turns:t.example.com:443'], username: 'u', credential: 'c' },
    ]);
    expect(parseIceServers([{ urls: 'http://pirate.example.com' }])).toBeNull();
    expect(parseIceServers([])).toBeNull();
    expect(parseIceServers('stun:x')).toBeNull();
  });
});

describe('Détection de parole', () => {
  it('calcule un niveau nul pour le silence et élevé pour un son fort', () => {
    expect(rmsLevel(new Uint8Array(256).fill(128))).toBe(0);
    const loud = Uint8Array.from({ length: 256 }, (_, i) => (i % 2 ? 228 : 28));
    expect(rmsLevel(loud)).toBeGreaterThan(0.5);
  });

  it('reste allumé un court instant après la fin du son, puis s’éteint', () => {
    const d = new SpeakingDetector(0.02, 300);
    expect(d.update(0.001, 0)).toBe(false);
    expect(d.update(0.1, 100)).toBe(true);
    expect(d.update(0.001, 300)).toBe(true);
    expect(d.update(0.001, 401)).toBe(false);
  });
});
