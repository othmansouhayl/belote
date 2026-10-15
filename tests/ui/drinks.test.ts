import { describe, expect, it } from 'vitest';
import { DRINKS } from '../../src/server/types.ts';
import { DRINK_AR, naderDrinkLine, servedDrink, servedDrinks, unluckySeat } from '../../src/ui/online/drinks.ts';

describe('Nader apporte les boissons', () => {
  it('la mauvaise boisson n’est jamais celle qui a été commandée', () => {
    for (const drink of DRINKS) {
      for (let i = 0; i < 20; i++) {
        const served = servedDrink(drink, `salon-${i}`);
        expect(served).not.toBe(drink);
        expect(DRINKS).toContain(served);
        expect(servedDrink(drink, `salon-${i}`)).toBe(served);
      }
    }
  });

  it('il se trompe pour une seule personne de la table, toujours la même sur les 4 téléphones', () => {
    const ordered = { 0: 'tey', 1: 'express', 2: 'chicha', 3: 'filtre' } as const;
    const unluckyCounts = [0, 0, 0, 0];
    for (let i = 0; i < 200; i++) {
      const served = servedDrinks(ordered, `salon:${i}`);
      expect(Object.keys(served)).toEqual(['0', '1', '2', '3']);
      const wrong = ([0, 1, 2, 3] as const).filter((seat) => served[seat] !== ordered[seat]);
      expect(wrong).toHaveLength(1);
      expect(wrong[0]).toBe(unluckySeat(ordered, `salon:${i}`));
      expect(servedDrinks(ordered, `salon:${i}`)).toEqual(served);
      unluckyCounts[wrong[0]!]! += 1;
    }
    // Chacun a son tour de malchance.
    for (const count of unluckyCounts) expect(count).toBeGreaterThan(20);
  });

  it('la phrase de Nader : ce qui a été commandé, puis ce qu’il a apporté', () => {
    expect(naderDrinkLine('tey', 'capucin')).toBe('مافماش تاي جبتلك كابوسان .. موش عاجبك معادش تجي');
    for (const drink of DRINKS) expect(DRINK_AR[drink]).toBeTruthy();
  });
});
