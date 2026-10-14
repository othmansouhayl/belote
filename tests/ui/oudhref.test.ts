import { describe, expect, it } from 'vitest';
import { MAP_SIZE, TOWN_CAFES } from '../../src/ui/map/oudhref.ts';

describe('carte de Oudhref', () => {
  it('quatre cafés, seul le Café Tarek est ouvert pour l’instant', () => {
    expect(TOWN_CAFES.map((c) => c.id)).toEqual(['tarek', 'garage', 'chouaa', 'souk']);
    expect(TOWN_CAFES.filter((c) => c.open).map((c) => c.id)).toEqual(['tarek']);
  });

  it('chaque café est dans la carte, et pas deux au même endroit', () => {
    for (const c of TOWN_CAFES) {
      expect(c.x).toBeGreaterThan(20);
      expect(c.x).toBeLessThan(MAP_SIZE.width - 20);
      expect(c.y).toBeGreaterThan(20);
      expect(c.y).toBeLessThan(MAP_SIZE.height - 20);
    }
    for (const a of TOWN_CAFES) for (const b of TOWN_CAFES) if (a !== b) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(50);
  });
});
