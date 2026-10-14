import { describe, expect, it } from 'vitest';
import { MAP_VIEW, TOWN_CAFES } from '../../src/ui/map/oudhref.ts';

describe('carte de Oudhref', () => {
  it('quatre cafés, seul le Café Tarek est ouvert pour l’instant', () => {
    expect(TOWN_CAFES.map((c) => c.id)).toEqual(['tarek', 'garage', 'chouaa', 'souk']);
    expect(TOWN_CAFES.filter((c) => c.open).map((c) => c.id)).toEqual(['tarek']);
  });

  it('chaque café (et son nom) reste dans la zone toujours visible, et pas deux au même endroit', () => {
    for (const c of TOWN_CAFES) {
      // Le nom s'écrit sur environ 150 unités, du côté choisi, au-dessus du repère.
      const left = c.labelSide === 'left' ? c.x - 170 : c.x - 20;
      const right = c.labelSide === 'left' ? c.x + 20 : c.x + 170;
      expect(left).toBeGreaterThanOrEqual(MAP_VIEW.x);
      expect(right).toBeLessThanOrEqual(MAP_VIEW.x + MAP_VIEW.width);
      expect(c.y - 70).toBeGreaterThanOrEqual(MAP_VIEW.y);
      expect(c.y + 10).toBeLessThanOrEqual(MAP_VIEW.y + MAP_VIEW.height);
    }
    for (const a of TOWN_CAFES) for (const b of TOWN_CAFES) if (a !== b) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(80);
  });
});
