import { describe, expect, it } from 'vitest';
import { voiceLinkOf } from '../../src/ui/online/voice/voiceLink.ts';
import type { VoiceLinkInput } from '../../src/ui/online/voice/voiceLink.ts';

const VOICE_OFF: VoiceLinkInput = { status: 'off', inVoice: new Set(), connected: new Set(), failed: new Set() };
const on = (patch: Partial<VoiceLinkInput>): VoiceLinkInput => ({ ...VOICE_OFF, status: 'on', ...patch });

describe('Voyant du vocal', () => {
  it('rien tant qu’on n’est pas soi-même dans le vocal', () => {
    expect(voiceLinkOf(VOICE_OFF, 1, 0)).toBeNull();
  });

  it('vert = relié, orange = connexion en cours, rouge = échec, rien = pas dans le vocal', () => {
    const snapshot = on({ inVoice: new Set([1, 2, 3]), connected: new Set([1]), failed: new Set([3]) });
    expect(voiceLinkOf(snapshot, 0, 0)).toBe('connected');
    expect(voiceLinkOf(snapshot, 1, 0)).toBe('connected');
    expect(voiceLinkOf(snapshot, 2, 0)).toBe('connecting');
    expect(voiceLinkOf(snapshot, 3, 0)).toBe('failed');
    expect(voiceLinkOf(on({}), 2, 0)).toBeNull();
  });
});
