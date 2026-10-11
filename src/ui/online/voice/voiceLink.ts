import type { VoiceSeat } from '../../../voice/protocol.ts';

/** État du lien vocal avec un joueur, pour le voyant à côté de son nom. */
export type VoiceLink = 'connected' | 'connecting' | 'failed';

/** Ce dont le voyant a besoin dans l'état du vocal. */
export interface VoiceLinkInput {
  readonly status: 'off' | 'starting' | 'on';
  readonly inVoice: ReadonlySet<VoiceSeat>;
  readonly connected: ReadonlySet<VoiceSeat>;
  readonly failed: ReadonlySet<VoiceSeat>;
}

/** Voyant de chaque joueur : null quand on n'est pas soi-même dans le vocal ou qu'il n'y est pas. */
export function voiceLinkOf(snapshot: VoiceLinkInput, seat: VoiceSeat, mySeat: VoiceSeat | null): VoiceLink | null {
  if (snapshot.status !== 'on') return null;
  if (seat === mySeat) return 'connected';
  if (snapshot.failed.has(seat)) return 'failed';
  if (snapshot.connected.has(seat)) return 'connected';
  return snapshot.inVoice.has(seat) ? 'connecting' : null;
}
