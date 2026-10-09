import type { Card, Suit } from '../engine/index.ts';
import { cardLabel } from '../engine/index.ts';

const BASE = import.meta.env.BASE_URL;

export const cardImageUrl = (cardId: string) => `${BASE}cartes/${cardId}.webp`;
export const CARD_BACK_URL = `${BASE}cartes/dos.webp`;

interface CardViewProps {
  readonly card: Card;
  readonly size?: 'hand' | 'trick';
  /** Couleur d'atout : les cartes d'atout sont mises en valeur. */
  readonly trump?: Suit | null;
  readonly className?: string;
}

export function CardView({ card, size = 'hand', trump = null, className = '' }: CardViewProps) {
  const isTrump = trump !== null && card.suit === trump;
  return (
    <span className={`card card--${size}${isTrump ? ' card--trump' : ''} ${className}`}>
      <img
        className="card__img"
        src={cardImageUrl(card.id)}
        alt={isTrump ? `${cardLabel(card)} (atout)` : cardLabel(card)}
        draggable={false}
        decoding="async"
      />
      {isTrump && (
        <span className="card__trump" aria-hidden="true">
          ★
        </span>
      )}
    </span>
  );
}

let preloaded = false;

/** Charge toutes les cartes à l'avance pour qu'aucune n'apparaisse en retard pendant le jeu. */
export function preloadCards(ids: readonly string[]) {
  if (preloaded) return;
  preloaded = true;
  for (const id of [...ids, 'dos']) {
    const img = new Image();
    img.decoding = 'async';
    img.src = cardImageUrl(id);
  }
}
