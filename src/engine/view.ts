import type {
  BidAction,
  BiddingState,
  BeloteEvent,
  Card,
  CompletedTrick,
  FinalContract,
  GameState,
  HandResult,
  Phase,
  Seat,
  Team,
  Trick,
} from './types.ts';
import type { RulesConfig } from './rulesConfig.ts';
import { canClaim, legalBids, legalCards } from './game.ts';
import { teamOf } from './seats.ts';

/**
 * Ce qu'un joueur a le droit de savoir (§11.4) : sa propre main, les cartes posées
 * sur la table et les informations publiques. Jamais les autres mains, ni la graine.
 */
export interface PlayerView {
  readonly seat: Seat;
  readonly config: RulesConfig;
  readonly handNumber: number;
  readonly redeals: number;
  readonly dealer: Seat;
  readonly phase: Phase;
  readonly currentPlayer: Seat | null;
  readonly hand: readonly Card[];
  readonly handCounts: readonly number[];
  readonly bidding: BiddingState;
  readonly contract: FinalContract | null;
  readonly trick: Trick | null;
  readonly lastTrick: CompletedTrick | null;
  readonly tricksPlayed: number;
  readonly tricksWon: readonly [number, number];
  readonly beloteEvents: readonly BeloteEvent[];
  /** Cartes étalées par un joueur (« تي إفرش عاد ») : publiques par nature. */
  readonly revealed: GameState['revealed'];
  readonly scores: readonly [number, number];
  readonly lastHandResult: HandResult | null;
  readonly handHistory: readonly HandResult[];
  readonly winner: Team | null;
  /** Actions permises, calculées par le moteur : le navigateur ne décide jamais seul. */
  readonly legalBids: readonly BidAction[];
  readonly legalCardIds: readonly string[];
  /** Vrai si le joueur peut étaler ses cartes (« تي إفرش عاد »). */
  readonly canClaim: boolean;
}

export function getPlayerView(state: GameState, seat: Seat): PlayerView {
  const tricksWon: [number, number] = [0, 0];
  for (const trick of state.completedTricks) tricksWon[teamOf(trick.winner)] += 1;
  return {
    seat,
    config: state.config,
    handNumber: state.handNumber,
    redeals: state.redeals,
    dealer: state.dealer,
    phase: state.phase,
    currentPlayer: state.currentPlayer,
    hand: state.hands[seat] ?? [],
    handCounts: state.hands.map((h) => h.length),
    bidding: state.bidding,
    contract: state.contract,
    trick: state.trick,
    lastTrick: state.completedTricks[state.completedTricks.length - 1] ?? null,
    tricksPlayed: state.completedTricks.length,
    tricksWon,
    beloteEvents: state.beloteEvents,
    revealed: state.revealed,
    scores: state.scores,
    lastHandResult: state.lastHandResult,
    handHistory: state.handHistory,
    winner: state.winner,
    legalBids: legalBids(state, seat),
    legalCardIds: legalCards(state, seat).map((c) => c.id),
    canClaim: canClaim(state, seat),
  };
}
