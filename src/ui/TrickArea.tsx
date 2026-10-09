import { useEffect, useState } from 'react';
import type { PlayedCard, Seat, Suit } from '../engine/index.ts';
import { CardView } from './CardView.tsx';
import { positionOf } from './labels.ts';

interface TrickAreaProps {
  readonly cards: readonly PlayedCard[];
  readonly winner: Seat | null;
  readonly mySeat: Seat;
  readonly trump: Suit | null;
}

const COLLECT_DELAY = 850;

export function TrickArea({ cards, winner, mySeat, trump }: TrickAreaProps) {
  // Après un court instant, les cartes du pli glissent vers le joueur qui l'a remporté.
  const [collecting, setCollecting] = useState(false);
  useEffect(() => {
    setCollecting(false);
    if (winner === null) return;
    const timer = setTimeout(() => setCollecting(true), COLLECT_DELAY);
    return () => clearTimeout(timer);
  }, [winner, cards]);

  const collectClass = collecting && winner !== null ? ` trick--to-${positionOf(winner, mySeat)}` : '';
  return (
    <div className={`trick${collectClass}`} aria-label="Pli en cours">
      {cards.map(({ seat, card }, index) => (
        <div
          key={card.id}
          className={`trick__slot trick__slot--${positionOf(seat, mySeat)}${winner === seat ? ' trick__slot--winner' : ''}`}
          style={{ zIndex: index + 1 }}
        >
          <CardView card={card} size="trick" trump={trump} />
        </div>
      ))}
    </div>
  );
}
