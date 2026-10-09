import type { Card, PlayedCard, Seat, Suit, Trick, Validation } from './types.ts';
import type { RulesConfig } from './rulesConfig.ts';
import { SUIT_LABELS, cardStrength } from './deck.ts';
import { partnerOf } from './seats.ts';

/** Carte qui tient actuellement le pli (§7.5). */
export function winningCard(cards: readonly PlayedCard[], trump: Suit): PlayedCard {
  const first = cards[0];
  if (!first) throw new Error('Le pli est vide.');
  // La carte maîtresse est toujours de la couleur demandée ou de l'atout.
  let best = first;
  for (const played of cards.slice(1)) {
    const c = played.card;
    const b = best.card;
    const beats = c.suit === b.suit ? cardStrength(c, trump) > cardStrength(b, trump) : c.suit === trump;
    if (beats) best = played;
  }
  return best;
}

/** Gagnant d'un pli complet de 4 cartes. */
export function resolveTrick(trick: Trick, trump: Suit): Seat {
  if (trick.cards.length !== 4) throw new Error('Un pli complet contient 4 cartes.');
  return winningCard(trick.cards, trump).seat;
}

/** Cartes de la main que `seat` a le droit de jouer sur le pli en cours (§7.2 à §7.4). */
export function getLegalCards(hand: readonly Card[], trick: Trick, seat: Seat, trump: Suit, config: RulesConfig): Card[] {
  const first = trick.cards[0];
  if (!first) return [...hand];

  const led = first.card.suit;
  const trumps = hand.filter((c) => c.suit === trump);
  const master = winningCard(trick.cards, trump);
  const bestTrump = trick.cards.filter((p) => p.card.suit === trump).map((p) => cardStrength(p.card, trump));
  const bestTrumpStrength = bestTrump.length > 0 ? Math.max(...bestTrump) : -1;
  const higherTrumps = trumps.filter((c) => cardStrength(c, trump) > bestTrumpStrength);

  const following = hand.filter((c) => c.suit === led);
  if (following.length > 0) {
    if (led === trump && config.requireHigherTrumpWhenTrumpLed && higherTrumps.length > 0) return higherTrumps;
    return following;
  }

  if (trumps.length === 0 || !config.requireTrumpWhenVoid) return [...hand];
  if (master.seat === partnerOf(seat) && !config.requireTrumpWhenPartnerMaster) return [...hand];

  const trickHasTrump = bestTrumpStrength >= 0;
  if (!trickHasTrump || !config.requireOvertrump) return trumps;
  if (higherTrumps.length > 0) return higherTrumps;
  return config.requireUndertrump ? trumps : [...hand];
}

/** Explique pourquoi une carte est refusée, en français. */
export function explainIllegalCard(hand: readonly Card[], trick: Trick, trump: Suit, legal: readonly Card[]): string {
  const led = trick.cards[0]?.card.suit;
  if (led && hand.some((c) => c.suit === led)) {
    return led === trump
      ? `Vous devez fournir à ${SUIT_LABELS[led]} et monter si vous le pouvez.`
      : `Vous devez fournir à ${SUIT_LABELS[led]}.`;
  }
  if (legal.every((c) => c.suit === trump)) {
    return trick.cards.some((p) => p.card.suit === trump) && legal.length < hand.filter((c) => c.suit === trump).length
      ? `Vous devez surcouper à ${SUIT_LABELS[trump]}.`
      : `Vous devez couper à ${SUIT_LABELS[trump]}.`;
  }
  return "Cette carte n'est pas jouable.";
}

export function validatePlay(
  hand: readonly Card[],
  trick: Trick,
  seat: Seat,
  cardId: string,
  trump: Suit,
  config: RulesConfig,
): Validation {
  if (!hand.some((c) => c.id === cardId)) return { ok: false, error: "Cette carte n'est pas dans votre main." };
  const legal = getLegalCards(hand, trick, seat, trump, config);
  if (legal.some((c) => c.id === cardId)) return { ok: true };
  return { ok: false, error: explainIllegalCard(hand, trick, trump, legal) };
}
