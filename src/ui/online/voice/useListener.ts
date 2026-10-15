import { useCallback, useEffect, useRef, useState } from 'react';
import { LISTENER_OFF, VoiceListener } from './VoiceListener.ts';
import type { ListenerSnapshot } from './VoiceListener.ts';
import { useListenChannel } from './useListenChannel.ts';
import { fetchIceServers } from './useVoice.ts';

export interface ListenerControls {
  readonly snapshot: ListenerSnapshot;
  /** À appeler depuis un appui (iOS exige un geste pour lire le son). */
  readonly start: () => void;
  readonly stop: () => void;
  readonly resume: () => void;
}

/** Spectateur autorisé à écouter : il entend le vocal des joueurs, sans jamais parler. */
export function useListener(roomId: string, allowed: boolean): ListenerControls {
  const channel = useListenChannel(roomId, allowed);
  const [snapshot, setSnapshot] = useState<ListenerSnapshot>(LISTENER_OFF);
  const listener = useRef<VoiceListener | null>(null);
  const { send, onMessage, online } = channel;

  useEffect(() => {
    if (!allowed) return;
    const l = new VoiceListener(send, () => fetchIceServers(roomId), setSnapshot);
    listener.current = l;
    const off = onMessage((message) => l.handleMessage(message));
    const onHide = () => l.stop();
    window.addEventListener('pagehide', onHide);
    return () => {
      off();
      window.removeEventListener('pagehide', onHide);
      l.destroy();
      listener.current = null;
    };
  }, [allowed, roomId, send, onMessage]);

  useEffect(() => {
    if (online) listener.current?.announce();
  }, [online]);

  const start = useCallback(() => void listener.current?.start(), []);
  const stop = useCallback(() => listener.current?.stop(), []);
  const resume = useCallback(() => void listener.current?.resumeAudio(), []);
  return { snapshot, start, stop, resume };
}
