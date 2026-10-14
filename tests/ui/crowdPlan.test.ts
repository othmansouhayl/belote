import { describe, expect, it } from 'vitest';
import { planCrowd } from '../../src/ui/cafe/crowdPlan.ts';
import type { TableStatus } from '../../src/ui/cafe/crowdPlan.ts';

const cafe = (entries: Record<number, TableStatus>) =>
  new Map<number, TableStatus>([1, 2, 3, 4, 5, 6].map((n) => [n, entries[n] ?? 'free']));

describe('la foule du Café Tarek', () => {
  it('café vide : deux tables d’habitués, quatre tables restent libres', () => {
    const plan = planCrowd(cafe({}));
    expect(plan.regulars).toEqual([5, 6]);
    expect(plan.watchers).toEqual([5, 6, null, null]);
  });

  it('les habitués laissent toujours au moins deux tables libres vides', () => {
    const plan = planCrowd(cafe({ 1: 'playing', 2: 'lobby', 5: 'playing' }));
    expect(plan.regulars).toEqual([6]);
    // Deux spectateurs par table en jeu.
    expect(plan.watchers).toEqual([1, 1, 5, 5]);
    expect(planCrowd(cafe({ 1: 'playing', 2: 'playing', 3: 'lobby', 4: 'finished' })).regulars).toEqual([]);
  });

  it('une table prise par de vrais joueurs : les habitués vont ailleurs', () => {
    expect(planCrowd(cafe({ 5: 'lobby' })).regulars).toEqual([6, 3]);
  });

  it('la table d’une scène 3D (vue des joueurs) reste tranquille', () => {
    const plan = planCrowd(cafe({ 5: 'playing' }), 5);
    expect(plan.regulars).not.toContain(5);
    expect(plan.watchers).not.toContain(5);
  });
});
