import type { RoomAggregate, RoomStore, StoredView } from '../../src/server/index.ts';

/** Stockage en mémoire qui imite la base : copies JSON, contrôle de version, vues par joueur. */
export class MemoryStore implements RoomStore {
  rooms = new Map<string, RoomAggregate>();
  views = new Map<string, Map<string, StoredView>>();

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

  async insert(room: RoomAggregate, views: readonly StoredView[]) {
    if ([...this.rooms.values()].some((r) => r.code === room.code)) return false;
    this.write(room, views);
    return true;
  }

  async save(room: RoomAggregate, expectedVersion: number, views: readonly StoredView[]) {
    if (this.rooms.get(room.id)?.version !== expectedVersion) return false;
    this.write(room, views);
    return true;
  }

  private write(room: RoomAggregate, views: readonly StoredView[]) {
    this.rooms.set(room.id, this.clone(room));
    this.views.set(room.id, new Map(views.map((v) => [v.playerId, this.clone(v)])));
  }

  /** Ce que la base renverrait au joueur (règle RLS : uniquement sa propre ligne). */
  viewFor(roomId: string, playerId: string): StoredView | undefined {
    return this.views.get(roomId)?.get(playerId);
  }
}
