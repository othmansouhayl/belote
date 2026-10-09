import type { BidAction, BiddingState, Seat, Validation } from './types.ts';
import type { RulesConfig } from './rulesConfig.ts';
import { SUITS, SUIT_LABELS } from './deck.ts';
import { nextSeat, partnerOf, teamOf } from './seats.ts';

export function createBiddingState(): BiddingState {
  return {
    history: [],
    contract: null,
    coinchedBy: null,
    surcoinchedBy: null,
    hasPassed: [false, false, false, false],
    consecutivePasses: 0,
    pendingSurcoinche: [],
  };
}

/** Rang d'une enchère : le capot est au-dessus de toutes les enchères chiffrées. */
function bidRank(value: number | 'capot'): number {
  return value === 'capot' ? Number.POSITIVE_INFINITY : value;
}

export function bidValues(config: RulesConfig): number[] {
  const values: number[] = [];
  for (let v = config.minimumBid; v <= config.maximumBid; v += config.bidStep) values.push(v);
  return values;
}

export function bidLabel(action: BidAction): string {
  switch (action.type) {
    case 'pass':
      return 'Passe';
    case 'coinche':
      return 'Coinche';
    case 'surcoinche':
      return 'Surcoinche';
    case 'bid':
      return `${action.value === 'capot' ? 'Capot' : action.value} ${SUIT_LABELS[action.suit]}`;
  }
}

/** Valide une action d'enchère, en supposant que c'est bien au tour de `seat`. */
export function validateBid(bidding: BiddingState, seat: Seat, action: BidAction, config: RulesConfig): Validation {
  const contract = bidding.contract;

  if (bidding.coinchedBy !== null) {
    if (action.type === 'pass') return { ok: true };
    if (action.type === 'surcoinche') return validateSurcoinche(bidding, seat, config);
    return { ok: false, error: 'Après une coinche, seule la surcoinche ou la passe est possible.' };
  }

  switch (action.type) {
    case 'pass':
      return { ok: true };
    case 'coinche':
      return validateCoinche(bidding, seat, config);
    case 'surcoinche':
      return { ok: false, error: "Il n'y a pas de coinche à surcoincher." };
    case 'bid': {
      if (bidding.hasPassed[seat] && !config.allowRebidAfterPass) {
        return { ok: false, error: 'Vous avez déjà passé : vous ne pouvez plus enchérir dans cette donne.' };
      }
      if (!SUITS.includes(action.suit)) {
        return { ok: false, error: "Couleur d'atout inconnue." };
      }
      if (action.value === 'capot') {
        if (!config.allowCapot) return { ok: false, error: "Le capot n'est pas autorisé à cette table." };
      } else if (
        !Number.isInteger(action.value) ||
        action.value < config.minimumBid ||
        action.value > config.maximumBid ||
        (action.value - config.minimumBid) % config.bidStep !== 0
      ) {
        return {
          ok: false,
          error: `Les enchères vont de ${config.minimumBid} à ${config.maximumBid} par paliers de ${config.bidStep}.`,
        };
      }
      if (contract && bidRank(action.value) <= bidRank(contract.value)) {
        return { ok: false, error: "L'enchère doit être supérieure au meilleur contrat actuel." };
      }
      if (
        contract &&
        !config.allowOverbidSameSuit &&
        contract.bidder === partnerOf(seat) &&
        contract.suit === action.suit
      ) {
        return { ok: false, error: 'Vous ne pouvez pas surenchérir dans la couleur de votre partenaire.' };
      }
      return { ok: true };
    }
  }
}

export function validateCoinche(bidding: BiddingState, seat: Seat, config: RulesConfig): Validation {
  if (!config.allowCoinche) return { ok: false, error: "La coinche n'est pas autorisée à cette table." };
  if (!bidding.contract) return { ok: false, error: "Il n'y a aucun contrat à coincher." };
  if (bidding.coinchedBy !== null) return { ok: false, error: 'Le contrat est déjà coinché.' };
  if (teamOf(bidding.contract.bidder) === teamOf(seat)) {
    return { ok: false, error: 'Seule la défense peut coincher le contrat.' };
  }
  return { ok: true };
}

function validateSurcoinche(bidding: BiddingState, seat: Seat, config: RulesConfig): Validation {
  if (!config.allowSurcoinche) return { ok: false, error: "La surcoinche n'est pas autorisée à cette table." };
  if (bidding.surcoinchedBy !== null) return { ok: false, error: 'Le contrat est déjà surcoinché.' };
  if (!bidding.contract || teamOf(bidding.contract.bidder) !== teamOf(seat)) {
    return { ok: false, error: "Seule l'équipe preneuse peut surcoincher." };
  }
  return { ok: true };
}

/** Toutes les actions d'enchère permises pour `seat`, en supposant que c'est son tour. */
export function getLegalBids(bidding: BiddingState, seat: Seat, config: RulesConfig): BidAction[] {
  const candidates: BidAction[] = [{ type: 'pass' }];
  const values: (number | 'capot')[] = [...bidValues(config), 'capot'];
  for (const value of values) {
    for (const suit of SUITS) candidates.push({ type: 'bid', value, suit });
  }
  candidates.push({ type: 'coinche' }, { type: 'surcoinche' });
  return candidates.filter((action) => validateBid(bidding, seat, action, config).ok);
}

export type BiddingStep =
  | { readonly status: 'continue'; readonly bidding: BiddingState; readonly nextPlayer: Seat }
  | { readonly status: 'done'; readonly bidding: BiddingState }
  | { readonly status: 'allPassed'; readonly bidding: BiddingState };

/** Applique une action déjà validée et indique la suite des enchères. */
export function applyBid(bidding: BiddingState, seat: Seat, action: BidAction, config: RulesConfig): BiddingStep {
  const dir = config.playDirection;
  const base = { ...bidding, history: [...bidding.history, { seat, action }] };

  if (bidding.coinchedBy !== null) {
    if (action.type === 'surcoinche') {
      return { status: 'done', bidding: { ...base, surcoinchedBy: seat, pendingSurcoinche: [] } };
    }
    const remaining = bidding.pendingSurcoinche.filter((s) => s !== seat);
    const next = remaining[0];
    const updated = { ...base, pendingSurcoinche: remaining };
    return next === undefined
      ? { status: 'done', bidding: updated }
      : { status: 'continue', bidding: updated, nextPlayer: next };
  }

  switch (action.type) {
    case 'pass': {
      const hasPassed = bidding.hasPassed.map((p, i) => p || i === seat);
      const consecutivePasses = bidding.consecutivePasses + 1;
      const updated = { ...base, hasPassed, consecutivePasses };
      if (bidding.contract && consecutivePasses >= 3) return { status: 'done', bidding: updated };
      if (!bidding.contract && consecutivePasses >= 4) return { status: 'allPassed', bidding: updated };
      return { status: 'continue', bidding: updated, nextPlayer: nextSeat(seat, dir) };
    }
    case 'bid':
      return {
        status: 'continue',
        bidding: { ...base, contract: { value: action.value, suit: action.suit, bidder: seat }, consecutivePasses: 0 },
        nextPlayer: nextSeat(seat, dir),
      };
    case 'coinche': {
      if (!config.allowSurcoinche) return { status: 'done', bidding: { ...base, coinchedBy: seat } };
      // Les deux joueurs de l'équipe preneuse, dans l'ordre de jeu, peuvent surcoincher.
      const first = nextSeat(seat, dir);
      const pendingSurcoinche: Seat[] = [first, partnerOf(first)];
      return {
        status: 'continue',
        bidding: { ...base, coinchedBy: seat, pendingSurcoinche },
        nextPlayer: first,
      };
    }
    case 'surcoinche':
      throw new Error('Surcoinche impossible sans coinche.');
  }
}
