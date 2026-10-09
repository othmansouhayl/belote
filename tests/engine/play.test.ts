import { describe, expect, it } from 'vitest';
import { getLegalCards, resolveTrick, validatePlay } from '../../src/engine/index.ts';
import { cards, rules, trick } from './helpers.ts';

const ids = (list: { id: string }[]) => list.map((c) => c.id).sort();

describe('Test 7 — fournir la couleur demandée', () => {
  const hand = cards('AC 7C VP 9K');

  it('ne laisse jouer que la couleur demandée quand on en possède', () => {
    const legal = getLegalCards(hand, trick(0, 'RC'), 1, 'pique', rules());
    expect(ids(legal)).toEqual(ids(cards('AC 7C')));
  });

  it('refuse une autre carte avec un message en français', () => {
    const r = validatePlay(hand, trick(0, 'RC'), 1, '9-carreau', 'pique', rules());
    expect(r).toEqual({ ok: false, error: 'Vous devez fournir à Cœur.' });
    expect(validatePlay(hand, trick(0, 'RC'), 1, 'A-coeur', 'pique', rules()).ok).toBe(true);
  });

  it('refuse une carte qui n’est pas dans la main', () => {
    expect(validatePlay(hand, trick(0, 'RC'), 1, 'R-coeur', 'pique', rules()).ok).toBe(false);
  });

  it('l’entame est libre', () => {
    expect(getLegalCards(hand, trick(0, ''), 0, 'pique', rules())).toHaveLength(4);
  });
});

describe('Test 8 — obligations d’atout selon la configuration', () => {
  const trump = 'pique';

  it('coupe obligatoire quand on ne peut pas fournir (requireTrumpWhenVoid)', () => {
    const hand = cards('7P AP 9K 10T');
    expect(ids(getLegalCards(hand, trick(0, 'RC'), 1, trump, rules()))).toEqual(ids(cards('7P AP')));
    expect(getLegalCards(hand, trick(0, 'RC'), 1, trump, rules({ requireTrumpWhenVoid: false }))).toHaveLength(4);
    expect(validatePlay(hand, trick(0, 'RC'), 1, '9-carreau', trump, rules())).toEqual({
      ok: false,
      error: 'Vous devez couper à Pique.',
    });
  });

  it('sans atout ni couleur demandée, toute carte est jouable', () => {
    expect(getLegalCards(cards('9K 10T'), trick(0, 'RC'), 1, trump, rules())).toHaveLength(2);
  });

  it('surcoupe obligatoire sur un atout adverse (requireOvertrump)', () => {
    // Joueur 0 entame Cœur, joueur 1 (adverse du joueur 2) coupe avec le 10 de Pique.
    const t = trick(0, 'RC 10P');
    const hand = cards('7P 9P 9K');
    expect(ids(getLegalCards(hand, t, 2, trump, rules()))).toEqual(ids(cards('9P')));
    expect(ids(getLegalCards(hand, t, 2, trump, rules({ requireOvertrump: false })))).toEqual(ids(cards('7P 9P')));
  });

  it('sous-coupe obligatoire si on ne peut pas surcouper (requireUndertrump)', () => {
    const t = trick(0, 'RC VP');
    const hand = cards('7P 9K');
    expect(ids(getLegalCards(hand, t, 2, trump, rules()))).toEqual(ids(cards('7P')));
    expect(getLegalCards(hand, t, 2, trump, rules({ requireUndertrump: false }))).toHaveLength(2);
  });

  it('partenaire maître du pli : carte libre (requireTrumpWhenPartnerMaster = false, validé)', () => {
    // Joueur 0 entame l’As de Cœur, joueur 1 fournit ; le joueur 2 (partenaire du 0) n’a pas de Cœur.
    const t = trick(0, 'AC 7C');
    const hand = cards('7P 9K');
    expect(getLegalCards(hand, t, 2, trump, rules())).toHaveLength(2);
    expect(ids(getLegalCards(hand, t, 2, trump, rules({ requireTrumpWhenPartnerMaster: true })))).toEqual(ids(cards('7P')));
  });

  it('partenaire maître par la coupe : pas d’obligation de surcouper', () => {
    // 0 entame Cœur, 1 coupe du 10 de Pique, 2 fournit, 3 (partenaire du 1) n’a pas de Cœur.
    const t = trick(0, 'RC 10P 7C');
    const hand = cards('7P VP 9K');
    expect(getLegalCards(hand, t, 3, trump, rules())).toHaveLength(3);
  });

  it('adversaire maître : la règle normale s’applique', () => {
    // 0 entame Cœur, 1 fournit faible, 2 (partenaire du 0) fournit l’As : pour le joueur 3, l’adversaire 2 est maître.
    const t = trick(0, '7C 8C AC');
    expect(ids(getLegalCards(cards('7P 9K'), t, 3, trump, rules()))).toEqual(ids(cards('7P')));
  });

  it('atout demandé : obligation de monter (requireHigherTrumpWhenTrumpLed, validé)', () => {
    const t = trick(0, 'AP');
    const hand = cards('7P 9P VP 8C');
    expect(ids(getLegalCards(hand, t, 1, trump, rules()))).toEqual(ids(cards('9P VP')));
    expect(ids(getLegalCards(hand, t, 1, trump, rules({ requireHigherTrumpWhenTrumpLed: false })))).toEqual(
      ids(cards('7P 9P VP')),
    );
  });

  it('atout demandé sans atout plus fort : n’importe quel atout', () => {
    expect(ids(getLegalCards(cards('7P 8P 8C'), trick(0, 'VP'), 1, trump, rules()))).toEqual(ids(cards('7P 8P')));
  });

  it('atout demandé, on n’a plus d’atout : carte libre', () => {
    expect(getLegalCards(cards('8C AK'), trick(0, 'VP'), 1, trump, rules())).toHaveLength(2);
  });
});

describe('Test 9 — gagnant du pli', () => {
  it('hors atout : la plus forte carte de la couleur demandée gagne', () => {
    expect(resolveTrick(trick(0, '10C AC RC 7C'), 'pique')).toBe(1);
    // L’As de Carreau n’est pas de la couleur demandée : il ne peut pas gagner.
    expect(resolveTrick(trick(2, 'VC 9C AK 8C'), 'pique')).toBe(2);
  });

  it('ordre hors atout : As, 10, Roi, Dame, Valet, 9, 8, 7', () => {
    expect(resolveTrick(trick(0, '10K RK DK VK'), 'pique')).toBe(0);
    expect(resolveTrick(trick(0, 'VK 9K 8K 7K'), 'pique')).toBe(0);
  });

  it('à l’atout : Valet, 9, As, 10, Roi, Dame, 8, 7', () => {
    expect(resolveTrick(trick(0, 'AP 9P 10P VP'), 'pique')).toBe(3);
    expect(resolveTrick(trick(0, 'AP 9P 10P RP'), 'pique')).toBe(1);
    expect(resolveTrick(trick(0, 'DP 8P 7P RP'), 'pique')).toBe(3);
  });

  it('le plus petit atout bat la plus forte carte de la couleur demandée', () => {
    expect(resolveTrick(trick(0, 'AC 10C 7P RC'), 'pique')).toBe(2);
  });

  it('le plus fort atout l’emporte quand plusieurs joueurs coupent', () => {
    expect(resolveTrick(trick(1, 'AC 7P 9P 8P'), 'pique')).toBe(3);
  });
});
