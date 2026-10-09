import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { Seat } from '../../engine/index.ts';
import type { RoomView } from '../../server/types.ts';
import { ensureSession, getClient } from './client.ts';

export type ConnectionState = 'connecting' | 'online' | 'offline';

interface ViewRow {
  readonly version: number;
  readonly view: RoomView;
}

/**
 * Suit en temps réel la vue du joueur dans un salon. La base ne renvoie que la ligne
 * du joueur connecté (règle RLS) : les cartes des autres ne transitent jamais ici.
 */
export function useRoom(roomId: string) {
  const [view, setView] = useState<RoomView | null>(null);
  const [connection, setConnection] = useState<ConnectionState>('connecting');
  const [presentSeats, setPresentSeats] = useState<ReadonlySet<Seat>>(new Set());
  const [removed, setRemoved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const version = useRef(0);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const mySeat = useRef<Seat | null>(null);

  const apply = useCallback((row: ViewRow) => {
    if (row.version < version.current) return;
    version.current = row.version;
    mySeat.current = row.view.mySeat;
    setView(row.view);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const client = await getClient();
      await ensureSession(client);
      const { data, error: dbError } = await client
        .from('player_views')
        .select('version, view')
        .eq('room_id', roomId)
        .maybeSingle();
      if (dbError) throw dbError;
      if (data) apply(data as ViewRow);
      else setRemoved(true);
    } catch {
      setConnection('offline');
    }
  }, [roomId, apply]);

  useEffect(() => {
    let cancelled = false;
    let cleanup = () => {};

    (async () => {
      const client = await getClient();
      const session = await ensureSession(client);
      await client.realtime.setAuth(session.access_token);
      if (cancelled) return;
      await refresh();

      const channel = client.channel(`salon:${roomId}`, {
        config: { private: true, presence: { key: crypto.randomUUID() } },
      });
      channelRef.current = channel;
      channel
        .on('postgres_changes', { event: '*', schema: 'public', table: 'player_views', filter: `room_id=eq.${roomId}` }, (payload) => {
          if (payload.eventType === 'DELETE') void refresh();
          else apply(payload.new as ViewRow);
        })
        .on('presence', { event: 'sync' }, () => {
          const seats = Object.values(channel.presenceState<{ seat: Seat }>())
            .flat()
            .map((p) => p.seat);
          setPresentSeats(new Set(seats));
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            setConnection('online');
            void refresh();
            if (mySeat.current !== null) void channel.track({ seat: mySeat.current });
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            setConnection('offline');
          }
        });

      const onVisible = () => {
        if (document.visibilityState === 'visible') void refresh();
      };
      const onOnline = () => void refresh();
      document.addEventListener('visibilitychange', onVisible);
      window.addEventListener('online', onOnline);
      cleanup = () => {
        document.removeEventListener('visibilitychange', onVisible);
        window.removeEventListener('online', onOnline);
        channelRef.current = null;
        void client.removeChannel(channel);
      };
    })().catch((e: unknown) => setError(e instanceof Error ? e.message : 'Connexion au salon impossible.'));

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [roomId, refresh, apply]);

  // Signale sa présence (et sa place, qui peut changer dans le salon d'attente).
  const seat = view?.mySeat ?? null;
  useEffect(() => {
    if (seat !== null && connection === 'online') void channelRef.current?.track({ seat });
  }, [seat, connection]);

  return { view, connection, presentSeats, removed, error, refresh };
}

/** Joueurs déconnectés depuis plus longtemps que le délai d'absence du salon (§11.5). */
export function useAbsentSeats(
  seats: readonly Seat[],
  presentSeats: ReadonlySet<Seat>,
  mySeat: Seat | null,
  delaySeconds: number,
  connected: boolean,
): ReadonlySet<Seat> {
  const missingSince = useRef(new Map<Seat, number>());
  const [absent, setAbsent] = useState<ReadonlySet<Seat>>(new Set());

  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      const next = new Set<Seat>();
      for (const seat of seats) {
        if (seat === mySeat || !connected || presentSeats.has(seat)) {
          missingSince.current.delete(seat);
          continue;
        }
        const since = missingSince.current.get(seat) ?? now;
        missingSince.current.set(seat, since);
        if (now - since >= delaySeconds * 1000) next.add(seat);
      }
      setAbsent((prev) => (prev.size === next.size && [...next].every((s) => prev.has(s)) ? prev : next));
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [seats, presentSeats, mySeat, delaySeconds, connected]);

  return absent;
}
