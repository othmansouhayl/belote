import { describe, expect, it } from 'vitest';
import {
  CHOUAA,
  CHOUAA_BELOTE_TABLES,
  CHOUAA_HIGH_TABLES,
  CHOUAA_TABLES,
  COUNTER_STANDING,
  NIZAR_ROUND,
  chouaaGroundAt,
  highTableFootprint,
  tableFootprint,
} from '../../src/ui/cafe/chouaaLayout.ts';

const { room, counter, toilets, estrade } = CHOUAA;
type Rect = { x0: number; x1: number; z0: number; z1: number };
const inRect = (p: { x: number; z: number }, r: Rect, margin = 0) =>
  p.x > r.x0 - margin && p.x < r.x1 + margin && p.z > r.z0 - margin && p.z < r.z1 + margin;
const overlap = (a: Rect, b: Rect) => a.x0 < b.x1 && b.x0 < a.x1 && a.z0 < b.z1 && b.z0 < a.z1;

/** Toutes les tables, avec leurs chaises : les 2 de belote, les autres, et les tables hautes de l'estrade. */
const footprints = [
  ...CHOUAA_BELOTE_TABLES.map((t) => tableFootprint({ ...t, chairs: 'four' }, true)),
  ...CHOUAA_TABLES.map((t) => tableFootprint(t)),
  ...CHOUAA_HIGH_TABLES.map(highTableFootprint),
];

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

  it('la télé est contre la façade sud, à l’opposé de l’estrade, tournée vers le fond', () => {
    expect(CHOUAA.tv.z).toBeGreaterThan(room.z1 - 0.5);
    expect(CHOUAA.tv.z).toBeLessThan(room.z1);
    expect(CHOUAA.tv.x + CHOUAA.tv.width / 2).toBeLessThan(CHOUAA.mainDoor.x0);
  });

  it('café encombré, 2 tables seulement pour la belote, terrasse sur la rue principale seulement', () => {
    expect(CHOUAA_BELOTE_TABLES).toHaveLength(2);
    expect(CHOUAA_TABLES.length + CHOUAA_BELOTE_TABLES.length + CHOUAA_HIGH_TABLES.length).toBeGreaterThanOrEqual(30);
    const outside = CHOUAA_TABLES.filter((t) => !inRect(t, room));
    expect(outside.length).toBeGreaterThanOrEqual(5);
    for (const t of outside) {
      // Sur le trottoir de la façade sud, et plus rien le long de la rue de côté (les 8 fenêtres).
      expect(chouaaGroundAt(t.x, t.z)).toBeCloseTo(CHOUAA.sidewalk.height);
      expect(t.z).toBeGreaterThan(room.z1);
      expect(t.x).toBeLessThan(room.x1);
    }
  });

  it('sur l’estrade : seulement des tables hautes (plus aucune petite table)', () => {
    expect(CHOUAA_HIGH_TABLES.length).toBeGreaterThanOrEqual(3);
    for (const t of CHOUAA_HIGH_TABLES) expect(chouaaGroundAt(t.x, t.z)).toBeCloseTo(estrade.height);
    for (const t of CHOUAA_TABLES) expect(chouaaGroundAt(t.x, t.z)).not.toBeCloseTo(estrade.height);
  });

  it('aucune table ne touche une autre, un poteau, un mur, le comptoir, les WC ni le bord de l’estrade', () => {
    footprints.forEach((r, i) => {
      footprints.forEach((other, j) => {
        if (i < j) expect(overlap(r, other)).toBe(false);
      });
      for (const p of CHOUAA.pillars) expect(inRect(p, r, 0.1)).toBe(false);
      for (const c of [counter.front, counter.back, toilets]) expect(overlap(r, c)).toBe(false);
      const center = { x: (r.x0 + r.x1) / 2, z: (r.z0 + r.z1) / 2 };
      if (inRect(center, room)) {
        // Dedans : entre les murs, et pas à cheval sur le bord de l'estrade.
        expect(r.x0).toBeGreaterThan(room.x0);
        expect(r.x1).toBeLessThan(room.x1);
        expect(r.z0).toBeGreaterThan(room.z0);
        expect(r.z1).toBeLessThan(room.z1);
        expect(r.z0 < estrade.z1 && r.z1 > estrade.z1).toBe(false);
      } else {
        // Dehors : sur le trottoir, sans toucher la façade ni déborder sur la chaussée.
        const corners = [
          { x: r.x0, z: r.z0 },
          { x: r.x1, z: r.z1 },
        ];
        for (const c of corners) expect(chouaaGroundAt(c.x, c.z)).toBeCloseTo(CHOUAA.sidewalk.height);
        expect(overlap(r, { x0: room.x0 - 0.2, x1: room.x1 + 0.2, z0: room.z0 - 0.2, z1: room.z1 + 0.2 })).toBe(false);
      }
    });
  });

  it('la tournée de Nizar évite poteaux, comptoir, WC et tables, et ne passe les murs que par l’entrée principale', () => {
    for (let i = 0; i < NIZAR_ROUND.length; i++) {
      const a = NIZAR_ROUND[i]!;
      const b = NIZAR_ROUND[(i + 1) % NIZAR_ROUND.length]!;
      for (const p of along(a, b)) {
        for (const pillar of CHOUAA.pillars) expect(Math.hypot(p.x - pillar.x, p.z - pillar.z)).toBeGreaterThan(0.45);
        for (const c of [counter.front, counter.back, toilets]) expect(inRect(p, c, 0.15)).toBe(false);
        for (const r of footprints) expect(inRect(p, r)).toBe(false);
        for (const c of COUNTER_STANDING) expect(Math.hypot(p.x - c.x, p.z - c.z)).toBeGreaterThan(0.5);
        const alongSouth = p.x > room.x0 - 0.2 && p.x < room.x1 + 0.2;
        if (alongSouth && Math.abs(p.z - CHOUAA.mainDoor.z) < 0.12) {
          expect(p.x).toBeGreaterThan(CHOUAA.mainDoor.x0 + 0.2);
          expect(p.x).toBeLessThan(CHOUAA.mainDoor.x1 - 0.2);
        }
        // Jamais à travers le mur est, le mur du fond ni le mur ouest.
        if (p.z > room.z0 - 0.2 && p.z < CHOUAA.eastWallEnd) expect(Math.abs(p.x - (room.x1 + 0.1))).toBeGreaterThan(0.15);
        expect(p.z).toBeGreaterThan(room.z0 + 0.2);
        if (p.z < room.z1 + 0.2) expect(p.x).toBeGreaterThan(room.x0 + 0.2);
      }
    }
    // Il passe bien derrière le comptoir, et dehors devant la terrasse.
    expect(NIZAR_ROUND.some((p) => inRect(p, { x0: counter.back.x1, x1: room.x1, z0: room.z0, z1: counter.front.z0 }))).toBe(true);
    expect(NIZAR_ROUND.some((p) => p.z > CHOUAA.sidewalk.z0)).toBe(true);
  });
});
