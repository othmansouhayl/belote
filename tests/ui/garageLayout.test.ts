import { describe, expect, it } from 'vitest';
import {
  GARAGE,
  GARAGE_BELOTE_TABLES,
  GARAGE_PLACE_TABLES,
  GARAGE_SMALL_TABLES,
  KHALIFA_SPOT,
  ROCHDI_ROUND,
  garageGroundAt,
} from '../../src/ui/cafe/garageLayout.ts';

const { room } = GARAGE;
const inside = (p: { x: number; z: number }, margin = 0) =>
  p.x >= room.x0 + margin && p.x <= room.x1 - margin && p.z >= room.z0 + margin && p.z <= room.z1 - margin;

describe('plan du Café Garage', () => {
  it('le poteau est au milieu de la salle ; 2 tables de belote autour, sans le toucher', () => {
    expect(GARAGE.pillar.x).toBe((room.x0 + room.x1) / 2);
    expect(GARAGE.pillar.z).toBe((room.z0 + room.z1) / 2);
    expect(GARAGE_BELOTE_TABLES).toHaveLength(2);
    for (const t of [...GARAGE_BELOTE_TABLES, ...GARAGE_SMALL_TABLES]) {
      expect(inside(t, 1.0)).toBe(true);
      expect(Math.hypot(t.x - GARAGE.pillar.x, t.z - GARAGE.pillar.z)).toBeGreaterThan(1.8);
    }
  });

  it('terrasse d’entrée de 2 m, 20 cm plus haut ; l’entrée principale donne dessus', () => {
    const t = GARAGE.entryTerrace;
    expect(t.x1 - t.x0).toBe(2);
    expect(garageGroundAt(5, 0)).toBeCloseTo(0.2);
    expect(garageGroundAt(0, 0)).toBe(0);
    expect(garageGroundAt(8, 0)).toBe(0);
    expect(GARAGE.mainDoor.x).toBe(room.x1);
  });

  it('4 tables dehors, sur la place (en enrobé), devant la terrasse d’entrée', () => {
    expect(GARAGE_PLACE_TABLES).toHaveLength(4);
    for (const t of GARAGE_PLACE_TABLES) {
      expect(t.x - 0.8).toBeGreaterThan(GARAGE.entryTerrace.x1);
      expect(t.z).toBeGreaterThan(GARAGE.square.z0);
      expect(t.z).toBeLessThan(GARAGE.square.z1);
    }
  });

  it('comptoir le long du mur nord, WC dans le coin, Khalifa entre le comptoir et le mur', () => {
    const { counter, toilets } = GARAGE;
    expect(counter.x0).toBeGreaterThanOrEqual(toilets.x1);
    expect(counter.x1).toBeLessThanOrEqual(GARAGE.sideDoor.x0);
    expect(KHALIFA_SPOT.z).toBeLessThan(counter.z - counter.depth / 2);
    expect(KHALIFA_SPOT.z).toBeGreaterThan(room.z0);
    expect(toilets.x0).toBe(room.x0);
    expect(toilets.z0).toBe(room.z0);
  });

  it('la tournée de Rochdi contourne le poteau et le comptoir, et sort par l’entrée principale', () => {
    const { counter } = GARAGE;
    for (let i = 0; i < ROCHDI_ROUND.length; i++) {
      const a = ROCHDI_ROUND[i]!;
      const b = ROCHDI_ROUND[(i + 1) % ROCHDI_ROUND.length]!;
      for (let k = 0; k <= 20; k++) {
        const x = a.x + ((b.x - a.x) * k) / 20;
        const z = a.z + ((b.z - a.z) * k) / 20;
        expect(Math.hypot(x - GARAGE.pillar.x, z - GARAGE.pillar.z)).toBeGreaterThan(0.45);
        const inCounter = x > counter.x0 && x < counter.x1 && Math.abs(z - counter.z) < counter.depth / 2 + 0.1;
        expect(inCounter).toBe(false);
        // Il ne traverse la façade est que par la porte.
        if (Math.abs(x - room.x1) < 0.05) {
          expect(z).toBeGreaterThan(GARAGE.mainDoor.z0);
          expect(z).toBeLessThan(GARAGE.mainDoor.z1);
        }
      }
    }
  });
});
