import type { Card, Suit } from './types.ts';
import { cardStrength, createDeck } from './deck.ts';

/**
 * « تي إفرش عاد » : le joueur qui a la main peut étaler ses cartes quand elles sont toutes
 * maîtresses. On ne regarde que ce que le joueur sait lui-même : sa main et les cartes déjà
 * jouées. Les cartes des autres ne comptent pas (pour ne rien révéler, et parce que la
 * réussite doit être certaine quelle que soit leur répartition).
 *
 * En entamant d'abord ses atouts du plus fort au plus faible, puis ses autres cartes du plus
 * fort au plus faible, le joueur gagne tous les plis si :
 * - chacun de ses atouts entamés tant qu'il en reste ailleurs est plus fort que le meilleur
 *   atout encore caché (chaque entame d'atout en fait tomber au moins un, car on doit fournir) ;
 * - s'il a d'autres couleurs, il a assez d'atouts pour faire tomber tous les atouts cachés ;
 * - dans chaque autre couleur, ses cartes sont plus fortes que toutes celles encore cachées
 *   (et plus personne ne peut couper, puisque les atouts sont tombés).
 */
export function canClaimWith(hand: readonly Card[], played: readonly Card[], trump: Suit): boolean {
  if (hand.length === 0) return false;
  const known = new Set([...hand, ...played].map((c) => c.id));
  const hidden = createDeck().filter((c) => !known.has(c.id));
  const strength = (c: Card) => cardStrength(c, trump);
  const desc = (a: Card, b: Card) => strength(b) - strength(a);

  const hiddenTrumps = hidden.filter((c) => c.suit === trump).sort(desc);
  const myTrumps = hand.filter((c) => c.suit === trump).sort(desc);
  const bestHiddenTrump = hiddenTrumps[0];
  if (bestHiddenTrump) {
    // Tant qu'il reste des atouts cachés, chaque atout entamé doit battre le meilleur d'entre eux.
    const draws = Math.min(hiddenTrumps.length, myTrumps.length);
    for (let i = 0; i < draws; i++) {
      if (strength(myTrumps[i]!) <= strength(bestHiddenTrump)) return false;
    }
    // Avec d'autres couleurs en main, il faut d'abord avoir fait tomber tous les atouts cachés.
    const hasOtherSuits = myTrumps.length < hand.length;
    if (hasOtherSuits && myTrumps.length < hiddenTrumps.length) return false;
  }

  for (const card of hand) {
    if (card.suit === trump) continue;
    const beaten = hidden.some((h) => h.suit === card.suit && strength(h) > strength(card));
    if (beaten) return false;
  }
  return true;
}

/** Ordre dans lequel le joueur étale ses cartes : atouts puis autres couleurs, du plus fort au plus faible. */
export function claimOrder(hand: readonly Card[], trump: Suit): Card[] {
  return [...hand].sort(
    (a, b) => Number(b.suit === trump) - Number(a.suit === trump) || cardStrength(b, trump) - cardStrength(a, trump),
  );
}
