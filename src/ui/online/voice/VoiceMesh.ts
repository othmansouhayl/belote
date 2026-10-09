import { DEFAULT_ICE_SERVERS, SpeakingDetector, rmsLevel, shouldInitiate } from '../../../voice/protocol.ts';
import type { IceServer, SessionDescription, VoiceMessage, VoiceSeat } from '../../../voice/protocol.ts';

export type VoiceStatus = 'off' | 'starting' | 'on';

export interface VoiceSnapshot {
  readonly status: VoiceStatus;
  readonly muted: boolean;
  /** Vrai si le micro est indisponible : on écoute sans parler. */
  readonly listenOnly: boolean;
  readonly micProblem: string | null;
  /** Le téléphone a coupé le micro (écran verrouillé, appel) : un appui le relance. */
  readonly micInterrupted: boolean;
  /** iOS / navigateur a bloqué la lecture du son : il faut un appui de l'utilisateur. */
  readonly needsAudioUnlock: boolean;
  readonly speaking: ReadonlySet<VoiceSeat>;
  readonly inVoice: ReadonlySet<VoiceSeat>;
  readonly connected: ReadonlySet<VoiceSeat>;
  readonly mutedSeats: ReadonlySet<VoiceSeat>;
}

export const VOICE_OFF: VoiceSnapshot = {
  status: 'off',
  muted: false,
  listenOnly: false,
  micProblem: null,
  micInterrupted: false,
  needsAudioUnlock: false,
  speaking: new Set(),
  inVoice: new Set(),
  connected: new Set(),
  mutedSeats: new Set(),
};

interface Peer {
  readonly seat: VoiceSeat;
  readonly session: string;
  readonly pc: RTCPeerConnection;
  readonly audio: HTMLAudioElement;
  readonly pending: RTCIceCandidateInit[];
  readonly detector: SpeakingDetector;
  muted: boolean;
  connected: boolean;
  analyser: AnalyserNode | null;
  source: MediaStreamAudioSourceNode | null;
}

const MIC_CONSTRAINTS: MediaStreamConstraints = {
  audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  video: false,
};

function micErrorMessage(error: unknown): string {
  const name = error instanceof DOMException ? error.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return "Micro refusé : autorisez-le dans les réglages du navigateur. Vous pouvez quand même écouter.";
  }
  if (name === 'NotFoundError') return 'Aucun micro détecté. Vous pouvez quand même écouter.';
  return 'Micro indisponible. Vous pouvez quand même écouter.';
}

/**
 * Discussion audio entre les joueurs d'un salon : une connexion WebRTC par autre joueur
 * (maillage), avec signalisation par messages sur le canal privé du salon.
 */
export class VoiceMesh {
  private session = crypto.randomUUID();
  private status: VoiceStatus = 'off';
  private muted = false;
  private listenOnly = false;
  private micProblem: string | null = null;
  private micInterrupted = false;
  private needsAudioUnlock = false;
  private localStream: MediaStream | null = null;
  private localAnalyser: AnalyserNode | null = null;
  // Gardé en mémoire : sinon le navigateur peut supprimer le nœud et la mesure s'arrête.
  private localSource: MediaStreamAudioSourceNode | null = null;
  private readonly localDetector = new SpeakingDetector();
  private audioContext: AudioContext | null = null;
  private iceServers: readonly IceServer[] = DEFAULT_ICE_SERVERS;
  private readonly peers = new Map<VoiceSeat, Peer>();
  private speaking = new Set<VoiceSeat>();
  private levelTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private mySeat: VoiceSeat,
    private readonly send: (message: VoiceMessage) => void,
    private readonly loadIceServers: () => Promise<readonly IceServer[]>,
    private readonly onChange: (snapshot: VoiceSnapshot) => void,
  ) {}

  /** À appeler directement depuis un appui (exigence d'iOS Safari pour le micro et le son). */
  async join(): Promise<void> {
    if (this.status !== 'off') return;
    this.status = 'starting';
    // Créé pendant le geste de l'utilisateur, sinon iOS le laisse suspendu.
    this.audioContext = new AudioContext();
    void this.audioContext.resume();
    this.emit();

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia(MIC_CONSTRAINTS);
      this.listenOnly = false;
      this.micProblem = null;
      this.watchLocalTrack();
    } catch (error) {
      this.localStream = null;
      this.listenOnly = true;
      this.micProblem = micErrorMessage(error);
    }
    if (this.status !== 'starting') return;

    try {
      this.iceServers = await this.loadIceServers();
    } catch {
      this.iceServers = DEFAULT_ICE_SERVERS;
    }
    if (this.status !== 'starting') return;

    this.attachLocalAnalyser();
    this.status = 'on';
    this.levelTimer = setInterval(() => this.measureLevels(), 100);
    this.send({ type: 'hello', seat: this.mySeat, session: this.session, muted: this.isMutedForOthers() });
    this.emit();
  }

  leave(): void {
    if (this.status === 'off') return;
    this.send({ type: 'bye', seat: this.mySeat, session: this.session });
    for (const seat of [...this.peers.keys()]) this.closePeer(seat);
    this.localStream?.getTracks().forEach((t) => t.stop());
    this.localStream = null;
    this.localSource?.disconnect();
    this.localSource = null;
    this.localAnalyser = null;
    if (this.levelTimer) clearInterval(this.levelTimer);
    this.levelTimer = null;
    void this.audioContext?.close();
    this.audioContext = null;
    this.status = 'off';
    this.muted = false;
    this.listenOnly = false;
    this.micProblem = null;
    this.micInterrupted = false;
    this.needsAudioUnlock = false;
    this.speaking = new Set();
    this.session = crypto.randomUUID();
    this.emit();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.localStream?.getAudioTracks().forEach((t) => (t.enabled = !muted));
    if (this.status === 'on') this.send({ type: 'mute', seat: this.mySeat, session: this.session, muted: this.isMutedForOthers() });
    this.emit();
  }

  /** Relance la lecture du son (et le micro s'il a été coupé par le téléphone) après un appui. */
  async resumeAudio(): Promise<void> {
    void this.audioContext?.resume();
    let blocked = false;
    for (const peer of this.peers.values()) {
      await peer.audio.play().catch(() => {
        blocked = true;
      });
    }
    this.needsAudioUnlock = blocked;
    const track = this.localStream?.getAudioTracks()[0];
    if (this.status === 'on' && !this.listenOnly && (!track || track.readyState === 'ended')) await this.restartMicrophone();
    this.emit();
  }

  /** Place changée dans le salon d'attente : on se réannonce sous la nouvelle place. */
  changeSeat(seat: VoiceSeat): void {
    if (seat === this.mySeat) return;
    if (this.status === 'on') {
      this.send({ type: 'bye', seat: this.mySeat, session: this.session });
      for (const s of [...this.peers.keys()]) this.closePeer(s);
      this.session = crypto.randomUUID();
      this.mySeat = seat;
      this.send({ type: 'hello', seat, session: this.session, muted: this.isMutedForOthers() });
      this.emit();
    } else {
      this.mySeat = seat;
    }
  }

  /** Après une reconnexion au canal, on se réannonce : les messages manqués sont rattrapés. */
  announce(): void {
    if (this.status === 'on') this.send({ type: 'hello', seat: this.mySeat, session: this.session, muted: this.isMutedForOthers() });
  }

  /** Les joueurs qui ont quitté le canal (onglet fermé, réseau coupé) sont retirés. */
  syncPresence(present: ReadonlySet<VoiceSeat>): void {
    let changed = false;
    for (const seat of [...this.peers.keys()]) {
      if (!present.has(seat)) {
        this.closePeer(seat);
        changed = true;
      }
    }
    if (changed) this.emit();
  }

  handleMessage(message: VoiceMessage): void {
    if (this.status !== 'on' || message.seat === this.mySeat) return;
    switch (message.type) {
      case 'hello':
        this.ensurePeer(message.seat, message.session).muted = message.muted;
        this.send({ type: 'here', seat: this.mySeat, session: this.session, muted: this.isMutedForOthers() });
        break;
      case 'here':
        this.ensurePeer(message.seat, message.session).muted = message.muted;
        break;
      case 'mute': {
        const peer = this.peers.get(message.seat);
        if (peer && peer.session === message.session) peer.muted = message.muted;
        break;
      }
      case 'bye':
        if (this.peers.get(message.seat)?.session === message.session) this.closePeer(message.seat);
        break;
      case 'signal':
        if (message.to !== this.mySeat || message.toSession !== this.session) return;
        void this.handleSignal(message);
        return;
    }
    this.emit();
  }

  destroy(): void {
    this.leave();
  }

  private isMutedForOthers(): boolean {
    return this.muted || this.listenOnly;
  }

  private ensurePeer(seat: VoiceSeat, session: string): Peer {
    const existing = this.peers.get(seat);
    if (existing && existing.session === session) return existing;
    if (existing) this.closePeer(seat);

    const pc = new RTCPeerConnection({ iceServers: this.iceServers.map((s) => ({ ...s, urls: [...[s.urls].flat()] })) });
    const audio = document.createElement('audio');
    audio.autoplay = true;
    audio.setAttribute('playsinline', '');
    audio.dataset.voiceSeat = String(seat);
    audio.hidden = true;
    document.body.appendChild(audio);

    const peer: Peer = {
      seat,
      session,
      pc,
      audio,
      pending: [],
      detector: new SpeakingDetector(),
      muted: false,
      connected: false,
      analyser: null,
      source: null,
    };
    this.peers.set(seat, peer);

    if (this.localStream) {
      for (const track of this.localStream.getAudioTracks()) pc.addTrack(track, this.localStream);
    } else {
      pc.addTransceiver('audio', { direction: 'recvonly' });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) this.signal(peer, { candidate: event.candidate.toJSON() });
    };
    pc.ontrack = (event) => {
      const stream = event.streams[0] ?? new MediaStream([event.track]);
      audio.srcObject = stream;
      audio.play().catch(() => {
        this.needsAudioUnlock = true;
        this.emit();
      });
      this.attachRemoteAnalyser(peer, stream);
    };
    pc.onconnectionstatechange = () => {
      peer.connected = pc.connectionState === 'connected';
      if (pc.connectionState === 'failed' && shouldInitiate(this.mySeat, seat)) void this.makeOffer(peer, true);
      this.emit();
    };

    if (shouldInitiate(this.mySeat, seat)) void this.makeOffer(peer, false);
    return peer;
  }

  private closePeer(seat: VoiceSeat): void {
    const peer = this.peers.get(seat);
    if (!peer) return;
    this.peers.delete(seat);
    peer.source?.disconnect();
    peer.pc.close();
    peer.audio.srcObject = null;
    peer.audio.remove();
    this.speaking.delete(seat);
  }

  private signal(peer: Peer, content: { description?: SessionDescription; candidate?: RTCIceCandidateInit }): void {
    this.send({
      type: 'signal',
      seat: this.mySeat,
      session: this.session,
      to: peer.seat,
      toSession: peer.session,
      ...(content.description ? { description: content.description } : {}),
      ...(content.candidate?.candidate
        ? {
            candidate: {
              candidate: content.candidate.candidate,
              sdpMid: content.candidate.sdpMid ?? null,
              sdpMLineIndex: content.candidate.sdpMLineIndex ?? null,
            },
          }
        : {}),
    });
  }

  private async makeOffer(peer: Peer, iceRestart: boolean): Promise<void> {
    try {
      const offer = await peer.pc.createOffer({ iceRestart });
      await peer.pc.setLocalDescription(offer);
      if (offer.sdp) this.signal(peer, { description: { type: 'offer', sdp: offer.sdp } });
    } catch {
      // La connexion a été fermée entre-temps : rien à faire.
    }
  }

  private async handleSignal(message: Extract<VoiceMessage, { type: 'signal' }>): Promise<void> {
    if (message.description?.type === 'offer' && shouldInitiate(this.mySeat, message.seat)) return;
    const peer =
      message.description?.type === 'offer' ? this.ensurePeer(message.seat, message.session) : this.peers.get(message.seat);
    if (!peer || peer.session !== message.session) return;
    try {
      if (message.description) {
        await peer.pc.setRemoteDescription(message.description);
        for (const candidate of peer.pending.splice(0)) await peer.pc.addIceCandidate(candidate);
        if (message.description.type === 'offer') {
          const answer = await peer.pc.createAnswer();
          await peer.pc.setLocalDescription(answer);
          if (answer.sdp) this.signal(peer, { description: { type: 'answer', sdp: answer.sdp } });
        }
      }
      if (message.candidate) {
        if (peer.pc.remoteDescription) await peer.pc.addIceCandidate(message.candidate);
        else peer.pending.push(message.candidate);
      }
    } catch {
      // Message obsolète (connexion remplacée) : ignoré.
    }
    this.emit();
  }

  private watchLocalTrack(): void {
    const track = this.localStream?.getAudioTracks()[0];
    if (!track) return;
    // iOS coupe le micro quand l'écran se verrouille ou lors d'un appel téléphonique.
    track.onended = () => {
      this.micInterrupted = true;
      this.emit();
    };
  }

  private async restartMicrophone(): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(MIC_CONSTRAINTS);
      const track = stream.getAudioTracks()[0];
      if (!track) return;
      track.enabled = !this.muted;
      for (const peer of this.peers.values()) {
        const sender = peer.pc.getSenders().find((s) => s.track?.kind === 'audio' || s.track === null);
        await sender?.replaceTrack(track);
      }
      this.localStream?.getTracks().forEach((t) => t.stop());
      this.localStream = stream;
      this.micProblem = null;
      this.micInterrupted = false;
      this.watchLocalTrack();
      this.attachLocalAnalyser();
    } catch (error) {
      this.micProblem = micErrorMessage(error);
    }
  }

  private analyserFor(stream: MediaStream): { analyser: AnalyserNode; source: MediaStreamAudioSourceNode } | null {
    if (!this.audioContext) return null;
    try {
      const source = this.audioContext.createMediaStreamSource(stream);
      const analyser = this.audioContext.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      return { analyser, source };
    } catch {
      return null;
    }
  }

  private attachLocalAnalyser(): void {
    this.localSource?.disconnect();
    const nodes = this.localStream ? this.analyserFor(this.localStream) : null;
    this.localAnalyser = nodes?.analyser ?? null;
    this.localSource = nodes?.source ?? null;
  }

  private attachRemoteAnalyser(peer: Peer, stream: MediaStream): void {
    peer.source?.disconnect();
    const nodes = this.analyserFor(stream);
    peer.analyser = nodes?.analyser ?? null;
    peer.source = nodes?.source ?? null;
  }

  private measureLevels(): void {
    const now = performance.now();
    const next = new Set<VoiceSeat>();
    const buffer = new Uint8Array(512);
    const level = (analyser: AnalyserNode | null) => {
      if (!analyser) return 0;
      analyser.getByteTimeDomainData(buffer);
      return rmsLevel(buffer);
    };
    if (this.localDetector.update(this.isMutedForOthers() ? 0 : level(this.localAnalyser), now)) next.add(this.mySeat);
    for (const peer of this.peers.values()) {
      if (peer.detector.update(peer.muted ? 0 : level(peer.analyser), now)) next.add(peer.seat);
    }
    const changed = next.size !== this.speaking.size || [...next].some((s) => !this.speaking.has(s));
    if (changed) {
      this.speaking = next;
      this.emit();
    }
  }

  private emit(): void {
    const peers = [...this.peers.values()];
    this.onChange({
      status: this.status,
      muted: this.muted,
      listenOnly: this.listenOnly,
      micProblem: this.micProblem,
      micInterrupted: this.micInterrupted,
      needsAudioUnlock: this.needsAudioUnlock,
      speaking: new Set(this.speaking),
      inVoice: new Set(peers.map((p) => p.seat)),
      connected: new Set(peers.filter((p) => p.connected).map((p) => p.seat)),
      mutedSeats: new Set([
        ...peers.filter((p) => p.muted).map((p) => p.seat),
        ...(this.status === 'on' && this.isMutedForOthers() ? [this.mySeat] : []),
      ]),
    });
  }
}
