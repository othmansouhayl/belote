import { describe, expect, it } from 'vitest';
import { CAFE, SIDE_TERRACE, groundAt } from '../../src/ui/cafe/cafeLayout.ts';

describe('Plan du café : hauteur du sol', () => {
  it('le café est au niveau de la rue, la salle du fond 20 cm plus haut', () => {
    expect(groundAt(0, -5)).toBe(0);
    expect(groundAt(0, -16)).toBe(CAFE.stepHeight);
    expect(groundAt(0, 2)).toBe(0);
  });

  it('terrasse sur palier : +50 cm sur les 10 premiers mètres, +70 cm sur les 10 suivants', () => {
    const x = SIDE_TERRACE.tableX;
    expect(groundAt(x, -3)).toBe(0.5);
    expect(groundAt(x, -9.9)).toBe(0.5);
    expect(groundAt(x, -10.1)).toBe(0.7);
    expect(groundAt(x, -19.5)).toBe(0.7);
    expect(SIDE_TERRACE.x1 - SIDE_TERRACE.x0).toBe(2);
  });

  it('les escaliers montent progressivement', () => {
    const x = SIDE_TERRACE.x0 + 0.5;
    expect(groundAt(x, SIDE_TERRACE.stairs.depth)).toBe(0);
    expect(groundAt(x, SIDE_TERRACE.stairs.depth / 2)).toBeCloseTo(0.25);
    expect(groundAt(SIDE_TERRACE.x0 + 0.01, -11.8)).toBeLessThan(0.1);
    expect(groundAt(SIDE_TERRACE.sideDoor.x1 - 0.01, -11.8)).toBeGreaterThan(0.6);
  });
});
