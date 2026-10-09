/**
 * Protocole du vocal : messages échangés sur le canal privé du salon (Supabase Realtime)
 * pour établir les connexions WebRTC entre les 4 joueurs (maillage : 3 connexions chacun).
 * Ce fichier ne dépend ni du navigateur ni de Node : il est testé directement.
 */

export type VoiceSeat = 0 | 1 | 2 | 3;

export interface IceServer {
  readonly urls: string | readonly string[];
  readonly username?: string;
  readonly credential?: string;
}

export interface SessionDescription {
  readonly type: 'offer' | 'answer';
  readonly sdp: string;
}

export interface IceCandidate {
  readonly candidate: string;
  readonly sdpMid?: string | null;
  readonly sdpMLineIndex?: number | null;
}

export type VoiceMessage =
  /** J'arrive dans le vocal : ceux qui y sont déjà répondent « here ». */
  | { readonly type: 'hello'; readonly seat: VoiceSeat; readonly session: string; readonly muted: boolean }
  | { readonly type: 'here'; readonly seat: VoiceSeat; readonly session: string; readonly muted: boolean }
  | { readonly type: 'bye'; readonly seat: VoiceSeat; readonly session: string }
  | { readonly type: 'mute'; readonly seat: VoiceSeat; readonly session: string; readonly muted: boolean }
  | {
      readonly type: 'signal';
      readonly seat: VoiceSeat;
      readonly session: string;
      readonly to: VoiceSeat;
      readonly toSession: string;
      readonly description?: SessionDescription;
      readonly candidate?: IceCandidate;
    };

/** Serveurs STUN publics utilisés par défaut (sans TURN, certains réseaux mobiles peuvent bloquer). */
export const DEFAULT_ICE_SERVERS: readonly IceServer[] = [
  { urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.l.google.com:19302'] },
];

/** Pour éviter que deux joueurs s'appellent en même temps, seule la plus petite place appelle. */
export function shouldInitiate(mySeat: VoiceSeat, otherSeat: VoiceSeat): boolean {
  return mySeat < otherSeat;
}

const isSeat = (v: unknown): v is VoiceSeat => v === 0 || v === 1 || v === 2 || v === 3;
const isSession = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 64;
const MAX_SDP_LENGTH = 20_000;

function parseDescription(raw: unknown): SessionDescription | undefined | null {
  if (raw === undefined) return undefined;
  if (typeof raw !== 'object' || raw === null) return null;
  const d = raw as Record<string, unknown>;
  if ((d.type !== 'offer' && d.type !== 'answer') || typeof d.sdp !== 'string' || d.sdp.length > MAX_SDP_LENGTH) return null;
  return { type: d.type, sdp: d.sdp };
}

function parseCandidate(raw: unknown): IceCandidate | undefined | null {
  if (raw === undefined) return undefined;
  if (typeof raw !== 'object' || raw === null) return null;
  const c = raw as Record<string, unknown>;
  if (typeof c.candidate !== 'string' || c.candidate.length > 2_000) return null;
  return {
    candidate: c.candidate,
    sdpMid: typeof c.sdpMid === 'string' ? c.sdpMid : null,
    sdpMLineIndex: typeof c.sdpMLineIndex === 'number' ? c.sdpMLineIndex : null,
  };
}

/** Valide un message reçu d'un autre navigateur (donnée non fiable). */
export function parseVoiceMessage(raw: unknown): VoiceMessage | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const m = raw as Record<string, unknown>;
  if (!isSeat(m.seat) || !isSession(m.session)) return null;
  const { seat, session } = m;
  switch (m.type) {
    case 'hello':
    case 'here':
    case 'mute':
      return typeof m.muted === 'boolean' ? { type: m.type, seat, session, muted: m.muted } : null;
    case 'bye':
      return { type: 'bye', seat, session };
    case 'signal': {
      if (!isSeat(m.to) || !isSession(m.toSession)) return null;
      const description = parseDescription(m.description);
      const candidate = parseCandidate(m.candidate);
      if (description === null || candidate === null || (!description && !candidate)) return null;
      return {
        type: 'signal',
        seat,
        session,
        to: m.to,
        toSession: m.toSession,
        ...(description ? { description } : {}),
        ...(candidate ? { candidate } : {}),
      };
    }
    default:
      return null;
  }
}

/** Valide une liste de serveurs ICE (STUN/TURN) reçue du serveur de jeu. */
export function parseIceServers(raw: unknown): IceServer[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const servers: IceServer[] = [];
  for (const entry of raw) {
    if (typeof entry !== 'object' || entry === null) return null;
    const e = entry as Record<string, unknown>;
    const urls = typeof e.urls === 'string' ? [e.urls] : Array.isArray(e.urls) ? e.urls : null;
    if (!urls || urls.length === 0 || !urls.every((u) => typeof u === 'string' && /^(stun|turns?):/.test(u))) return null;
    servers.push({
      urls: urls as string[],
      ...(typeof e.username === 'string' ? { username: e.username } : {}),
      ...(typeof e.credential === 'string' ? { credential: e.credential } : {}),
    });
  }
  return servers;
}

/**
 * Détecteur de parole : un niveau sonore au-dessus du seuil allume l'indicateur,
 * qui reste allumé un court instant après la fin du son pour éviter le clignotement.
 */
export class SpeakingDetector {
  private lastLoud = Number.NEGATIVE_INFINITY;

  constructor(
    private readonly threshold = 0.02,
    private readonly holdMs = 350,
  ) {}

  update(level: number, now: number): boolean {
    if (level >= this.threshold) this.lastLoud = now;
    return now - this.lastLoud <= this.holdMs;
  }
}

/** Niveau sonore (RMS) d'un échantillon audio, entre 0 et 1 (valeurs centrées sur 128). */
export function rmsLevel(samples: ArrayLike<number>): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    const v = ((samples[i] ?? 128) - 128) / 128;
    sum += v * v;
  }
  return Math.sqrt(sum / samples.length);
}
