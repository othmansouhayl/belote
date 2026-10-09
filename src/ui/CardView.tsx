import type { Card } from '../engine/index.ts';
import { SUIT_SYMBOLS, isRed } from './labels.ts';
import { cardLabel } from '../engine/index.ts';

interface CardViewProps {
  readonly card: Card;
  readonly size?: 'hand' | 'trick';
  readonly className?: string;
}

export function CardView({ card, size = 'hand', className = '' }: CardViewProps) {
  const symbol = SUIT_SYMBOLS[card.suit];
  return (
    <span
      className={`card card--${size} ${isRed(card.suit) ? 'card--red' : 'card--black'} ${className}`}
      role="img"
      aria-label={cardLabel(card)}
    >
      <span className="card__corner">
        <span className="card__rank">{card.rank}</span>
        <span className="card__suit">{symbol}</span>
      </span>
      <span className="card__center">{symbol}</span>
    </span>
  );
}
