import type { RulesConfig } from './rulesConfig.ts';

export type Suit ='pique' | 'coeur' | 'carreau' | 'trefle';
export type Rank = '7' | '8' | '9' | '10' | 'V' | 'D' | 'R' | 'A';

export interface Card {
  readonly id: string;
  readonly suit: Suit;
  readonly rank: Rank;
}

/** Places 0 à 3 ; les partenaires sont face à face (0 avec 2, 1 avec 3). */
export type Seat = 0 | 1 | 2 | 3;
export type Team = 0 | 1;

export type DealPattern = readonly [number, number];

export type BidAction =
  | { readonly type: 'pass' }
  | { readonly type: 'bid'; readonly value: number | 'capot'; readonly suit: Suit }
  | { readonly type: 'coinche' }
  | { readonly type: 'surcoinche' };

export interface Contract {
  readonly value: number | 'capot';
  readonly suit: Suit;
  readonly bidder: Seat;
}

export interface BiddingState {
  readonly history: readonly { readonly seat: Seat; readonly action: BidAction }[];
  readonly contract: Contract | null;
  readonly coinchedBy: Seat | null;
  readonly surcoinchedBy: Seat | null;
  readonly hasPassed: readonly boolean[];
  readonly consecutivePasses: number;
  /** Joueurs de l'équipe preneuse qui peuvent encore surcoincher, dans l'ordre. */
  readonly pendingSurcoinche: readonly Seat[];
}

export interface PlayedCard {
  readonly seat: Seat;
  readonly card: Card;
}

export interface Trick {
  readonly leader: Seat;
  readonly cards: readonly PlayedCard[];
}

export interface CompletedTrick extends Trick {
  readonly winner: Seat;
}

export interface FinalContract extends Contract {
  readonly multiplier: number;
  readonly coinchedBy: Seat | null;
  readonly surcoinchedBy: Seat | null;
}

export type BeloteEvent = { readonly seat: Seat; readonly announce: 'belote' | 'rebelote' };

/**
 * Comment la manche s'est terminée.
 * - 'claim' : un joueur a étalé ses cartes (« تي إفرش عاد ») : elles sont toutes maîtresses,
 *   son équipe remporte les plis restants. Ses cartes sont montrées à tous (GameState.revealed).
 * - 'capotFailed' : la défense a gagné un pli contre un capot annoncé (« يروووووووح ») ;
 *   la manche s'arrête aussitôt.
 */
export type HandEnding =
  | { readonly type: 'normal' }
  | { readonly type: 'claim'; readonly seat: Seat }
  | { readonly type: 'capotFailed'; readonly seat: Seat };

export interface HandResult {
  readonly contract: FinalContract;
  readonly takerTeam: Team;
  /** Points des cartes + dix de der, par équipe (total 162). */
  readonly trickPoints: readonly [number, number];
  readonly tricksWon: readonly [number, number];
  /** Points de belote marqués par chaque équipe (jamais multipliés). */
  readonly belotePoints: readonly [number, number];
  /** Points retenus pour juger le contrat (plis, plus belote si la règle le prévoit). */
  readonly contractPoints: readonly [number, number];
  readonly success: boolean;
  readonly capot: 'annonce' | 'non-annonce' | null;
  /** Points ajoutés au score général pour cette manche. */
  readonly handScore: readonly [number, number];
  readonly ending: HandEnding;
}

export type Phase = 'bidding' | 'playing' | 'handOver' | 'gameOver';

export interface GameState {
  readonly config: RulesConfig;
  readonly seed: string;
  readonly handNumber: number;
  /** Nombre de donnes annulées (tout le monde a passé) depuis le début. */
  readonly redeals: number;
  readonly dealer: Seat;
  readonly dealPattern: DealPattern;
  readonly phase: Phase;
  readonly currentPlayer: Seat | null;
  readonly hands: readonly (readonly Card[])[];
  readonly bidding: BiddingState;
  readonly contract: FinalContract | null;
  readonly beloteHolder: Seat | null;
  readonly beloteEvents: readonly BeloteEvent[];
  /** Cartes étalées par un joueur (« تي إفرش عاد »), visibles par tous jusqu'à la donne suivante. */
  readonly revealed: { readonly seat: Seat; readonly cards: readonly Card[] } | null;
  readonly trick: Trick | null;
  readonly completedTricks: readonly CompletedTrick[];
  readonly scores: readonly [number, number];
  readonly lastHandResult: HandResult | null;
  readonly handHistory: readonly HandResult[];
  readonly winner: Team | null;
}

export type GameAction =
  | { readonly type: 'bid'; readonly bid: BidAction }
  | { readonly type: 'play'; readonly cardId: string }
  /** « تي إفرش عاد » : étaler ses cartes quand elles sont toutes maîtresses. */
  | { readonly type: 'claim' };

export type Validation = { readonly ok: true } | { readonly ok: false; readonly error: string };

export type ActionResult =
  | { readonly ok: true; readonly state: GameState }
  | { readonly ok: false; readonly error: string };
