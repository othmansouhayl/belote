import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES, TOTAL_HAND_POINTS, applyHandScore, calculateHandPoints, resolveContract } from '../../src/engine/index.ts';
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

  it('contrat réussi : le preneur marque les points qu’il a faits, la défense les siens (validé)', () => {
    // Équipe 0 : plis 0, 2, 3, 4, 7 → 28 + 28 + 34 + 28 + 12 = 130 ; équipe 1 : 32.
    const res = resolveContract(hand([0, 2, 3, 4], 0), contract(100, 'pique', 0), null, r);
    expect(res.trickPoints).toEqual([130, 32]);
    expect(res.success).toBe(true);
    expect(res.handScore).toEqual([130, 32]);
    expect(DEFAULT_RULES.contractSuccessScoring).toBe('realizedPoints');
  });

  it('90 annoncé et 118 points faits : le preneur marque 118, pas 90', () => {
    // Équipe 0 : plis 0, 2, 3, 6 → 28 + 28 + 34 + 28 = 118 ; équipe 1 (dont dix de der) : 44.
    const res = resolveContract(hand([0, 2, 3, 6], 1), contract(90, 'pique', 0), null, r);
    expect(res.trickPoints).toEqual([118, 44]);
    expect(res.handScore).toEqual([118, 44]);
  });

  it('avec contractOnly, le preneur marque la valeur du contrat', () => {
    const res = resolveContract(hand([0, 2, 3, 4], 0), contract(100, 'pique', 0), null, rules({ contractSuccessScoring: 'contractOnly' }));
    expect(res.handScore).toEqual([100, 32]);
  });

  it('avec contractPlusPoints, le preneur marque ses points + le contrat', () => {
    const res = resolveContract(hand([0, 2, 3, 4], 0), contract(100, 'pique', 0), null, rules({ contractSuccessScoring: 'contractPlusPoints' }));
    expect(res.handScore).toEqual([230, 32]);
  });

  it('contrat chuté si le seuil n’est pas atteint : la défense marque 160 (validé)', () => {
    // Équipe 0 : 130 points pour un contrat de 140.
    const res = resolveContract(hand([0, 2, 3, 4], 0), contract(140, 'pique', 0), null, r);
    expect(res.success).toBe(false);
    expect(res.handScore).toEqual([0, 160]);
    const old = resolveContract(hand([0, 2, 3, 4], 0), contract(140, 'pique', 0), null, rules({ failedContractScoring: 'fixedPlusContract' }));
    expect(old.handScore).toEqual([0, 300]);
  });

  it('le preneur doit atteindre la valeur annoncée', () => {
    // Équipe 0 : plis 0, 1, 2, 7 → 28 + 2 + 28 + 12 = 70 ; équipe 1 : 92.
    const res = resolveContract(hand([0, 1, 2], 0), contract(90, 'pique', 1), null, r);
    expect(res.trickPoints).toEqual([70, 92]);
    expect(res.success).toBe(true);
    const fail = resolveContract(hand([0, 1, 2], 0), contract(100, 'pique', 1), null, r);
    expect(fail.success).toBe(false);
    expect(fail.handScore).toEqual([160, 0]);
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
    expect(res.handScore).toEqual([70, 112]);
  });

  it('la belote de la défense reste acquise quand le contrat réussit', () => {
    const res = resolveContract(hand([0, 2, 3, 4], 0), contract(100, 'pique', 0), 1, r);
    expect(res.success).toBe(true);
    expect(res.handScore).toEqual([130, 52]);
  });

  it('contrat chuté : la belote du preneur va à la défense (validé)', () => {
    const res = resolveContract(hand([0, 2, 3, 4], 0), contract(160, 'pique', 0), 0, r);
    expect(res.success).toBe(false);
    expect(res.handScore).toEqual([0, 180]);
    expect(res.belotePoints).toEqual([0, 20]);
    const holder = resolveContract(hand([0, 2, 3, 4], 0), contract(160, 'pique', 0), 0, rules({ beloteOnFailure: 'holder' }));
    expect(holder.handScore).toEqual([20, 160]);
  });

  it('contrat réussi sans coinche : la belote reste à celui qui la détient', () => {
    const res = resolveContract(hand([0, 2, 3, 4], 0), contract(100, 'pique', 0), 3, r);
    expect(res.handScore).toEqual([130, 52]);
    const strict = resolveContract(hand([0, 2, 3, 4], 0), contract(100, 'pique', 0), 3, rules({ beloteAlwaysScored: false }));
    expect(strict.handScore).toEqual([130, 32]);
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

  it('contrat coinché réussi : 320 pour le preneur, 0 pour la défense (validé)', () => {
    const res = resolveContract(hand([0, 2, 3, 4], 0), contract(100, 'pique', 0, 2), null, r);
    expect(res.handScore).toEqual([320, 0]);
  });

  it('contrat coinché chuté : 320 pour la défense (validé)', () => {
    const res = resolveContract(hand([0, 2, 3, 4], 0), contract(140, 'pique', 0, 2), null, r);
    expect(res.handScore).toEqual([0, 320]);
  });

  it('contrat surcoinché : 640 (validé)', () => {
    expect(resolveContract(hand([0, 2, 3, 4], 0), contract(100, 'pique', 0, 4), null, r).handScore).toEqual([640, 0]);
    expect(resolveContract(hand([0, 2, 3, 4], 0), contract(140, 'pique', 0, 4), null, r).handScore).toEqual([0, 640]);
  });

  it('la belote n’est jamais multipliée : 340 coinché, 660 surcoinché (validé)', () => {
    // 130 + 20 de belote = 150 < 160 : chute coinchée, la belote du preneur va à la défense.
    const res = resolveContract(hand([0, 2, 3, 4], 0), contract(160, 'pique', 0, 2), 0, r);
    expect(res.success).toBe(false);
    expect(res.handScore).toEqual([0, 340]);
    const sur = resolveContract(hand([0, 2, 3, 4], 0), contract(160, 'pique', 0, 4), 1, r);
    expect(sur.handScore).toEqual([0, 660]);
    // Coinché réussi : le preneur marque 320 + 20, même si la belote était chez la défense.
    const made = resolveContract(hand([0, 2, 3, 4], 0), contract(100, 'pique', 0, 2), 1, r);
    expect(made.handScore).toEqual([340, 0]);
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
    expect(res.handScore[0]).toBe(480);
    const usual = rules({ coincheMultiplier: 3, coinchedSuccessScoring: 'likeUncoinched' });
    expect(resolveContract(hand([0, 2, 3, 4], 0), contract(100, 'pique', 0, 3), null, usual).handScore).toEqual([390, 32]);
  });
});

describe('Fin de partie', () => {
  it('la partie se joue en 1500 points par défaut (validé)', () => {
    expect(DEFAULT_RULES.targetScore).toBe(1500);
  });

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
