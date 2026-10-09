import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CompletedTrick, PlayerView, Seat } from '../engine/index.ts';
import { SUIT_SYMBOLS, contractValueLabel } from './labels.ts';
import type { SeatNames } from './labels.ts';

const TRICK_PAUSE = 1300;
const NOTICE_DURATION = 2600;

export interface Bubble {
  readonly seat: Seat;
  readonly text: string;
}

export interface TableEffects {
  /** Pli qui vient d'être terminé, laissé visible un instant. */
  readonly pausedTrick: CompletedTrick | null;
  readonly notice: string | null;
  readonly beloteBubble: Bubble | null;
  readonly showNotice: (text: string) => void;
}

/** Déduit les animations et messages en comparant la vue précédente à la nouvelle. */
export function useTableEffects(view: PlayerView | null, names: SeatNames): TableEffects {
  const previous = useRef<PlayerView | null>(null);
  const [pausedTrick, setPausedTrick] = useState<CompletedTrick | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [beloteBubble, setBeloteBubble] = useState<Bubble | null>(null);

  useLayoutEffect(() => {
    const before = previous.current;
    previous.current = view;
    if (!view || !before) return;
    const sameHand = before.handNumber === view.handNumber && before.redeals === view.redeals;
    if (view.redeals > before.redeals) setNotice('Tout le monde a passé : nouvelle donne.');
    if (sameHand && view.tricksPlayed > before.tricksPlayed && view.lastTrick) setPausedTrick(view.lastTrick);
    if (sameHand && view.beloteEvents.length > before.beloteEvents.length) {
      const event = view.beloteEvents[view.beloteEvents.length - 1]!;
      setBeloteBubble({ seat: event.seat, text: event.announce === 'belote' ? 'Belote !' : 'Rebelote !' });
    }
    if (before.phase === 'bidding' && view.phase === 'playing' && view.contract) {
      const c = view.contract;
      const doubled = c.surcoinchedBy !== null ? ', surcoinché' : c.coinchedBy !== null ? ', coinché' : '';
      const who = c.bidder === view.seat ? 'Vous prenez' : `${names[c.bidder]} prend`;
      setNotice(`${who} à ${contractValueLabel(c.value)} ${SUIT_SYMBOLS[c.suit]}${doubled}`);
    }
  }, [view, names]);

  useEffect(() => {
    if (!pausedTrick) return;
    const timer = setTimeout(() => setPausedTrick(null), TRICK_PAUSE);
    return () => clearTimeout(timer);
  }, [pausedTrick]);

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

  return { pausedTrick, notice, beloteBubble, showNotice: setNotice };
}
