import { MAX_LISTENER_CONNECTIONS } from '../../../voice/listen.ts';
import type { ListenMessage } from '../../../voice/listen.ts';
import type { IceServer, VoiceSeat } from '../../../voice/protocol.ts';

interface ListenerPeer {
  readonly listener: string;
  readonly pc: RTCPeerConnection;
  readonly pending: RTCIceCandidateInit[];
}

/**
 * Côté joueur : envoie sa voix aux spectateurs autorisés à écouter (une connexion WebRTC en envoi
 * seul par auditeur, au plus MAX_LISTENER_CONNECTIONS). Rien n'est jamais reçu d'un auditeur, à part
 * la signalisation. Sans micro (ou hors du vocal), le joueur n'envoie rien.
 */
export class ListenerHub {
  private session = crypto.randomUUID();
  private stream: MediaStream | null = null;
  private muted = false;
  private readonly peers = new Map<string, ListenerPeer>();

  constructor(
    private seat: VoiceSeat,
    private readonly send: (message: ListenMessage) => void,
    private readonly iceServers: () => readonly IceServer[],
    private readonly onChange: (listeners: number) => void,
  ) {}

  /** Le micro du joueur (null : il n'est pas dans le vocal, ou il n'a pas de micro). */
  setStream(stream: MediaStream | null, muted: boolean): void {
    if (!stream) {
      if (this.stream) this.send({ type: 'player-bye', seat: this.seat, session: this.session });
      this.closeAll();
      this.stream = null;
      this.muted = muted;
      return;
    }
    if (this.stream === stream) {
      if (this.muted !== muted) this.setMuted(muted);
      return;
    }
    const replacing = this.stream !== null;
    this.stream = stream;
    this.muted = muted;
    const track = stream.getAudioTracks()[0] ?? null;
    if (replacing) {
      // Micro relancé (écran verrouillé, appel) : on remplace la piste sans recréer les connexions.
      for (const peer of this.peers.values()) {
        const sender = peer.pc.getSenders().find((s) => s.track?.kind === 'audio' || s.track === null);
        void sender?.replaceTrack(track);
      }
    } else {
      this.announce();
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.stream) this.send({ type: 'player-mute', seat: this.seat, session: this.session, muted });
  }

  /** Place changée (salon d'attente) : on se réannonce sous la nouvelle place. */
  setSeat(seat: VoiceSeat): void {
    if (seat === this.seat) return;
    if (this.stream) this.send({ type: 'player-bye', seat: this.seat, session: this.session });
    this.closeAll();
    this.seat = seat;
    this.session = crypto.randomUUID();
    this.announce();
  }

  /** Arrivée dans le vocal, ou reconnexion au canal d'écoute : les auditeurs se présentent. */
  announce(): void {
    if (this.stream) this.send({ type: 'player-hello', seat: this.seat, session: this.session, muted: this.muted });
  }

  handleMessage(message: ListenMessage): void {
    if (!this.stream) return;
    switch (message.type) {
      case 'listen-hello':
        this.call(message.listener);
        break;
      case 'listen-bye':
        this.close(message.listener);
        break;
      case 'listen-signal':
        if (message.from !== 'listener' || message.seat !== this.seat || message.session !== this.session) return;
        void this.handleSignal(message);
        break;
      default:
        break;
    }
  }

  destroy(): void {
    this.setStream(null, false);
  }

  private call(listener: string): void {
    const existing = this.peers.get(listener);
    // Déjà relié (ou en cours) : un « bonjour » répété ne recrée pas la connexion.
    if (existing && existing.pc.connectionState !== 'failed' && existing.pc.connectionState !== 'closed') return;
    if (existing) this.close(listener);
    if (this.peers.size >= MAX_LISTENER_CONNECTIONS || !this.stream) return;

    const pc = new RTCPeerConnection({ iceServers: this.iceServers().map((s) => ({ ...s, urls: [...[s.urls].flat()] })) });
    const peer: ListenerPeer = { listener, pc, pending: [] };
    this.peers.set(listener, peer);
    for (const track of this.stream.getAudioTracks()) {
      const sender = pc.addTrack(track, this.stream);
      const transceiver = pc.getTransceivers().find((t) => t.sender === sender);
      if (transceiver) transceiver.direction = 'sendonly';
    }
    pc.onicecandidate = (event) => {
      if (!event.candidate?.candidate) return;
      this.send({
        type: 'listen-signal',
        from: 'player',
        seat: this.seat,
        session: this.session,
        listener,
        candidate: {
          candidate: event.candidate.candidate,
          sdpMid: event.candidate.sdpMid ?? null,
          sdpMLineIndex: event.candidate.sdpMLineIndex ?? null,
        },
      });
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') this.close(listener);
    };
    void (async () => {
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        if (offer.sdp) {
          this.send({
            type: 'listen-signal',
            from: 'player',
            seat: this.seat,
            session: this.session,
            listener,
            description: { type: 'offer', sdp: offer.sdp },
          });
        }
      } catch {
        this.close(listener);
      }
    })();
    this.onChange(this.peers.size);
  }

  private async handleSignal(message: Extract<ListenMessage, { type: 'listen-signal' }>): Promise<void> {
    const peer = this.peers.get(message.listener);
    if (!peer) return;
    try {
      if (message.description?.type === 'answer') {
        await peer.pc.setRemoteDescription(message.description);
        for (const candidate of peer.pending.splice(0)) await peer.pc.addIceCandidate(candidate);
      }
      if (message.candidate) {
        if (peer.pc.remoteDescription) await peer.pc.addIceCandidate(message.candidate);
        else peer.pending.push(message.candidate);
      }
    } catch {
      // Message obsolète : ignoré.
    }
  }

  private close(listener: string): void {
    const peer = this.peers.get(listener);
    if (!peer) return;
    this.peers.delete(listener);
    peer.pc.close();
    this.onChange(this.peers.size);
  }

  private closeAll(): void {
    for (const listener of [...this.peers.keys()]) this.close(listener);
  }
}
