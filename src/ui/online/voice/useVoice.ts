import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_ICE_SERVERS, parseIceServers, parseVoiceMessage } from '../../../voice/protocol.ts';
import type { IceServer, VoiceSeat } from '../../../voice/protocol.ts';
import { ensureSession, getClient } from '../client.ts';
import { ListenerHub } from './ListenerHub.ts';
import { VOICE_OFF, VoiceMesh } from './VoiceMesh.ts';
import type { VoiceSnapshot } from './VoiceMesh.ts';
import type { ListenChannel } from './useListenChannel.ts';

export async function fetchIceServers(roomId: string): Promise<readonly IceServer[]> {
  const client = await getClient();
  await ensureSession(client);
  const { data } = await client.functions.invoke<{ ok: boolean; iceServers?: unknown }>('game', {
    body: { type: 'voice-config', roomId },
  });
  return (data?.ok && parseIceServers(data.iceServers)) || DEFAULT_ICE_SERVERS;
}

interface UseVoiceOptions {
  readonly roomId: string;
  readonly mySeat: VoiceSeat | null;
  readonly online: boolean;
  readonly presentSeats: ReadonlySet<VoiceSeat>;
  readonly sendVoice: (payload: unknown) => void;
  readonly onVoice: (listener: (payload: unknown) => void) => () => void;
  /** Canal d'écoute des spectateurs, quand les joueurs les laissent écouter (sinon null). */
  readonly listenChannel?: ListenChannel | null;
}

export interface VoiceControls {
  readonly snapshot: VoiceSnapshot;
  readonly join: () => void;
  readonly leave: () => void;
  readonly toggleMute: () => void;
  readonly resume: () => void;
  /** Spectateurs qui entendent ce joueur en ce moment. */
  readonly listeners: number;
}

export function useVoice({ roomId, mySeat, online, presentSeats, sendVoice, onVoice, listenChannel = null }: UseVoiceOptions): VoiceControls {
  const [snapshot, setSnapshot] = useState<VoiceSnapshot>(VOICE_OFF);
  const [listeners, setListeners] = useState(0);
  const mesh = useRef<VoiceMesh | null>(null);
  const hub = useRef<ListenerHub | null>(null);

  // Le maillage est créé dès que la place est connue, mais n'utilise le micro qu'après « Rejoindre ».
  useEffect(() => {
    if (mySeat === null || mesh.current) return;
    mesh.current = new VoiceMesh(mySeat, sendVoice, () => fetchIceServers(roomId), setSnapshot);
  }, [mySeat, roomId, sendVoice]);

  useEffect(() => () => mesh.current?.destroy(), []);

  useEffect(() => {
    if (mySeat !== null) mesh.current?.changeSeat(mySeat);
  }, [mySeat]);

  useEffect(
    () =>
      onVoice((payload) => {
        const message = parseVoiceMessage(payload);
        if (message) mesh.current?.handleMessage(message);
      }),
    [onVoice],
  );

  useEffect(() => {
    if (online) mesh.current?.announce();
  }, [online]);

  // Spectateurs autorisés à écouter : le micro du joueur leur est aussi envoyé (en envoi seul).
  const listenSend = listenChannel?.send;
  const onListen = listenChannel?.onMessage;
  const hasSeat = mySeat !== null;
  useEffect(() => {
    const voice = mesh.current;
    if (!listenSend || !onListen || !voice || mySeat === null) return;
    const h = new ListenerHub(mySeat, listenSend, () => voice.currentIceServers(), setListeners);
    hub.current = h;
    const offStream = voice.subscribeLocalStream((stream, muted) => h.setStream(stream, muted));
    const offMessages = onListen((message) => h.handleMessage(message));
    return () => {
      offStream();
      offMessages();
      h.destroy();
      hub.current = null;
      setListeners(0);
    };
    // La place est suivie à part (setSeat) : le hub n'est recréé que si le canal change.
  }, [listenSend, onListen, hasSeat]);

  useEffect(() => {
    if (mySeat !== null) hub.current?.setSeat(mySeat);
  }, [mySeat]);

  const listenOnline = listenChannel?.online ?? false;
  useEffect(() => {
    if (listenOnline) hub.current?.announce();
  }, [listenOnline]);

  useEffect(() => {
    if (online) mesh.current?.syncPresence(presentSeats);
  }, [presentSeats, online]);

  // Fermer l'onglet ou quitter la page prévient les autres immédiatement.
  useEffect(() => {
    const onHide = () => mesh.current?.leave();
    window.addEventListener('pagehide', onHide);
    return () => window.removeEventListener('pagehide', onHide);
  }, []);

  const join = useCallback(() => void mesh.current?.join(), []);
  const leave = useCallback(() => mesh.current?.leave(), []);
  const toggleMute = useCallback(() => mesh.current?.setMuted(!snapshot.muted), [snapshot.muted]);
  const resume = useCallback(() => void mesh.current?.resumeAudio(), []);

  return { snapshot, join, leave, toggleMute, resume, listeners };
}
