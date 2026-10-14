import { describe, expect, it } from 'vitest';
import {
  CHOUAA,
  CHOUAA_ESTRADE_TABLES,
  CHOUAA_TABLES,
  CHOUAA_WINDOW_TABLES,
  NIZAR_ROUND,
  chouaaGroundAt,
} from '../../src/ui/cafe/chouaaLayout.ts';

const { room, counter, toilets, estrade } = CHOUAA;
const inRect = (p: { x: number; z: number }, r: { x0: number; x1: number; z0: number; z1: number }, margin = 0) =>
  p.x > r.x0 - margin && p.x < r.x1 + margin && p.z > r.z0 - margin && p.z < r.z1 + margin;

/** Les points d'un segment, tous les 5 cm. */
function* along(a: { x: number; z: number }, b: { x: number; z: number }) {
  const n = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.05);
  for (let k = 0; k <= n; k++) yield { x: a.x + ((b.x - a.x) * k) / n, z: a.z + ((b.z - a.z) * k) / n };
}

describe('plan du Café Chouâa (relevé dans rayon.ifc)', () => {
  it('les mesures du fichier : salle de 11,90 × 13,70 m, estrade de 2,85 m à 25 cm, 4 poteaux, 8 + 2 fenêtres', () => {
    expect(room.x1 - room.x0).toBeCloseTo(11.9);
    expect(room.z1 - room.z0).toBeCloseTo(13.7);
    expect(estrade.z1 - estrade.z0).toBeCloseTo(2.85);
    expect(chouaaGroundAt(0, -6)).toBeCloseTo(0.25);
    expect(chouaaGroundAt(0, 0)).toBe(0);
    expect(CHOUAA.pillars).toHaveLength(4);
    expect(CHOUAA.eastWindows).toHaveLength(8);
    expect(CHOUAA.southWindows).toHaveLength(2);
    expect(CHOUAA.mainDoor.x1 - CHOUAA.mainDoor.x0).toBeCloseTo(2.56);
    const { a, b } = CHOUAA.cornerDoor;
    expect(Math.hypot(b.x - a.x, b.z - a.z)).toBeCloseTo(1.4, 1);
  });

  it('le comptoir en L est sur l’estrade, avec un passage le long du mur du fond ; les WC dans le coin nord-ouest', () => {
    expect(counter.front.z0).toBeGreaterThanOrEqual(estrade.z0);
    expect(counter.front.z1).toBeLessThanOrEqual(estrade.z1);
    expect(counter.back.x0).toBe(counter.front.x0);
    expect(counter.back.z0 - room.z0).toBeCloseTo(0.5);
    expect(toilets.x0).toBe(room.x0);
    expect(toilets.z0).toBe(room.z0);
  });

  it('les tables sont dans la salle, sans toucher les poteaux, le comptoir ni les WC', () => {
    // Grandes tables : 4 chaises tout autour. Petites : 2 chaises, au nord et au sud.
    const big = CHOUAA_TABLES.map((t) => ({ ...t, rx: 0.68 + 0.25, rz: 0.68 + 0.25 }));
    const small = [...CHOUAA_WINDOW_TABLES, ...CHOUAA_ESTRADE_TABLES].map((t) => ({ ...t, rx: 0.4, rz: 0.55 + 0.25 }));
    for (const t of [...big, ...small]) {
      const r = { x0: t.x - t.rx, x1: t.x + t.rx, z0: t.z - t.rz, z1: t.z + t.rz };
      expect(r.x0).toBeGreaterThan(room.x0);
      expect(r.x1).toBeLessThan(room.x1);
      expect(r.z0).toBeGreaterThan(room.z0);
      expect(r.z1).toBeLessThan(room.z1);
      for (const p of CHOUAA.pillars) expect(inRect(p, r, 0.1)).toBe(false);
      for (const c of [counter.front, counter.back, toilets]) expect(r.x1 < c.x0 || r.x0 > c.x1 || r.z1 < c.z0 || r.z0 > c.z1).toBe(true);
    }
    // Les tables de l'estrade sont dessus, les autres en bas.
    for (const t of CHOUAA_ESTRADE_TABLES) expect(chouaaGroundAt(t.x, t.z)).toBeCloseTo(0.25);
    for (const t of [...CHOUAA_TABLES, ...CHOUAA_WINDOW_TABLES]) expect(chouaaGroundAt(t.x, t.z)).toBe(0);
  });

  it('la tournée de Nizar évite poteaux, comptoir, WC et tables, et ne sort que par l’entrée principale', () => {
    const tables = [
      ...CHOUAA_TABLES.map((t) => ({ ...t, half: 0.68 + 0.2 })),
      ...[...CHOUAA_WINDOW_TABLES, ...CHOUAA_ESTRADE_TABLES].map((t) => ({ ...t, half: 0.35 })),
    ];
    for (let i = 0; i < NIZAR_ROUND.length; i++) {
      const a = NIZAR_ROUND[i]!;
      const b = NIZAR_ROUND[(i + 1) % NIZAR_ROUND.length]!;
      for (const p of along(a, b)) {
        for (const pillar of CHOUAA.pillars) expect(Math.hypot(p.x - pillar.x, p.z - pillar.z)).toBeGreaterThan(0.45);
        for (const c of [counter.front, counter.back, toilets]) expect(inRect(p, c, 0.15)).toBe(false);
        for (const t of tables) expect(Math.abs(p.x - t.x) < t.half && Math.abs(p.z - t.z) < t.half).toBe(false);
        // Les murs : il ne traverse la façade sud que par l'entrée principale, et jamais les autres.
        expect(p.x).toBeGreaterThan(room.x0 + 0.2);
        expect(p.x).toBeLessThan(room.x1 - 0.2);
        expect(p.z).toBeGreaterThan(room.z0 + 0.2);
        if (Math.abs(p.z - CHOUAA.mainDoor.z) < 0.12) {
          expect(p.x).toBeGreaterThan(CHOUAA.mainDoor.x0 + 0.2);
          expect(p.x).toBeLessThan(CHOUAA.mainDoor.x1 - 0.2);
        }
      }
    }
    // Il passe bien derrière le comptoir, et dehors sur le trottoir.
    expect(NIZAR_ROUND.some((p) => inRect(p, { x0: counter.back.x1, x1: room.x1, z0: room.z0, z1: counter.front.z0 }))).toBe(true);
    expect(NIZAR_ROUND.some((p) => p.z > CHOUAA.sidewalk.z0)).toBe(true);
  });
});
