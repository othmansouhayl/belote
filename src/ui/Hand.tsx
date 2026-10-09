import { useEffect, useMemo, useState } from 'react';
import { cardLabel, cardStrength } from '../engine/index.ts';
import type { Card, Suit } from '../engine/index.ts';
import { CardView } from './CardView.tsx';

/** Couleurs alternées rouge / noir pour une lecture facile ; l'atout est placé en premier. */
const SUIT_ORDER: Suit[] = ['pique', 'coeur', 'trefle', 'carreau'];

function sortHand(hand: readonly Card[], trump: Suit | null): Card[] {
  const order = trump ? [trump, ...SUIT_ORDER.filter((s) => s !== trump)] : SUIT_ORDER;
  // Sans atout choisi, on trie selon l'ordre hors atout (une couleur d'atout différente de la carte).
  const strength = (c: Card) => cardStrength(c, trump ?? (c.suit === 'pique' ? 'coeur' : 'pique'));
  return [...hand].sort((a, b) => order.indexOf(a.suit) - order.indexOf(b.suit) || strength(b) - strength(a));
}

interface HandProps {
  readonly cards: readonly Card[];
  readonly trump: Suit | null;
  /** Cartes jouables ; null quand ce n'est pas au joueur de jouer. */
  readonly playable: readonly Card[] | null;
  readonly onPlay: (card: Card) => void;
}

export function Hand({ cards, trump, playable, onPlay }: HandProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const sorted = useMemo(() => sortHand(cards, trump), [cards, trump]);
  const playableIds = useMemo(() => new Set(playable?.map((c) => c.id) ?? []), [playable]);

  useEffect(() => {
    if (!playable) setSelected(null);
  }, [playable]);

  return (
    <div className="hand" style={{ ['--count' as string]: sorted.length }}>
      {sorted.map((card) => {
        const canPlay = playableIds.has(card.id);
        const isSelected = selected === card.id;
        const dimmed = playable !== null && !canPlay;
        return (
          <button
            key={card.id}
            type="button"
            className={`hand__slot${isSelected ? ' hand__slot--selected' : ''}${dimmed ? ' hand__slot--dimmed' : ''}${canPlay ? ' hand__slot--playable' : ''}`}
            disabled={!canPlay}
            aria-label={isSelected ? `Jouer ${cardLabel(card)}` : cardLabel(card)}
            onClick={() => {
              if (isSelected) {
                setSelected(null);
                onPlay(card);
              } else {
                setSelected(card.id);
              }
            }}
          >
            <CardView card={card} />
          </button>
        );
      })}
    </div>
  );
}
