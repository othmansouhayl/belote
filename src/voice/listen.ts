/**
 * Écoute du vocal par les spectateurs : messages échangés sur le canal privé « ecoute:<salon> »
 * (réservé par la base aux joueurs et aux spectateurs autorisés à écouter). Chaque joueur qui a son
 * micro envoie sa voix à chaque auditeur (connexion WebRTC en envoi seul) ; l'auditeur ne fait que
 * recevoir : il n'a jamais de micro, et il n'entre jamais dans le canal des joueurs.
 * Ce fichier ne dépend ni du navigateur ni de Node : il est testé directement.
 */
import type { IceCandidate, SessionDescription, VoiceSeat } from './protocol.ts';

/** Chaque joueur envoie sa voix à 10 auditeurs au plus (sa connexion internet a ses limites). */
export const MAX_LISTENER_CONNECTIONS = 10;

export type ListenMessage =
  /** Un auditeur arrive (ou répond à un joueur qui vient d'arriver) : les joueurs l'appellent. */
  | { readonly type: 'listen-hello'; readonly listener: string }
  | { readonly type: 'listen-bye'; readonly listener: string }
  /** Un joueur entre dans le vocal (avec son micro) : les auditeurs se présentent. */
  | { readonly type: 'player-hello'; readonly seat: VoiceSeat; readonly session: string; readonly muted: boolean }
  | { readonly type: 'player-mute'; readonly seat: VoiceSeat; readonly session: string; readonly muted: boolean }
  | { readonly type: 'player-bye'; readonly seat: VoiceSeat; readonly session: string }
  /**
   * Signalisation entre un joueur (seat, session) et un auditeur : l'offre vient toujours du joueur,
   * la réponse de l'auditeur. `from` dit qui l'envoie.
   */
  | {
      readonly type: 'listen-signal';
      readonly from: 'player' | 'listener';
      readonly seat: VoiceSeat;
      readonly session: string;
      readonly listener: string;
      readonly description?: SessionDescription;
      readonly candidate?: IceCandidate;
    };

const isSeat = (v: unknown): v is VoiceSeat => v === 0 || v === 1 || v === 2 || v === 3;
const isId = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 64;
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

/** Valide un message reçu sur le canal d'écoute (donnée non fiable). */
export function parseListenMessage(raw: unknown): ListenMessage | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const m = raw as Record<string, unknown>;
  switch (m.type) {
    case 'listen-hello':
    case 'listen-bye':
      return isId(m.listener) ? { type: m.type, listener: m.listener } : null;
    case 'player-hello':
    case 'player-mute':
      return isSeat(m.seat) && isId(m.session) && typeof m.muted === 'boolean'
        ? { type: m.type, seat: m.seat, session: m.session, muted: m.muted }
        : null;
    case 'player-bye':
      return isSeat(m.seat) && isId(m.session) ? { type: 'player-bye', seat: m.seat, session: m.session } : null;
    case 'listen-signal': {
      if ((m.from !== 'player' && m.from !== 'listener') || !isSeat(m.seat) || !isId(m.session) || !isId(m.listener)) return null;
      const description = parseDescription(m.description);
      const candidate = parseCandidate(m.candidate);
      if (description === null || candidate === null || (!description && !candidate)) return null;
      // L'offre vient toujours du joueur, la réponse de l'auditeur.
      if (description?.type === 'offer' && m.from !== 'player') return null;
      if (description?.type === 'answer' && m.from !== 'listener') return null;
      return {
        type: 'listen-signal',
        from: m.from,
        seat: m.seat,
        session: m.session,
        listener: m.listener,
        ...(description ? { description } : {}),
        ...(candidate ? { candidate } : {}),
      };
    }
    default:
      return null;
  }
}
