import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Card, CompletedTrick, PlayerView, Seat } from '../engine/index.ts';
import { SUIT_SYMBOLS, contractValueLabel } from './labels.ts';
import { playSound } from './sound.ts';
import type { SeatNames } from './labels.ts';

const TRICK_PAUSE = 1300;
const NOTICE_DURATION = 2600;
const FINALE_DURATION = 2600;

export interface Bubble {
  readonly seat: Seat;
  readonly text: string;
}

/** Fin de manche anticipée, affichée au milieu de la table avant le résultat. */
export type Finale =
  | { readonly kind: 'claim'; readonly seat: Seat; readonly cards: readonly Card[] }
  | { readonly kind: 'capotFailed'; readonly seat: Seat };

export interface TableEffects {
  /** Pli qui vient d'être terminé, laissé visible un instant. */
  readonly pausedTrick: CompletedTrick | null;
  readonly notice: string | null;
  readonly beloteBubble: Bubble | null;
  /** « تي إفرش عاد » ou « يروووووووح » : le résultat de la manche attend la fin de l'animation. */
  readonly finale: Finale | null;
  readonly showNotice: (text: string) => void;
}

/** Déduit les animations et messages en comparant la vue précédente à la nouvelle. */
export function useTableEffects(view: PlayerView | null, names: SeatNames, spectator = false): TableEffects {
  const previous = useRef<PlayerView | null>(null);
  const [pausedTrick, setPausedTrick] = useState<CompletedTrick | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [beloteBubble, setBeloteBubble] = useState<Bubble | null>(null);
  const [finale, setFinale] = useState<Finale | null>(null);

  useLayoutEffect(() => {
    const before = previous.current;
    previous.current = view;
    if (!view) return;
    if (!before) {
      if (view.phase === 'bidding') playSound('deal');
      return;
    }
    const sameHand = before.handNumber === view.handNumber && before.redeals === view.redeals;
    playTransitionSounds(before, view, sameHand, spectator);
    if (view.redeals > before.redeals) setNotice('Tout le monde a passé : nouvelle donne.');
    if (sameHand && view.tricksPlayed > before.tricksPlayed && view.lastTrick) setPausedTrick(view.lastTrick);
    if (sameHand && view.beloteEvents.length > before.beloteEvents.length) {
      const event = view.beloteEvents[view.beloteEvents.length - 1]!;
      setBeloteBubble({ seat: event.seat, text: event.announce === 'belote' ? 'Belote !' : 'Rebelote !' });
    }
    const ending = view.lastHandResult?.ending;
    if (sameHand && before.phase === 'playing' && view.phase !== 'playing' && ending) {
      if (ending.type === 'claim' && view.revealed) {
        setFinale({ kind: 'claim', seat: ending.seat, cards: view.revealed.cards });
        playSound('belote');
      } else if (ending.type === 'capotFailed') {
        setFinale({ kind: 'capotFailed', seat: ending.seat });
        playSound('coinche', 0.9);
      }
    }
    if (!sameHand) setFinale(null);
    if (before.phase === 'bidding' && view.phase === 'playing' && view.contract) {
      const c = view.contract;
      const doubled = c.surcoinchedBy !== null ? ', surcoinché' : c.coinchedBy !== null ? ', coinché' : '';
      const who = c.bidder === view.seat && !spectator ? 'Vous prenez' : `${names[c.bidder]} prend`;
      setNotice(`${who} à ${contractValueLabel(c.value)} ${SUIT_SYMBOLS[c.suit]}${doubled}`);
    }
  }, [view, names, spectator]);

  useEffect(() => {
    if (!pausedTrick) return;
    const timer = setTimeout(() => setPausedTrick(null), TRICK_PAUSE);
    return () => clearTimeout(timer);
  }, [pausedTrick]);

  useEffect(() => {
    // L'animation de fin commence une fois le dernier pli ramassé.
    if (!finale || pausedTrick) return;
    const timer = setTimeout(() => setFinale(null), FINALE_DURATION);
    return () => clearTimeout(timer);
  }, [finale, pausedTrick]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), NOTICE_DURATION);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!beloteBubble) return;
    const timer = setTimeout(() => setBeloteBubble(null), NOTICE_DURATION);
    return () => clearTimeout(timer);
  }, [beloteBubble]);

  return { pausedTrick, notice, beloteBubble, finale, showNotice: setNotice };
}

/** Sons déclenchés par ce qui vient de changer à la table. */
function playTransitionSounds(before: PlayerView, view: PlayerView, sameHand: boolean, spectator: boolean) {
  if (!sameHand && view.phase === 'bidding') {
    playSound('deal');
    return;
  }
  const newBids = view.bidding.history.slice(before.bidding.history.length);
  const last = newBids[newBids.length - 1]?.action;
  if (last?.type === 'coinche' || last?.type === 'surcoinche') playSound('coinche');
  else if (last?.type === 'bid') playSound('bid');

  const cardsBefore = before.tricksPlayed * 4 + (before.trick?.cards.length ?? 0);
  const cardsNow = view.tricksPlayed * 4 + (view.trick?.cards.length ?? 0);
  if (sameHand && cardsNow > cardsBefore) playSound('card');
  if (sameHand && view.tricksPlayed > before.tricksPlayed) playSound('trick', 0.85);
  if (sameHand && view.beloteEvents.length > before.beloteEvents.length) playSound('belote', 0.15);

  const myTurnNow = view.currentPlayer === view.seat && (view.phase === 'bidding' || view.phase === 'playing');
  const myTurnBefore = before.currentPlayer === before.seat && before.phase === view.phase;
  if (myTurnNow && !myTurnBefore && !spectator) playSound('turn', view.tricksPlayed > before.tricksPlayed ? 1.3 : 0.2);

  if (before.phase !== 'gameOver' && view.phase === 'gameOver' && view.winner !== null && !spectator) {
    playSound(view.winner === view.seat % 2 ? 'win' : 'lose', 1.3);
  }
}
