import { useMemo, useState } from 'react';
import { SUITS, SUIT_LABELS } from '../engine/index.ts';
import type { BidAction, Suit } from '../engine/index.ts';
import { SUIT_SYMBOLS, contractValueLabel, isRed } from './labels.ts';

type Bid = Extract<BidAction, { type: 'bid' }>;

interface BiddingPanelProps {
  readonly legal: readonly BidAction[];
  readonly onBid: (action: BidAction) => void;
}

export function BiddingPanel({ legal, onBid }: BiddingPanelProps) {
  const bids = useMemo(() => legal.filter((a): a is Bid => a.type === 'bid'), [legal]);
  const values = useMemo(() => [...new Set(bids.map((b) => b.value))], [bids]);
  const canCoinche = legal.some((a) => a.type === 'coinche');
  const canSurcoinche = legal.some((a) => a.type === 'surcoinche');

  // Le panneau est recréé à chaque nouveau tour de parole : on repart de la plus petite enchère.
  const [suit, setSuit] = useState<Suit | null>(null);
  const [value, setValue] = useState<Bid['value'] | null>(values[0] ?? null);

  const selected = bids.find((b) => b.suit === suit && b.value === value) ?? null;
  const suitAllowed = (s: Suit) => bids.some((b) => b.suit === s && (value === null || b.value === value));

  return (
    <section className="bidding" aria-label="Vos enchères">
      {bids.length > 0 && (
        <>
          <div className="bidding__values" role="group" aria-label="Valeur du contrat">
            {values.map((v) => (
              <button
                key={String(v)}
                type="button"
                className={`chip${value === v ? ' chip--selected' : ''}${v === 'capot' ? ' chip--capot' : ''}`}
                aria-pressed={value === v}
                onClick={() => setValue(v)}
              >
                {contractValueLabel(v)}
              </button>
            ))}
          </div>
          <div className="bidding__suits" role="group" aria-label="Couleur d'atout">
            {SUITS.map((s) => (
              <button
                key={s}
                type="button"
                className={`suit-btn${isRed(s) ? ' suit-btn--red' : ''}${suit === s ? ' suit-btn--selected' : ''}`}
                aria-pressed={suit === s}
                aria-label={SUIT_LABELS[s]}
                disabled={!suitAllowed(s)}
                onClick={() => setSuit(s)}
              >
                {SUIT_SYMBOLS[s]}
              </button>
            ))}
          </div>
        </>
      )}
      <div className="bidding__actions">
        <button type="button" className="btn btn--ghost" onClick={() => onBid({ type: 'pass' })}>
          Passer
        </button>
        {canCoinche && (
          <button type="button" className="btn btn--danger" onClick={() => onBid({ type: 'coinche' })}>
            Coinche
          </button>
        )}
        {canSurcoinche && (
          <button type="button" className="btn btn--danger" onClick={() => onBid({ type: 'surcoinche' })}>
            Surcoinche
          </button>
        )}
        {bids.length > 0 && (
          <button
            type="button"
            className="btn btn--primary"
            disabled={!selected}
            onClick={() => selected && onBid(selected)}
          >
            {selected
              ? `Annoncer ${contractValueLabel(selected.value)} ${SUIT_SYMBOLS[selected.suit]}`
              : 'Choisir une couleur'}
          </button>
        )}
      </div>
    </section>
  );
}
