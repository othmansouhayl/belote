import {
  RANKS,
  SUITS,
  cardPoints,
  canClaimWith,
  cardStrength,
  getLegalBids,
  getLegalCards,
  partnerOf,
  teamOf,
  winningCard,
} from '../engine/index.ts';
import type {
  BidAction,
  BiddingState,
  Card,
  CompletedTrick,
  FinalContract,
  GameAction,
  GameState,
  RulesConfig,
  Seat,
  Suit,
  Trick,
} from '../engine/index.ts';

/** Ce qu'un joueur voit légitimement à la table : sa main et les cartes déjà jouées. */
export interface BotView {
  readonly seat: Seat;
  readonly hand: readonly Card[];
  readonly bidding: BiddingState;
  readonly contract: FinalContract | null;
  readonly trick: Trick | null;
  readonly completedTricks: readonly CompletedTrick[];
  readonly config: RulesConfig;
}

export function botView(state: GameState, seat: Seat): BotView {
  return {
    seat,
    hand: state.hands[seat] ?? [],
    bidding: state.bidding,
    contract: state.contract,
    trick: state.trick,
    completedTricks: state.completedTricks,
    config: state.config,
  };
}

/** Estimation grossière de ce qu'une main peut rapporter avec `trump` comme atout. */
export function estimateHand(hand: readonly Card[], trump: Suit): number {
  let score = 0;
  const trumps = hand.filter((c) => c.suit === trump);
  for (const card of trumps) score += cardPoints(card, trump) + 5;
  if (trumps.some((c) => c.rank === 'R') && trumps.some((c) => c.rank === 'D')) score += 20;
  for (const card of hand) {
    if (card.suit === trump) continue;
    if (card.rank === 'A') score += 11;
    if (card.rank === '10' && hand.some((c) => c.suit === card.suit && c.rank === 'A')) score += 10;
  }
  // Sans le Valet ni le 9 d'atout, la main est fragile.
  if (!trumps.some((c) => c.rank === 'V' || c.rank === '9')) score -= 20;
  return score;
}

/** Contrat maximal que le bot accepte d'annoncer dans `suit` (on compte ~30 points apportés par le partenaire). */
function maxBidFor(hand: readonly Card[], suit: Suit, config: RulesConfig): number | 'capot' {
  const estimate = estimateHand(hand, suit) + 30;
  if (estimate >= 200) return 'capot';
  return Math.min(config.maximumBid, Math.floor(estimate / 10) * 10);
}

function chooseBid(view: BotView): BidAction {
  const { bidding, hand, seat, config } = view;
  const legal = getLegalBids(bidding, seat, config);
  const has = (type: BidAction['type']) => legal.some((a) => a.type === type);
  const contract = bidding.contract;

  if (has('surcoinche') && contract) {
    const max = maxBidFor(hand, contract.suit, config);
    const value = contract.value === 'capot' ? Number.POSITIVE_INFINITY : contract.value;
    if (max === 'capot' || max >= value + 20) return { type: 'surcoinche' };
    return { type: 'pass' };
  }

  if (has('coinche') && contract && contract.value !== 'capot') {
    const trump = contract.suit;
    const trumpHonours = hand
      .filter((c) => c.suit === trump && (c.rank === 'V' || c.rank === '9' || c.rank === 'A'))
      .reduce((sum, c) => sum + cardPoints(c, trump), 0);
    const sideAces = hand.filter((c) => c.suit !== trump && c.rank === 'A').length * 11;
    if (contract.value >= 120 && trumpHonours + sideAces >= 45) return { type: 'coinche' };
  }

  // Ne pas surenchérir sur son partenaire : on lui fait confiance.
  if (contract && teamOf(contract.bidder) === teamOf(seat)) return { type: 'pass' };

  let best: BidAction | null = null;
  let bestMargin = -1;
  for (const suit of SUITS) {
    const max = maxBidFor(hand, suit, config);
    const options = legal.filter((a): a is Extract<BidAction, { type: 'bid' }> => a.type === 'bid' && a.suit === suit);
    if (options.length === 0) continue;
    const lowest = options.find((a) => a.value !== 'capot');
    if (max === 'capot') {
      const capot = options.find((a) => a.value === 'capot');
      if (capot) return capot;
      continue;
    }
    if (!lowest || lowest.value === 'capot' || lowest.value > max) continue;
    const margin = max - lowest.value;
    if (margin > bestMargin) {
      best = lowest;
      bestMargin = margin;
    }
  }
  return best ?? { type: 'pass' };
}

/** Cartes encore inconnues du bot : ni dans sa main, ni déjà jouées. */
function unseenCards(view: BotView): Set<string> {
  const seen = new Set<string>([
    ...view.hand.map((c) => c.id),
    ...view.completedTricks.flatMap((t) => t.cards.map((p) => p.card.id)),
    ...(view.trick?.cards.map((p) => p.card.id) ?? []),
  ]);
  const unseen = new Set<string>();
  for (const suit of SUITS) for (const rank of RANKS) if (!seen.has(`${rank}-${suit}`)) unseen.add(`${rank}-${suit}`);
  return unseen;
}

/** Vrai si aucune carte encore en jeu chez les autres ne bat `card` dans sa couleur. */
function isMaster(card: Card, trump: Suit, unseen: Set<string>): boolean {
  for (const rank of RANKS) {
    if (!unseen.has(`${rank}-${card.suit}`)) continue;
    if (cardStrength({ id: '', suit: card.suit, rank }, trump) > cardStrength(card, trump)) return false;
  }
  return true;
}

const byCheapest = (trump: Suit) => (a: Card, b: Card) =>
  cardPoints(a, trump) - cardPoints(b, trump) || cardStrength(a, trump) - cardStrength(b, trump);

function chooseCard(view: BotView): Card {
  const { hand, trick, contract, seat, config } = view;
  if (!trick || !contract) throw new Error('Le bot ne peut pas jouer hors de la phase de jeu.');
  const trump = contract.suit;
  const legal = getLegalCards(hand, trick, seat, trump, config);
  const unseen = unseenCards(view);
  const cheapest = [...legal].sort(byCheapest(trump));

  if (trick.cards.length === 0) {
    const takerSide = teamOf(contract.bidder) === teamOf(seat);
    const opponentsMayHaveTrump = [...unseen].some((id) => id.endsWith(`-${trump}`));
    const masterTrump = legal.find((c) => c.suit === trump && isMaster(c, trump, unseen));
    if (takerSide && opponentsMayHaveTrump && masterTrump) return masterTrump;
    const masterSide = legal.filter((c) => c.suit !== trump && isMaster(c, trump, unseen));
    if (masterSide.length > 0) return masterSide.sort((a, b) => cardPoints(b, trump) - cardPoints(a, trump))[0]!;
    return cheapest.find((c) => c.suit !== trump) ?? cheapest[0]!;
  }

  const current = winningCard(trick.cards, trump);
  const lastToPlay = trick.cards.length === 3;
  if (current.seat === partnerOf(seat) && (lastToPlay || isMaster(current.card, trump, unseen))) {
    // Le partenaire tient le pli : on lui donne des points, sans gaspiller d'atout.
    const sideCards = legal.filter((c) => c.suit !== trump);
    if (sideCards.length > 0) return sideCards.sort((a, b) => cardPoints(b, trump) - cardPoints(a, trump))[0]!;
    return cheapest[0]!;
  }

  const winners = legal.filter((c) => winningCard([...trick.cards, { seat, card: c }], trump).seat === seat);
  if (winners.length > 0) {
    if (lastToPlay) return winners.sort(byCheapest(trump))[0]!;
    const safe = winners.filter((c) => isMaster(c, trump, unseen));
    if (safe.length > 0) return safe.sort(byCheapest(trump))[0]!;
    return winners.sort((a, b) => cardStrength(a, trump) - cardStrength(b, trump))[0]!;
  }
  return cheapest[0]!;
}

/** Choisit l'action d'un bot à partir de ce qu'il voit uniquement. */
export function chooseBotAction(view: BotView): GameAction {
  if (view.contract === null) return { type: 'bid', bid: chooseBid(view) };
  // Toutes ses cartes sont maîtresses : le bot les étale pour ne pas faire attendre la table.
  if (view.trick?.cards.length === 0 && view.hand.length >= 2) {
    const played = view.completedTricks.flatMap((t) => t.cards.map((c) => c.card));
    if (canClaimWith(view.hand, played, view.contract.suit)) return { type: 'claim' };
  }
  return { type: 'play', cardId: chooseCard(view).id };
}
