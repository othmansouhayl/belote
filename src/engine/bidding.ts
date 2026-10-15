import type { BidAction, BiddingState, Card, Seat, Suit, Validation } from './types.ts';
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
      return 'Contrée';
    case 'surcoinche':
      return 'Surcontrée';
    case 'bid':
      return `${action.value === 'capot' ? 'كبوط' : action.value} ${SUIT_LABELS[action.suit]}`;
  }
}

/**
 * Règle [39] : contrat minimum imposé par les atouts qu'on a dans la couleur annoncée, ou null si
 * aucun (pas de Valet + 9, ou rien d'autre avec). V + 9 + (D, 7, 8) → 90 ; V + 9 + (R, 10, As) → 100 ;
 * V + 9 + As + 10 (on ramasse tout l'atout) → 130, 120 ou 110 selon qu'on a 1, 2 ou 3 autres couleurs.
 */
export function trumpMinimumBid(hand: readonly Card[], suit: Suit): number | null {
  const ranks = new Set(hand.filter((c) => c.suit === suit).map((c) => c.rank));
  if (!ranks.has('V') || !ranks.has('9')) return null;
  if (ranks.has('A') && ranks.has('10')) {
    const otherSuits = new Set(hand.filter((c) => c.suit !== suit).map((c) => c.suit)).size;
    return otherSuits <= 1 ? 130 : otherSuits === 2 ? 120 : 110;
  }
  if (ranks.has('R') || ranks.has('10') || ranks.has('A')) return 100;
  if (ranks.has('D') || ranks.has('7') || ranks.has('8')) return 90;
  return null;
}

/** Le partenaire de `seat` a déjà annoncé cette couleur pendant ces enchères (on peut monter librement). */
function partnerAnnounced(bidding: BiddingState, seat: Seat, suit: Suit): boolean {
  return bidding.history.some(
    ({ seat: s, action }) => s === partnerOf(seat) && action.type === 'bid' && action.suit === suit,
  );
}

/**
 * « Couleur prise » (règle [37]) : le contrat en cours est un « 90 » ou un « 100 » de l'adversaire,
 * et on reprend sa couleur à 110 ou plus (كبوط compris).
 */
export function isStolenSuitBid(bidding: BiddingState, seat: Seat, action: BidAction, config: RulesConfig): boolean {
  const rule = config.stolenSuitWinsGame;
  const contract = bidding.contract;
  if (!rule || !contract || action.type !== 'bid' || bidding.coinchedBy !== null) return false;
  if (teamOf(contract.bidder) === teamOf(seat) || contract.value === 'capot') return false;
  return rule.opponentBids.includes(contract.value) && action.suit === contract.suit && bidRank(action.value) >= rule.minimum;
}

/**
 * Valide une action d'enchère, en supposant que c'est bien au tour de `seat`. Avec sa main
 * (`hand`), on vérifie aussi le minimum imposé par ses atouts (règle [39]).
 */
export function validateBid(
  bidding: BiddingState,
  seat: Seat,
  action: BidAction,
  config: RulesConfig,
  hand?: readonly Card[],
): Validation {
  const contract = bidding.contract;

  if (bidding.coinchedBy !== null) {
    if (action.type === 'pass') return { ok: true };
    if (action.type === 'surcoinche') return validateSurcoinche(bidding, seat, config);
    return { ok: false, error: 'Après une contrée, seule la surcontrée ou la passe est possible.' };
  }

  switch (action.type) {
    case 'pass':
      return { ok: true };
    case 'coinche':
      return validateCoinche(bidding, seat, config);
    case 'surcoinche':
      return { ok: false, error: "Il n'y a pas de contrée à surcontrer." };
    case 'bid': {
      if (bidding.hasPassed[seat] && !config.allowRebidAfterPass) {
        return { ok: false, error: 'Vous avez déjà passé : vous ne pouvez plus enchérir dans cette donne.' };
      }
      if (!SUITS.includes(action.suit)) {
        return { ok: false, error: "Couleur d'atout inconnue." };
      }
      if (action.value === 'capot') {
        if (!config.allowCapot) return { ok: false, error: "Le كبوط n'est pas autorisé à cette table." };
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
      if (hand && config.trumpBidMinimums && action.value !== 'capot' && !partnerAnnounced(bidding, seat, action.suit)) {
        const minimum = trumpMinimumBid(hand, action.suit);
        if (minimum !== null && action.value < minimum) {
          return {
            ok: false,
            error: `Pas de fausse annonce : avec vos atouts en ${SUIT_LABELS[action.suit]}, il faut annoncer au moins ${minimum}.`,
          };
        }
      }
      return { ok: true };
    }
  }
}

export function validateCoinche(bidding: BiddingState, seat: Seat, config: RulesConfig): Validation {
  if (!config.allowCoinche) return { ok: false, error: "La contrée n'est pas autorisée à cette table." };
  if (!bidding.contract) return { ok: false, error: "Il n'y a aucun contrat à contrer." };
  if (bidding.coinchedBy !== null) return { ok: false, error: 'Le contrat est déjà contré.' };
  if (teamOf(bidding.contract.bidder) === teamOf(seat)) {
    return { ok: false, error: 'Seule la défense peut contrer le contrat.' };
  }
  return { ok: true };
}

function validateSurcoinche(bidding: BiddingState, seat: Seat, config: RulesConfig): Validation {
  if (!config.allowSurcoinche) return { ok: false, error: "La surcontrée n'est pas autorisée à cette table." };
  if (bidding.surcoinchedBy !== null) return { ok: false, error: 'Le contrat est déjà surcontré.' };
  if (!bidding.contract || teamOf(bidding.contract.bidder) !== teamOf(seat)) {
    return { ok: false, error: "Seule l'équipe preneuse peut surcontrer." };
  }
  return { ok: true };
}

/** Toutes les actions d'enchère permises pour `seat` (avec sa main), en supposant que c'est son tour. */
export function getLegalBids(bidding: BiddingState, seat: Seat, config: RulesConfig, hand?: readonly Card[]): BidAction[] {
  const candidates: BidAction[] = [{ type: 'pass' }];
  const values: (number | 'capot')[] = [...bidValues(config), 'capot'];
  for (const value of values) {
    for (const suit of SUITS) candidates.push({ type: 'bid', value, suit });
  }
  candidates.push({ type: 'coinche' }, { type: 'surcoinche' });
  return candidates.filter((action) => validateBid(bidding, seat, action, config, hand).ok);
}

/**
 * Actions permises à un joueur dont ce n'est pas le tour : la contrée (défense), la surcontrée
 * ou la passe quand on attend sa réponse à une contrée, et le capot. Le premier qui appuie l'emporte.
 */
export function getOutOfTurnBids(bidding: BiddingState, seat: Seat, config: RulesConfig): BidAction[] {
  if (bidding.coinchedBy !== null) {
    if (!config.allowOutOfTurnCoinche || !bidding.pendingSurcoinche.includes(seat)) return [];
    const options: BidAction[] = [{ type: 'pass' }];
    if (validateBid(bidding, seat, { type: 'surcoinche' }, config).ok) options.push({ type: 'surcoinche' });
    return options;
  }
  const options: BidAction[] = [];
  if (config.allowOutOfTurnCoinche && validateCoinche(bidding, seat, config).ok) options.push({ type: 'coinche' });
  if (config.allowOutOfTurnCapot) {
    for (const suit of SUITS) {
      const capot: BidAction = { type: 'bid', value: 'capot', suit };
      if (validateBid(bidding, seat, capot, config).ok) options.push(capot);
    }
  }
  return options;
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
    case 'bid': {
      const contract = { value: action.value, suit: action.suit, bidder: seat };
      // « Couleur prise » : pas de retour en arrière, les enchères s'arrêtent net.
      if (isStolenSuitBid(bidding, seat, action, config)) {
        return { status: 'done', bidding: { ...base, contract, consecutivePasses: 0, winsGame: true } };
      }
      return {
        status: 'continue',
        bidding: { ...base, contract, consecutivePasses: 0 },
        nextPlayer: nextSeat(seat, dir),
      };
    }
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
