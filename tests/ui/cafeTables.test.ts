import { describe, expect, it } from 'vitest';
import { CAFE_TABLE_STALE_MINUTES } from '../../src/server/rooms.ts';
import { ENDING_WINDOW_MS, splitCafeTables } from '../../src/ui/online/cafeTables.ts';
import type { CafeTable } from '../../src/ui/online/cafeTables.ts';

const row = (number: number, status: CafeTable['info']['status'], updatedAt: number): CafeTable => ({
  number,
  roomId: `salon-${number}`,
  updatedAt,
  info: { status, players: [{ seat: 0, nickname: 'A' }], scores: status === 'lobby' ? null : [1010, 640], targetScore: 1000 },
});

describe('Tables du café vues de l’accueil', () => {
  const now = 10_000_000;

  it('une partie finie libère la table aussitôt et fait venir le patron', () => {
    const { occupied, endings } = splitCafeTables([row(1, 'playing', now), row(2, 'finished', now - 1000), row(3, 'lobby', now)], now);
    expect(occupied.map((t) => t.number)).toEqual([1, 3]);
    expect(endings).toEqual([{ key: 'salon-2:1010-640', number: 2 }]);
  });

  it('une vieille fin de partie ne fait plus venir le patron ; une table abandonnée est libre', () => {
    const stale = now - (CAFE_TABLE_STALE_MINUTES * 60_000 + 1);
    const { occupied, endings } = splitCafeTables([row(4, 'finished', now - ENDING_WINDOW_MS - 1), row(5, 'playing', stale)], now);
    expect(occupied).toEqual([]);
    expect(endings).toEqual([]);
  });
});
