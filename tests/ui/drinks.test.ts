import { describe, expect, it } from 'vitest';
import { DRINKS } from '../../src/server/types.ts';
import { servedDrink, servedDrinks } from '../../src/ui/online/drinks.ts';

describe('Nader apporte les boissons', () => {
  it('jamais celle qui a été commandée, et la même sur les 4 téléphones', () => {
    for (const drink of DRINKS) {
      for (let i = 0; i < 20; i++) {
        const served = servedDrink(drink, `salon-${i}`);
        expect(served).not.toBe(drink);
        expect(DRINKS).toContain(served);
        expect(servedDrink(drink, `salon-${i}`)).toBe(served);
      }
    }
  });

  it('pour chaque place qui a commandé', () => {
    const served = servedDrinks({ 0: 'tey', 1: 'express', 2: 'chicha', 3: 'filtre' }, 'salon:0');
    expect(Object.keys(served)).toEqual(['0', '1', '2', '3']);
    expect(served[0]).not.toBe('tey');
  });
});
