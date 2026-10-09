import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_ICE_SERVERS, parseIceServers, parseVoiceMessage } from '../../../voice/protocol.ts';
import type { IceServer, VoiceSeat } from '../../../voice/protocol.ts';
import { ensureSession, getClient } from '../client.ts';
import { VOICE_OFF, VoiceMesh } from './VoiceMesh.ts';
import type { VoiceSnapshot } from './VoiceMesh.ts';

async function fetchIceServers(roomId: string): Promise<readonly IceServer[]> {
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
}

export interface VoiceControls {
  readonly snapshot: VoiceSnapshot;
  readonly join: () => void;
  readonly leave: () => void;
  readonly toggleMute: () => void;
  readonly resume: () => void;
}

export function useVoice({ roomId, mySeat, online, presentSeats, sendVoice, onVoice }: UseVoiceOptions): VoiceControls {
  const [snapshot, setSnapshot] = useState<VoiceSnapshot>(VOICE_OFF);
  const mesh = useRef<VoiceMesh | null>(null);

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

  return { snapshot, join, leave, toggleMute, resume };
}
