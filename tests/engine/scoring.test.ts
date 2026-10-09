import { describe, expect, it } from 'vitest';
import { TOTAL_HAND_POINTS, applyHandScore, calculateHandPoints, resolveContract } from '../../src/engine/index.ts';
import type { HandResult, Seat, Suit } from '../../src/engine/index.ts';
import { contract, rules, tricksFrom } from './helpers.ts';

/** Les 32 cartes regroupées en 8 plis (couleur par couleur). */
const ALL_TRICKS = [
  'AC 10C RC DC',
  'VC 9C 8C 7C',
  'AP 10P RP DP',
  'VP 9P 8P 7P',
  'AK 10K RK DK',
  'VK 9K 8K 7K',
  'AT 10T RT DT',
  'VT 9T 8T 7T',
];

describe('Test 10 — 162 points de cartes et dix de der', () => {
  for (const trump of ['pique', 'coeur', 'carreau', 'trefle'] as Suit[]) {
    it(`atout ${trump} : le paquet vaut 152 points, 162 avec le dix de der`, () => {
      const winners: Seat[] = [0, 1, 2, 3, 0, 1, 2, 3];
      const { trickPoints } = calculateHandPoints(tricksFrom(ALL_TRICKS, winners), { suit: trump }, rules());
      expect(trickPoints[0] + trickPoints[1]).toBe(TOTAL_HAND_POINTS);
    });
  }

  it('le dix de der revient à l’équipe qui remporte le dernier pli', () => {
    const allTeam0: Seat[] = [0, 0, 0, 0, 0, 0, 0, 2];
    const { trickPoints, tricksWon } = calculateHandPoints(tricksFrom(ALL_TRICKS, allTeam0), { suit: 'pique' }, rules());
    expect(trickPoints).toEqual([162, 0]);
    expect(tricksWon).toEqual([8, 0]);
    const lastToTeam1: Seat[] = [0, 0, 0, 0, 0, 0, 0, 1];
    // Le dernier pli (Valet, 9, 8, 7 de Trèfle, hors atout) vaut 2 points + 10 de der.
    expect(calculateHandPoints(tricksFrom(ALL_TRICKS, lastToTeam1), { suit: 'pique' }, rules()).trickPoints).toEqual([150, 12]);
  });
});

/**
 * Plis répartis pour l’atout Pique.
 * Équipe 0 gagne les plis listés dans `team0Tricks` (indices), l’équipe 1 le reste.
 */
function hand(team0Tricks: number[], lastTo: 0 | 1 = 0) {
  const winners = ALL_TRICKS.map((_, i) => ((team0Tricks.includes(i) ? 0 : 1) as Seat));
  // Le dernier pli est toujours l’indice 7 : on force son gagnant.
  winners[7] = lastTo === 0 ? 0 : 1;
  return tricksFrom(ALL_TRICKS, winners);
}

// Avec l’atout Pique : plis 0 (Cœur fort) = 28, 1 = 2, 2 (Pique fort) = 28, 3 (Pique V 9) = 34,
// 4 = 28, 5 = 2, 6 = 28, 7 = 2 (+10 de der).
describe('Test 11 — contrats réussis et chutés', () => {
  const r = rules();

  it('contrat réussi : le preneur marque la valeur du contrat, la défense ses points', () => {
    // Équipe 0 : plis 0, 2, 3, 4, 7 → 28 + 28 + 34 + 28 + 12 = 130 ; équipe 1 : 32.
    const res = resolveContract(hand([0, 2, 3, 4], 0), contract(100, 'pique', 0), null, r);
    expect(res.trickPoints).toEqual([130, 32]);
    expect(res.success).toBe(true);
    expect(res.handScore).toEqual([100, 32]);
  });

  it('avec contractPlusPoints, le preneur marque ses points + le contrat', () => {
    const res = resolveContract(hand([0, 2, 3, 4], 0), contract(100, 'pique', 0), null, rules({ contractSuccessScoring: 'contractPlusPoints' }));
    expect(res.handScore).toEqual([230, 32]);
  });

  it('contrat chuté si le seuil n’est pas atteint : la défense marque 160 + contrat', () => {
    // Équipe 0 : 130 points pour un contrat de 140.
    const res = resolveContract(hand([0, 2, 3, 4], 0), contract(140, 'pique', 0), null, r);
    expect(res.success).toBe(false);
    expect(res.handScore).toEqual([0, 300]);
  });

  it('le preneur doit atteindre la valeur annoncée', () => {
    // Équipe 0 : plis 0, 1, 2, 7 → 28 + 2 + 28 + 12 = 70 ; équipe 1 : 92.
    const res = resolveContract(hand([0, 1, 2], 0), contract(90, 'pique', 1), null, r);
    expect(res.trickPoints).toEqual([70, 92]);
    expect(res.success).toBe(true);
    const fail = resolveContract(hand([0, 1, 2], 0), contract(100, 'pique', 1), null, r);
    expect(fail.success).toBe(false);
    expect(fail.handScore).toEqual([260, 0]);
  });

  it('le preneur doit faire strictement plus de points que la défense', () => {
    // Équipe 0 : 70 + 20 de belote = 90, elle atteint son 90 mais la défense a 92.
    const res = resolveContract(hand([0, 1, 2], 0), contract(90, 'pique', 0), 0, r);
    expect(res.contractPoints).toEqual([90, 92]);
    expect(res.success).toBe(false);
  });

  it('la belote compte pour atteindre le contrat et reste acquise', () => {
    // Équipe 1 : 92 points + belote 20 = 112 ≥ 110.
    const res = resolveContract(hand([0, 1, 2], 0), contract(110, 'pique', 1), 3, r);
    expect(res.contractPoints).toEqual([70, 112]);
    expect(res.success).toBe(true);
    expect(res.handScore).toEqual([70, 130]);
  });

  it('la belote de la défense reste acquise quand le contrat réussit', () => {
    const res = resolveContract(hand([0, 2, 3, 4], 0), contract(100, 'pique', 0), 1, r);
    expect(res.success).toBe(true);
    expect(res.handScore).toEqual([100, 52]);
  });

  it('la belote du preneur reste acquise même en cas de chute (beloteAlwaysScored)', () => {
    const res = resolveContract(hand([0, 2, 3, 4], 0), contract(160, 'pique', 0), 0, r);
    expect(res.success).toBe(false);
    expect(res.handScore).toEqual([20, 320]);
    const strict = resolveContract(hand([0, 2, 3, 4], 0), contract(160, 'pique', 0), 0, rules({ beloteAlwaysScored: false }));
    expect(strict.handScore).toEqual([0, 320]);
  });

  it('capot non annoncé : le preneur fait les 8 plis et marque 250', () => {
    const res = resolveContract(hand([0, 1, 2, 3, 4, 5, 6], 0), contract(120, 'pique', 0), null, r);
    expect(res.capot).toBe('non-annonce');
    expect(res.handScore).toEqual([250, 0]);
  });

  it('capot annoncé réussi : 500 pour le preneur', () => {
    const res = resolveContract(hand([0, 1, 2, 3, 4, 5, 6], 0), contract('capot', 'pique', 0), null, r);
    expect(res.capot).toBe('annonce');
    expect(res.success).toBe(true);
    expect(res.handScore).toEqual([500, 0]);
  });

  it('capot annoncé chuté (un seul pli perdu) : 500 pour l’adversaire', () => {
    const res = resolveContract(hand([0, 1, 2, 3, 4, 5, 6], 1), contract('capot', 'pique', 0), null, r);
    expect(res.success).toBe(false);
    expect(res.handScore).toEqual([0, 500]);
  });
});

describe('Test 12 — coinche et surcoinche (×2 et ×4)', () => {
  const r = rules();

  it('contrat coinché réussi : score du preneur ×2', () => {
    const res = resolveContract(hand([0, 2, 3, 4], 0), contract(100, 'pique', 0, 2), null, r);
    expect(res.handScore).toEqual([200, 32]);
  });

  it('contrat coinché chuté : score de la défense ×2', () => {
    const res = resolveContract(hand([0, 2, 3, 4], 0), contract(140, 'pique', 0, 2), null, r);
    expect(res.handScore).toEqual([0, 600]);
  });

  it('contrat surcoinché : ×4', () => {
    expect(resolveContract(hand([0, 2, 3, 4], 0), contract(100, 'pique', 0, 4), null, r).handScore).toEqual([400, 32]);
    expect(resolveContract(hand([0, 2, 3, 4], 0), contract(140, 'pique', 0, 4), null, r).handScore).toEqual([0, 1200]);
  });

  it('la belote n’est jamais multipliée', () => {
    // 130 + 20 de belote = 150 < 160 : chute coinchée, la belote reste à 20.
    const res = resolveContract(hand([0, 2, 3, 4], 0), contract(160, 'pique', 0, 2), 0, r);
    expect(res.success).toBe(false);
    expect(res.handScore).toEqual([20, 640]);
  });

  it('capot annoncé coinché : 500 × 2 (capotMultiplied)', () => {
    const res = resolveContract(hand([0, 1, 2, 3, 4, 5, 6], 0), contract('capot', 'pique', 0, 2), null, r);
    expect(res.handScore).toEqual([1000, 0]);
    const flat = resolveContract(hand([0, 1, 2, 3, 4, 5, 6], 0), contract('capot', 'pique', 0, 2), null, rules({ capotMultiplied: false }));
    expect(flat.handScore).toEqual([500, 0]);
  });

  it('les multiplicateurs suivent la configuration', () => {
    const custom = rules({ coincheMultiplier: 3 });
    const res = resolveContract(hand([0, 2, 3, 4], 0), contract(100, 'pique', 0, custom.coincheMultiplier), null, custom);
    expect(res.handScore[0]).toBe(300);
  });
});

describe('Fin de partie', () => {
  const r = rules({ targetScore: 1000 });
  const result = (a: number, b: number) => ({ handScore: [a, b] }) as unknown as HandResult;

  it('pas de vainqueur tant que la cible n’est pas atteinte', () => {
    expect(applyHandScore([800, 700], result(100, 50), r)).toEqual({ scores: [900, 750], winner: null });
  });

  it('l’équipe la plus haute gagne une fois la cible atteinte', () => {
    expect(applyHandScore([900, 950], result(160, 32), r)).toEqual({ scores: [1060, 982], winner: 0 });
    expect(applyHandScore([990, 950], result(0, 300), r)).toEqual({ scores: [990, 1250], winner: 1 });
  });

  it('égalité au-delà de la cible : on continue', () => {
    expect(applyHandScore([950, 950], result(100, 100), r)).toEqual({ scores: [1050, 1050], winner: null });
  });
});
