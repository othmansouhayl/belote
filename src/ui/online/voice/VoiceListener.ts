import { DEFAULT_ICE_SERVERS, SpeakingDetector, rmsLevel } from '../../../voice/protocol.ts';
import type { IceServer, VoiceSeat } from '../../../voice/protocol.ts';
import type { ListenMessage } from '../../../voice/listen.ts';

export interface ListenerSnapshot {
  readonly status: 'off' | 'starting' | 'on';
  /** Joueurs qu'on entend (connexion établie). */
  readonly connected: ReadonlySet<VoiceSeat>;
  readonly speaking: ReadonlySet<VoiceSeat>;
  readonly mutedSeats: ReadonlySet<VoiceSeat>;
  /** iOS / navigateur a bloqué la lecture du son : il faut un appui de l'utilisateur. */
  readonly needsAudioUnlock: boolean;
}

export const LISTENER_OFF: ListenerSnapshot = {
  status: 'off',
  connected: new Set(),
  speaking: new Set(),
  mutedSeats: new Set(),
  needsAudioUnlock: false,
};

interface PlayerPeer {
  readonly seat: VoiceSeat;
  readonly session: string;
  readonly pc: RTCPeerConnection;
  readonly audio: HTMLAudioElement;
  readonly pending: RTCIceCandidateInit[];
  readonly detector: SpeakingDetector;
  muted: boolean;
  analyser: AnalyserNode | null;
  source: MediaStreamAudioSourceNode | null;
}

/**
 * Côté spectateur : écoute le vocal des joueurs, sans jamais parler (pas de micro demandé).
 * Chaque joueur qui a son micro l'appelle ; l'auditeur ne fait que répondre et recevoir.
 */
export class VoiceListener {
  readonly id = crypto.randomUUID();
  private status: ListenerSnapshot['status'] = 'off';
  private iceServers: readonly IceServer[] = DEFAULT_ICE_SERVERS;
  private audioContext: AudioContext | null = null;
  private needsAudioUnlock = false;
  private readonly peers = new Map<VoiceSeat, PlayerPeer>();
  private speaking = new Set<VoiceSeat>();
  private levelTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly send: (message: ListenMessage) => void,
    private readonly loadIceServers: () => Promise<readonly IceServer[]>,
    private readonly onChange: (snapshot: ListenerSnapshot) => void,
  ) {}

  /** À appeler depuis un appui (iOS exige un geste pour lire le son). */
  async start(): Promise<void> {
    if (this.status !== 'off') return;
    this.status = 'starting';
    this.audioContext = new AudioContext();
    void this.audioContext.resume();
    this.emit();
    try {
      this.iceServers = await this.loadIceServers();
    } catch {
      this.iceServers = DEFAULT_ICE_SERVERS;
    }
    if (this.status !== 'starting') return;
    this.status = 'on';
    this.levelTimer = setInterval(() => this.measureLevels(), 100);
    this.send({ type: 'listen-hello', listener: this.id });
    this.emit();
  }

  stop(): void {
    if (this.status === 'off') return;
    this.send({ type: 'listen-bye', listener: this.id });
    for (const seat of [...this.peers.keys()]) this.close(seat);
    if (this.levelTimer) clearInterval(this.levelTimer);
    this.levelTimer = null;
    void this.audioContext?.close();
    this.audioContext = null;
    this.status = 'off';
    this.needsAudioUnlock = false;
    this.speaking = new Set();
    this.emit();
  }

  /** Reconnexion au canal d'écoute : on se représente aux joueurs. */
  announce(): void {
    if (this.status === 'on') this.send({ type: 'listen-hello', listener: this.id });
  }

  /** Relance la lecture du son après un appui (navigateur qui bloquait). */
  async resumeAudio(): Promise<void> {
    void this.audioContext?.resume();
    let blocked = false;
    for (const peer of this.peers.values()) {
      await peer.audio.play().catch(() => {
        blocked = true;
      });
    }
    this.needsAudioUnlock = blocked;
    this.emit();
  }

  handleMessage(message: ListenMessage): void {
    if (this.status !== 'on') return;
    switch (message.type) {
      case 'player-hello': {
        const existing = this.peers.get(message.seat);
        if (existing && existing.session !== message.session) this.close(message.seat);
        // Un joueur arrive dans le vocal : on se présente, il nous appelle.
        this.send({ type: 'listen-hello', listener: this.id });
        break;
      }
      case 'player-bye':
        if (this.peers.get(message.seat)?.session === message.session) this.close(message.seat);
        break;
      case 'player-mute': {
        const peer = this.peers.get(message.seat);
        if (peer && peer.session === message.session) peer.muted = message.muted;
        break;
      }
      case 'listen-signal':
        if (message.from !== 'player' || message.listener !== this.id) return;
        void this.handleSignal(message);
        return;
      default:
        return;
    }
    this.emit();
  }

  destroy(): void {
    this.stop();
  }

  private ensurePeer(seat: VoiceSeat, session: string): PlayerPeer {
    const existing = this.peers.get(seat);
    if (existing && existing.session === session && existing.pc.connectionState !== 'failed') return existing;
    if (existing) this.close(seat);
    const pc = new RTCPeerConnection({ iceServers: this.iceServers.map((s) => ({ ...s, urls: [...[s.urls].flat()] })) });
    const audio = document.createElement('audio');
    audio.autoplay = true;
    audio.setAttribute('playsinline', '');
    audio.hidden = true;
    document.body.appendChild(audio);
    const peer: PlayerPeer = {
      seat,
      session,
      pc,
      audio,
      pending: [],
      detector: new SpeakingDetector(),
      muted: false,
      analyser: null,
      source: null,
    };
    this.peers.set(seat, peer);
    pc.onicecandidate = (event) => {
      if (!event.candidate?.candidate) return;
      this.send({
        type: 'listen-signal',
        from: 'listener',
        seat,
        session,
        listener: this.id,
        candidate: {
          candidate: event.candidate.candidate,
          sdpMid: event.candidate.sdpMid ?? null,
          sdpMLineIndex: event.candidate.sdpMLineIndex ?? null,
        },
      });
    };
    pc.ontrack = (event) => {
      const stream = event.streams[0] ?? new MediaStream([event.track]);
      audio.srcObject = stream;
      audio.play().catch(() => {
        this.needsAudioUnlock = true;
        this.emit();
      });
      peer.source?.disconnect();
      if (this.audioContext) {
        try {
          peer.source = this.audioContext.createMediaStreamSource(stream);
          peer.analyser = this.audioContext.createAnalyser();
          peer.analyser.fftSize = 512;
          peer.source.connect(peer.analyser);
        } catch {
          peer.analyser = null;
        }
      }
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'closed') this.close(seat);
      this.emit();
    };
    return peer;
  }

  private async handleSignal(message: Extract<ListenMessage, { type: 'listen-signal' }>): Promise<void> {
    const peer =
      message.description?.type === 'offer' ? this.ensurePeer(message.seat, message.session) : this.peers.get(message.seat);
    if (!peer || peer.session !== message.session) return;
    try {
      if (message.description?.type === 'offer') {
        await peer.pc.setRemoteDescription(message.description);
        for (const candidate of peer.pending.splice(0)) await peer.pc.addIceCandidate(candidate);
        const answer = await peer.pc.createAnswer();
        await peer.pc.setLocalDescription(answer);
        if (answer.sdp) {
          this.send({
            type: 'listen-signal',
            from: 'listener',
            seat: peer.seat,
            session: peer.session,
            listener: this.id,
            description: { type: 'answer', sdp: answer.sdp },
          });
        }
      }
      if (message.candidate) {
        if (peer.pc.remoteDescription) await peer.pc.addIceCandidate(message.candidate);
        else peer.pending.push(message.candidate);
      }
    } catch {
      // Message obsolète : ignoré.
    }
    this.emit();
  }

  private close(seat: VoiceSeat): void {
    const peer = this.peers.get(seat);
    if (!peer) return;
    this.peers.delete(seat);
    peer.source?.disconnect();
    peer.pc.close();
    peer.audio.srcObject = null;
    peer.audio.remove();
    this.speaking.delete(seat);
  }

  private measureLevels(): void {
    const now = performance.now();
    const buffer = new Uint8Array(512);
    const next = new Set<VoiceSeat>();
    for (const peer of this.peers.values()) {
      let level = 0;
      if (peer.analyser && !peer.muted) {
        peer.analyser.getByteTimeDomainData(buffer);
        level = rmsLevel(buffer);
      }
      if (peer.detector.update(level, now)) next.add(peer.seat);
    }
    if (next.size !== this.speaking.size || [...next].some((s) => !this.speaking.has(s))) {
      this.speaking = next;
      this.emit();
    }
  }

  private emit(): void {
    const peers = [...this.peers.values()];
    this.onChange({
      status: this.status,
      connected: new Set(peers.filter((p) => p.pc.connectionState === 'connected').map((p) => p.seat)),
      speaking: new Set(this.speaking),
      mutedSeats: new Set(peers.filter((p) => p.muted).map((p) => p.seat)),
      needsAudioUnlock: this.needsAudioUnlock,
    });
  }
}
