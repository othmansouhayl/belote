import { describe, expect, it } from 'vitest';
import type { HandResult } from '../../src/engine/index.ts';
import { sheetRows, sheetValue, winsLabel } from '../../src/ui/scoreSheet.ts';

const hand = (a: number, b: number) => ({ handScore: [a, b] }) as unknown as HandResult;

describe('Le carton de score', () => {
  it('écrit en dizaines, avec ≠ au-delà de 1000 (le vrai score reste dans le moteur)', () => {
    expect(sheetValue(0)).toBe('0');
    expect(sheetValue(160)).toBe('16');
    expect(sheetValue(850)).toBe('85');
    expect(sheetValue(990)).toBe('99');
    expect(sheetValue(1000)).toBe('≠00');
    expect(sheetValue(1050)).toBe('≠05');
    expect(sheetValue(1120)).toBe('≠12');
    expect(sheetValue(1500)).toBe('≠50');
    expect(sheetValue(2030)).toBe('≠≠03');
  });

  it('chaque colonne a seulement les points de son équipe, en total cumulé', () => {
    const rows = sheetRows([hand(160, 0), hand(50, 110), hand(120, 40)], 0);
    expect(rows).toEqual([
      { n: '16', v: '0' },
      { n: '21', v: '11' },
      { n: '33', v: '15' },
    ]);
    // Vu par l'autre équipe : les colonnes s'inversent.
    expect(sheetRows([hand(160, 0)], 1)).toEqual([{ n: '0', v: '16' }]);
  });

  it('le compteur de manches se lit « Nous - Vous »', () => {
    expect(winsLabel([2, 1], 0)).toBe('2 - 1');
    expect(winsLabel([2, 1], 1)).toBe('1 - 2');
  });
});
