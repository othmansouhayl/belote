import type {
  ActionResult,
  BidAction,
  Card,
  CompletedTrick,
  DealPattern,
  FinalContract,
  GameAction,
  GameState,
  HandEnding,
  Seat,
  Trick,
} from './types.ts';
import { type RulesConfig, makeRules } from './rulesConfig.ts';
import { shuffleDeck } from './deck.ts';
import { dealCards, validateDealPattern } from './deal.ts';
import { applyBid, createBiddingState, getLegalBids, validateBid } from './bidding.ts';
import { getLegalCards, resolveTrick, validatePlay } from './play.ts';
import { applyHandScore, resolveContract } from './scoring.ts';
import type { HandRemainder } from './scoring.ts';
import { canClaimNow } from './claim.ts';
import { createRng, randomInt } from './random.ts';
import { nextSeat, teamOf } from './seats.ts';

export interface CreateGameOptions {
  readonly rules?: Partial<RulesConfig>;
  /** Graine du mélange : une même graine rejoue exactement la même partie. */
  readonly seed?: string;
  /** Premier donneur ; tiré au sort à partir de la graine s'il n'est pas précisé (§3). */
  readonly dealer?: Seat;
  readonly dealPattern?: DealPattern;
}

export function createGame(options: CreateGameOptions = {}): GameState {
  const config = makeRules(options.rules);
  const seed = options.seed ?? `${Date.now()}-${Math.random()}`;
  const dealPattern = options.dealPattern ?? config.defaultDealPattern;
  const check = validateDealPattern(dealPattern, config);
  if (!check.ok) throw new Error(check.error);
  const dealer = options.dealer ?? (randomInt(createRng(`${seed}:donneur`), 4) as Seat);

  const initial: GameState = {
    config,
    seed,
    handNumber: 0,
    redeals: 0,
    dealer,
    dealPattern,
    phase: 'bidding',
    currentPlayer: null,
    hands: [[], [], [], []],
    bidding: createBiddingState(),
    contract: null,
    beloteHolder: null,
    beloteEvents: [],
    revealed: null,
    trick: null,
    completedTricks: [],
    scores: [0, 0],
    lastHandResult: null,
    handHistory: [],
    winner: null,
  };
  return dealHand(initial, dealer, 1, 0);
}

function dealHand(state: GameState, dealer: Seat, handNumber: number, redeals: number): GameState {
  const dir = state.config.playDirection;
  const deck = shuffleDeck(`${state.seed}:donne:${handNumber}:${redeals}`);
  return {
    ...state,
    handNumber,
    redeals,
    dealer,
    phase: 'bidding',
    currentPlayer: nextSeat(dealer, dir),
    hands: dealCards(deck, state.dealPattern, dealer, dir),
    bidding: createBiddingState(),
    contract: null,
    beloteHolder: null,
    beloteEvents: [],
    revealed: null,
    trick: null,
    completedTricks: [],
  };
}

/** Lance la manche suivante ; le donneur tourne d'une place (§3). */
export function startNextHand(state: GameState, dealPattern?: DealPattern): ActionResult {
  if (state.phase !== 'handOver') return { ok: false, error: "La manche en cours n'est pas terminée." };
  const pattern = dealPattern ?? state.dealPattern;
  const check = validateDealPattern(pattern, state.config);
  if (!check.ok) return check;
  const dealer = nextSeat(state.dealer, state.config.playDirection);
  return { ok: true, state: dealHand({ ...state, dealPattern: pattern }, dealer, state.handNumber + 1, state.redeals) };
}

export function legalBids(state: GameState, seat: Seat): BidAction[] {
  if (state.phase !== 'bidding' || state.currentPlayer !== seat) return [];
  return getLegalBids(state.bidding, seat, state.config);
}

export function legalCards(state: GameState, seat: Seat): Card[] {
  if (state.phase !== 'playing' || state.currentPlayer !== seat || !state.trick || !state.contract) return [];
  return getLegalCards(state.hands[seat] ?? [], state.trick, seat, state.contract.suit, state.config);
}

/**
 * Vrai si `seat` peut étaler ses cartes (« تي إفرش عاد ») : c'est à lui de jouer, il lui reste
 * au moins 2 cartes, et il est sûr de gagner tous les plis restants d'après ce qu'il sait.
 */
export function canClaim(state: GameState, seat: Seat): boolean {
  if (state.phase !== 'playing' || state.currentPlayer !== seat || !state.contract || !state.trick) return false;
  return canClaimNow(state.hands[seat] ?? [], state.completedTricks, state.trick, seat, state.contract.suit, state.config);
}

/** Point d'entrée unique : applique l'action d'un joueur ou explique pourquoi elle est refusée. */
export function applyAction(state: GameState, seat: Seat, action: GameAction): ActionResult {
  if (state.phase === 'gameOver') return { ok: false, error: 'La partie est terminée.' };
  if (state.phase === 'handOver') return { ok: false, error: 'La manche est terminée : lancez la suivante.' };
  if (state.currentPlayer !== seat) return { ok: false, error: "Ce n'est pas à vous de jouer." };

  if (action.type === 'bid') {
    if (state.phase !== 'bidding') return { ok: false, error: 'Les enchères sont terminées.' };
    return applyBidAction(state, seat, action.bid);
  }
  if (state.phase !== 'playing') return { ok: false, error: 'Les enchères ne sont pas terminées.' };
  if (action.type === 'claim') {
    if (!canClaim(state, seat)) {
      return { ok: false, error: 'Vous ne pouvez étaler vos cartes que si vous êtes sûr de gagner tous les plis restants.' };
    }
    const revealed = { seat, cards: state.hands[seat] ?? [] };
    // Le pli en cours et toutes les cartes restantes reviennent à l'équipe du joueur.
    const onTable = state.trick?.cards.map((p) => p.card) ?? [];
    const remainder = { team: teamOf(seat), cards: [...state.hands.flat(), ...onTable] };
    return { ok: true, state: endHand({ ...state, revealed }, state.completedTricks, remainder, { type: 'claim', seat }) };
  }
  return applyPlayAction(state, seat, action.cardId);
}

function applyBidAction(state: GameState, seat: Seat, bid: BidAction): ActionResult {
  const check = validateBid(state.bidding, seat, bid, state.config);
  if (!check.ok) return check;
  const step = applyBid(state.bidding, seat, bid, state.config);

  if (step.status === 'continue') {
    return { ok: true, state: { ...state, bidding: step.bidding, currentPlayer: step.nextPlayer } };
  }
  if (step.status === 'allPassed') {
    // §5.3 : donne annulée, redistribuée par le donneur suivant.
    const dealer = nextSeat(state.dealer, state.config.playDirection);
    return { ok: true, state: dealHand(state, dealer, state.handNumber, state.redeals + 1) };
  }

  const { bidding } = step;
  if (!bidding.contract) throw new Error('Enchères terminées sans contrat.');
  const multiplier =
    bidding.surcoinchedBy !== null
      ? state.config.surcoincheMultiplier
      : bidding.coinchedBy !== null
        ? state.config.coincheMultiplier
        : 1;
  const contract: FinalContract = {
    ...bidding.contract,
    multiplier,
    coinchedBy: bidding.coinchedBy,
    surcoinchedBy: bidding.surcoinchedBy,
  };
  const trump = contract.suit;
  const holder = state.hands.findIndex(
    (hand) => hand.some((c) => c.suit === trump && c.rank === 'R') && hand.some((c) => c.suit === trump && c.rank === 'D'),
  );
  const leader = nextSeat(state.dealer, state.config.playDirection);
  return {
    ok: true,
    state: {
      ...state,
      bidding,
      contract,
      beloteHolder: holder === -1 ? null : (holder as Seat),
      phase: 'playing',
      trick: { leader, cards: [] },
      currentPlayer: leader,
    },
  };
}

function applyPlayAction(state: GameState, seat: Seat, cardId: string): ActionResult {
  const contract = state.contract;
  const trick = state.trick;
  const hand = state.hands[seat];
  if (!contract || !trick || !hand) throw new Error('État de jeu incohérent.');

  const check = validatePlay(hand, trick, seat, cardId, contract.suit, state.config);
  if (!check.ok) return check;

  const card = hand.find((c) => c.id === cardId)!;
  const remaining = hand.filter((c) => c.id !== cardId);
  const hands = state.hands.map((h, i) => (i === seat ? remaining : h));

  let beloteEvents = state.beloteEvents;
  if (state.beloteHolder === seat && card.suit === contract.suit && (card.rank === 'R' || card.rank === 'D')) {
    const otherStillInHand = remaining.some((c) => c.suit === contract.suit && (c.rank === 'R' || c.rank === 'D'));
    beloteEvents = [...beloteEvents, { seat, announce: otherStillInHand ? 'belote' : 'rebelote' }];
  }

  const played: Trick = { ...trick, cards: [...trick.cards, { seat, card }] };
  const base = { ...state, hands, beloteEvents };

  if (played.cards.length < 4) {
    return { ok: true, state: { ...base, trick: played, currentPlayer: nextSeat(seat, state.config.playDirection) } };
  }

  const winner = resolveTrick(played, contract.suit);
  const completedTricks = [...state.completedTricks, { ...played, winner }];
  if (contract.value === 'capot' && teamOf(winner) !== teamOf(contract.bidder) && completedTricks.length < 8) {
    // Capot annoncé chuté (« يروووووووح ») : inutile de jouer la suite, les cartes restantes
    // reviennent à la défense.
    return {
      ok: true,
      state: endHand(base, completedTricks, { team: teamOf(winner), cards: hands.flat() }, { type: 'capotFailed', seat: winner }),
    };
  }
  if (completedTricks.length < 8) {
    return {
      ok: true,
      state: { ...base, completedTricks, trick: { leader: winner, cards: [] }, currentPlayer: winner },
    };
  }

  return { ok: true, state: endHand(base, completedTricks, null, { type: 'normal' }) };
}

/** Termine la manche : score, cartes restantes ramassées, partie éventuellement gagnée. */
function endHand(
  state: GameState,
  completedTricks: readonly CompletedTrick[],
  remainder: HandRemainder | null,
  ending: HandEnding,
): GameState {
  const contract = state.contract;
  if (!contract) throw new Error('État de jeu incohérent.');
  const result = resolveContract(completedTricks, contract, state.beloteHolder, state.config, remainder, ending);
  const { scores, winner } = applyHandScore(state.scores, result, state.config);
  return {
    ...state,
    hands: [[], [], [], []],
    completedTricks,
    trick: null,
    currentPlayer: null,
    scores,
    lastHandResult: result,
    handHistory: [...state.handHistory, result],
    winner,
    phase: winner === null ? 'handOver' : 'gameOver',
  };
}
