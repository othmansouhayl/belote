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

/** Durée de l'animation de distribution (8 cartes × 65 ms + 380 ms), avec une marge. */
const DEAL_ANIMATION_MS = 1100;

interface HandProps {
  /** Change à chaque nouvelle donne : les cartes sont alors distribuées en animation. */
  readonly dealKey: string;
  readonly cards: readonly Card[];
  readonly trump: Suit | null;
  /** Cartes jouables ; null quand ce n'est pas au joueur de jouer. */
  readonly playable: readonly Card[] | null;
  readonly onPlay: (card: Card) => void;
}

export function Hand({ dealKey, cards, trump, playable, onPlay }: HandProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const sorted = useMemo(() => sortHand(cards, trump), [cards, trump]);
  const playableIds = useMemo(() => new Set(playable?.map((c) => c.id) ?? []), [playable]);

  useEffect(() => {
    if (!playable) setSelected(null);
  }, [playable]);

  // L'animation de distribution ne joue qu'à la donne : quand l'atout est choisi, la main se retrie
  // et le navigateur rejouerait l'animation sur les cartes déplacées (cartes « en escalier »).
  const [dealing, setDealing] = useState<string | null>(dealKey);
  useEffect(() => {
    setDealing(dealKey);
    const timer = setTimeout(() => setDealing(null), DEAL_ANIMATION_MS);
    return () => clearTimeout(timer);
  }, [dealKey]);

  return (
    <div
      key={dealKey}
      className={`hand${dealing === dealKey ? ' hand--deal' : ''}`}
      style={{ ['--count' as string]: sorted.length }}
    >
      {sorted.map((card, index) => {
        const canPlay = playableIds.has(card.id);
        const isSelected = selected === card.id;
        const dimmed = playable !== null && !canPlay;
        return (
          <button
            key={card.id}
            type="button"
            className={`hand__slot${isSelected ? ' hand__slot--selected' : ''}${dimmed ? ' hand__slot--dimmed' : ''}${canPlay ? ' hand__slot--playable' : ''}`}
            disabled={!canPlay}
            style={{ ['--k' as string]: index }}
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
            <CardView card={card} trump={trump} />
          </button>
        );
      })}
    </div>
  );
}
