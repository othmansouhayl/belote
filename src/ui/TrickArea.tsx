import type { PlayedCard, Seat } from '../engine/index.ts';
import { CardView } from './CardView.tsx';
import { positionOf } from './labels.ts';

interface TrickAreaProps {
  readonly cards: readonly PlayedCard[];
  readonly winner: Seat | null;
  readonly mySeat: Seat;
}

export function TrickArea({ cards, winner, mySeat }: TrickAreaProps) {
  return (
    <div className="trick" aria-label="Pli en cours">
      {cards.map(({ seat, card }, index) => (
        <div
          key={card.id}
          className={`trick__slot trick__slot--${positionOf(seat, mySeat)}${winner === seat ? ' trick__slot--winner' : ''}`}
          style={{ zIndex: index + 1 }}
        >
          <CardView card={card} size="trick" />
        </div>
      ))}
    </div>
  );
}
