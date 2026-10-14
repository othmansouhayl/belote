import { describe, expect, it } from 'vitest';
import {
  GARAGE,
  GARAGE_BELOTE_TABLES,
  GARAGE_SMALL_TABLES,
  GARAGE_TERRACE,
  KHALIFA_SPOT,
  ROCHDI_ROUND,
} from '../../src/ui/cafe/garageLayout.ts';

const inside = (p: { x: number; z: number }, margin = 0) =>
  Math.abs(p.x) <= GARAGE.halfWidth - margin && Math.abs(p.z) <= GARAGE.halfDepth - margin;

describe('plan du Café Garage', () => {
  it('2 tables de belote dans la salle, autour du poteau sans le toucher', () => {
    expect(GARAGE_BELOTE_TABLES).toHaveLength(2);
    for (const t of [...GARAGE_BELOTE_TABLES, ...GARAGE_SMALL_TABLES]) {
      // Table et chaises (≈ 1,2 m autour du centre) dans la salle, et loin du poteau.
      expect(inside(t, 1.1)).toBe(true);
      expect(Math.hypot(t.x - GARAGE.pillar.x, t.z - GARAGE.pillar.z)).toBeGreaterThan(1.8);
    }
  });

  it('4 tables de terrasse sur la rue du milieu, dehors', () => {
    expect(GARAGE_TERRACE).toHaveLength(4);
    for (const t of GARAGE_TERRACE) {
      expect(t.z).toBeLessThan(-GARAGE.halfDepth - 0.8);
      expect(t.z).toBeGreaterThan(GARAGE.middleStreet.z0);
    }
  });

  it('le comptoir est au fond à droite en entrant par la place (mur ouest, côté nord), Khalifa derrière', () => {
    expect(GARAGE.counter.x).toBeLessThan(-GARAGE.halfWidth + 1.2);
    expect(GARAGE.counter.z1).toBeLessThan(0);
    expect(KHALIFA_SPOT.x).toBeLessThan(GARAGE.counter.x);
    expect(GARAGE.mainDoor.x).toBe(GARAGE.halfWidth);
  });

  it('la tournée de Rochdi ne traverse pas le poteau et sort par la porte de côté', () => {
    for (let i = 0; i < ROCHDI_ROUND.length; i++) {
      const a = ROCHDI_ROUND[i]!;
      const b = ROCHDI_ROUND[(i + 1) % ROCHDI_ROUND.length]!;
      for (let k = 0; k <= 20; k++) {
        const x = a.x + ((b.x - a.x) * k) / 20;
        const z = a.z + ((b.z - a.z) * k) / 20;
        expect(Math.hypot(x - GARAGE.pillar.x, z - GARAGE.pillar.z)).toBeGreaterThan(0.45);
        // Il ne passe le mur nord que par la porte de côté.
        if (Math.abs(z + GARAGE.halfDepth) < 0.1) {
          expect(x).toBeGreaterThan(GARAGE.sideDoor.x0);
          expect(x).toBeLessThan(GARAGE.sideDoor.x1);
        }
      }
    }
  });
});
