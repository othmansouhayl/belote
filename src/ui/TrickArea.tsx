import type { PlayedCard, Seat } from '../engine/index.ts';
import { CardView } from './CardView.tsx';
import { POSITIONS } from './labels.ts';

interface TrickAreaProps {
  readonly cards: readonly PlayedCard[];
  readonly winner: Seat | null;
}

export function TrickArea({ cards, winner }: TrickAreaProps) {
  return (
    <div className="trick" aria-label="Pli en cours">
      {cards.map(({ seat, card }, index) => (
        <div
          key={card.id}
          className={`trick__slot trick__slot--${POSITIONS[seat]}${winner === seat ? ' trick__slot--winner' : ''}${winner !== null ? ` trick__slot--to-${POSITIONS[winner]}` : ''}`}
          style={{ zIndex: index + 1 }}
        >
          <CardView card={card} size="trick" />
        </div>
      ))}
    </div>
  );
}
