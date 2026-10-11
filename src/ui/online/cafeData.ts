import { useEffect, useMemo, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { CAFE_TABLE_COUNT } from '../../server/rooms.ts';
import type { CafeTableInfo, WatchView } from '../../server/types.ts';
import { getClient, onlineConfigured } from './client.ts';
import { splitCafeTables } from './cafeTables.ts';
import type { CafeEnding, CafeTable } from './cafeTables.ts';

export type { CafeEnding, CafeTable };

interface CafeRow {
  readonly table_number: number;
  readonly room_id: string;
  readonly info: CafeTableInfo;
  readonly updated_at: string;
}

/**
 * Tables occupées du café, mises à jour en temps réel. Une table abandonnée ou dont la partie
 * est finie redevient libre ; les parties qui viennent de finir sont listées à part (le patron passe).
 */
export function useCafeTables(): {
  readonly tables: readonly CafeTable[];
  readonly endings: readonly CafeEnding[];
  readonly ready: boolean;
} {
  const [rows, setRows] = useState<readonly CafeTable[]>([]);
  const [ready, setReady] = useState(!onlineConfigured);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!onlineConfigured) return;
    let cancelled = false;
    let channel: RealtimeChannel | null = null;

    const refresh = async () => {
      const client = await getClient();
      const { data, error } = await client.from('cafe_tables').select('table_number, room_id, info, updated_at');
      if (cancelled) return;
      if (!error && data) {
        setRows(
          (data as CafeRow[])
            .filter((r) => r.table_number >= 1 && r.table_number <= CAFE_TABLE_COUNT)
            .map((r) => ({ number: r.table_number, roomId: r.room_id, info: r.info, updatedAt: Date.parse(r.updated_at) })),
        );
        setNow(Date.now());
      }
      setReady(true);
    };

    void getClient()
      .then((client) => {
        if (cancelled) return;
        channel = client
          .channel('cafe-tables')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'cafe_tables' }, () => void refresh())
          .subscribe();
        return refresh();
      })
      .catch(() => setReady(true));
    // Toutes les minutes : les tables abandonnées disparaissent, les autres se rafraîchissent.
    const timer = setInterval(() => void refresh(), 60_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
      if (channel) void getClient().then((client) => client.removeChannel(channel!));
    };
  }, []);

  const { occupied, endings } = useMemo(() => splitCafeTables(rows, now), [rows, now]);
  return { tables: occupied, endings, ready };
}

/** Vue spectateur d'un salon (informations publiques), mise à jour en temps réel. */
export function useWatch(roomId: string): { readonly view: WatchView | null; readonly gone: boolean } {
  const [view, setView] = useState<WatchView | null>(null);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let channel: RealtimeChannel | null = null;
    const load = async () => {
      const client = await getClient();
      const { data } = await client.from('room_watch_views').select('view').eq('room_id', roomId).maybeSingle();
      if (cancelled) return;
      if (data) setView((data as { view: WatchView }).view);
      else setGone(true);
    };
    void getClient().then((client) => {
      if (cancelled) return;
      channel = client
        .channel(`regarder:${roomId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'room_watch_views', filter: `room_id=eq.${roomId}` },
          (payload) => {
            const next = (payload.new as { view?: WatchView } | null)?.view;
            if (next) setView(next);
            else if (payload.eventType === 'DELETE') setGone(true);
          },
        )
        .subscribe((status) => {
          // Après une reconnexion, on relit la vue pour rattraper ce qui a été manqué.
          if (status === 'SUBSCRIBED') void load();
        });
    });
    return () => {
      cancelled = true;
      if (channel) void getClient().then((client) => client.removeChannel(channel!));
    };
  }, [roomId]);

  return { view, gone };
}
