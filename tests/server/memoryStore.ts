import { CAFE_TABLE_STALE_MINUTES } from '../../src/server/index.ts';
import type { CafeTableInfo, PublicTableData, RoomAggregate, RoomStore, StoredView, WatchView } from '../../src/server/index.ts';

interface CafeRow {
  roomId: string;
  info: CafeTableInfo;
  updatedAt: number;
}

/** Stockage en mémoire qui imite la base : copies JSON, contrôle de version, vues par joueur. */
export class MemoryStore implements RoomStore {
  rooms = new Map<string, RoomAggregate>();
  views = new Map<string, Map<string, StoredView>>();
  /** Table publique `cafe_tables` (lisible par tous). */
  cafe = new Map<number, CafeRow>();
  /** Table publique `room_watch_views` (lisible par tous). */
  watch = new Map<string, WatchView>();
  /** Horloge simulée (millisecondes) pour tester les tables abandonnées. */
  now = 0;

  private clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }

  async loadById(roomId: string) {
    const room = this.rooms.get(roomId);
    return room ? this.clone(room) : null;
  }

  async loadByCode(code: string) {
    const room = [...this.rooms.values()].find((r) => r.code === code);
    return room ? this.clone(room) : null;
  }

  async insert(room: RoomAggregate, views: readonly StoredView[], table: PublicTableData | null) {
    if (table) {
      const current = this.cafe.get(table.tableNumber);
      if (current && this.now - current.updatedAt < CAFE_TABLE_STALE_MINUTES * 60_000) return 'tableTaken' as const;
    }
    if ([...this.rooms.values()].some((r) => r.code === room.code)) return 'conflict' as const;
    this.write(room, views);
    if (table) this.cafe.set(table.tableNumber, { roomId: room.id, info: this.clone(table.info), updatedAt: this.now });
    this.writeWatch(room, table);
    return 'ok' as const;
  }

  async save(room: RoomAggregate, expectedVersion: number, views: readonly StoredView[], table: PublicTableData | null) {
    if (this.rooms.get(room.id)?.version !== expectedVersion) return false;
    this.write(room, views);
    if (table) {
      const current = this.cafe.get(table.tableNumber);
      if (current?.roomId === room.id) {
        if (table.info.players.length === 0) this.cafe.delete(table.tableNumber);
        else this.cafe.set(table.tableNumber, { roomId: room.id, info: this.clone(table.info), updatedAt: this.now });
      }
    }
    this.writeWatch(room, table);
    return true;
  }

  private write(room: RoomAggregate, views: readonly StoredView[]) {
    this.rooms.set(room.id, this.clone(room));
    this.views.set(room.id, new Map(views.map((v) => [v.playerId, this.clone(v)])));
  }

  private writeWatch(room: RoomAggregate, table: PublicTableData | null) {
    if (table && table.info.players.length > 0) this.watch.set(room.id, this.clone(table.watch));
    else this.watch.delete(room.id);
  }

  /** Ce que la base renverrait au joueur (règle RLS : uniquement sa propre ligne). */
  viewFor(roomId: string, playerId: string): StoredView | undefined {
    return this.views.get(roomId)?.get(playerId);
  }
}
