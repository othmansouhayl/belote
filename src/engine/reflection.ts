import type { BiddingState, Phase, Seat } from './types.ts';

/**
 * Le chrono de réflexion aux enchères (règle [41]) : quand c'est son tour d'annoncer, annoncer ou
 * passer dans les `bidReflectionSeconds` est une annonce « directe » (bleue) ; au-delà, elle est
 * « réfléchie » (rouge). Fonctions pures, partagées par le serveur et l'interface.
 */

/** Marge laissée au réseau : le joueur voit son chrono un peu après le serveur. */
export const REFLECTION_NETWORK_MARGIN_MS = 1500;
/** Au-delà du chrono plus cette marge, l'annonce est réfléchie quoi qu'en dise le téléphone. */
export const REFLECTION_FORCED_AFTER_MS = 3000;

/** Identifie un tour d'enchère (donne, redistribution, nombre de paroles, joueur) ; null hors enchères. */
export function bidTurnKey(s: {
  readonly phase: Phase;
  readonly handNumber: number;
  readonly redeals: number;
  readonly currentPlayer: Seat | null;
  readonly bidding: BiddingState;
}): string | null {
  if (s.phase !== 'bidding' || s.currentPlayer === null) return null;
  return `${s.handNumber}:${s.redeals}:${s.bidding.history.length}:${s.currentPlayer}`;
}

/**
 * Le serveur tranche : le téléphone du joueur dit ce que montrait son chrono (`claimed`), le serveur
 * le vérifie avec le temps qu'il a lui-même mesuré (`elapsedMs`, inconnu pour un ancien salon).
 */
export function isThoughtBid(seconds: number, elapsedMs: number | undefined, claimed: boolean | undefined): boolean {
  if (!(seconds > 0)) return false;
  const limit = seconds * 1000;
  if (elapsedMs === undefined) return claimed === true;
  if (claimed === undefined) return elapsedMs > limit;
  return claimed ? elapsedMs >= limit - REFLECTION_NETWORK_MARGIN_MS : elapsedMs > limit + REFLECTION_FORCED_AFTER_MS;
}
