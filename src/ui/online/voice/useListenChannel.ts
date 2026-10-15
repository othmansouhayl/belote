import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { parseListenMessage } from '../../../voice/listen.ts';
import type { ListenMessage } from '../../../voice/listen.ts';
import { ensureSession, getClient } from '../client.ts';

export interface ListenChannel {
  /** Abonné au canal d'écoute (on peut s'y annoncer). */
  readonly online: boolean;
  readonly send: (message: ListenMessage) => void;
  readonly onMessage: (listener: (message: ListenMessage) => void) => () => void;
}

/**
 * Canal privé « ecoute:<salon> » : les joueurs y envoient leur voix aux spectateurs qui ont le droit
 * d'écouter (la base n'y laisse entrer qu'eux). Inactif tant que `active` est faux.
 */
export function useListenChannel(roomId: string, active: boolean): ListenChannel {
  const [online, setOnline] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const listeners = useRef(new Set<(message: ListenMessage) => void>());

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let cleanup = () => {};
    (async () => {
      const client = await getClient();
      const session = await ensureSession(client);
      await client.realtime.setAuth(session.access_token);
      if (cancelled) return;
      const channel = client.channel(`ecoute:${roomId}`, { config: { private: true, broadcast: { self: false, ack: false } } });
      channelRef.current = channel;
      channel
        .on('broadcast', { event: 'listen' }, ({ payload }) => {
          const message = parseListenMessage(payload);
          if (message) for (const listener of listeners.current) listener(message);
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') setOnline(true);
          else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') setOnline(false);
        });
      cleanup = () => {
        channelRef.current = null;
        setOnline(false);
        void client.removeChannel(channel);
      };
    })().catch(() => setOnline(false));
    return () => {
      cancelled = true;
      cleanup();
    };
  }, [roomId, active]);

  const send = useCallback((message: ListenMessage) => {
    void channelRef.current?.send({ type: 'broadcast', event: 'listen', payload: message });
  }, []);
  const onMessage = useCallback((listener: (message: ListenMessage) => void) => {
    listeners.current.add(listener);
    return () => {
      listeners.current.delete(listener);
    };
  }, []);

  return { online, send, onMessage };
}
