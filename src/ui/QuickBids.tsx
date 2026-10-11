import { useState } from 'react';
import { SUITS, SUIT_LABELS } from '../engine/index.ts';
import type { BidAction, Suit } from '../engine/index.ts';
import { SUIT_SYMBOLS, isRed } from './labels.ts';

interface QuickBidsProps {
  /** Actions permises hors de son tour (calculées par le moteur). */
  readonly legal: readonly BidAction[];
  readonly onBid: (action: BidAction) => void;
}

/**
 * Contrée, surcontrée et كبوط sans attendre son tour : le premier qui appuie l'emporte.
 * Affiché pendant les enchères quand ce n'est pas au joueur de parler.
 */
export function QuickBids({ legal, onBid }: QuickBidsProps) {
  const [capotOpen, setCapotOpen] = useState(false);
  const canCoinche = legal.some((a) => a.type === 'coinche');
  const canSurcoinche = legal.some((a) => a.type === 'surcoinche');
  const canPass = legal.some((a) => a.type === 'pass');
  const capotSuits = legal.flatMap((a) => (a.type === 'bid' && a.value === 'capot' ? [a.suit] : []));
  if (!canCoinche && !canSurcoinche && !canPass && capotSuits.length === 0) return null;

  if (capotOpen) {
    return (
      <section className="quick-bids" aria-label="Annoncer كبوط">
        <p className="quick-bids__title">
          <span lang="ar">كبوط</span> : choisis l'atout
        </p>
        <div className="quick-bids__row">
          {SUITS.filter((s) => capotSuits.includes(s)).map((suit: Suit) => (
            <button
              key={suit}
              type="button"
              className={`suit-btn suit-btn--small${isRed(suit) ? ' suit-btn--red' : ''}`}
              aria-label={`كبوط ${SUIT_LABELS[suit]}`}
              onClick={() => {
                setCapotOpen(false);
                onBid({ type: 'bid', value: 'capot', suit });
              }}
            >
              {SUIT_SYMBOLS[suit]}
            </button>
          ))}
          <button type="button" className="btn btn--ghost" onClick={() => setCapotOpen(false)}>
            Annuler
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="quick-bids" aria-label="Sans attendre son tour">
      <p className="quick-bids__title">{canPass ? 'Ton équipe a été contrée' : 'Sans attendre ton tour'}</p>
      <div className="quick-bids__row">
        {canCoinche && (
          <button type="button" className="btn btn--danger" onClick={() => onBid({ type: 'coinche' })}>
            Contrée
          </button>
        )}
        {canSurcoinche && (
          <button type="button" className="btn btn--danger" onClick={() => onBid({ type: 'surcoinche' })}>
            Surcontrée
          </button>
        )}
        {canPass && (
          <button type="button" className="btn btn--ghost" onClick={() => onBid({ type: 'pass' })}>
            Passer
          </button>
        )}
        {capotSuits.length > 0 && (
          <button type="button" className="btn btn--capot" lang="ar" onClick={() => setCapotOpen(true)}>
            كبوط
          </button>
        )}
      </div>
    </section>
  );
}
