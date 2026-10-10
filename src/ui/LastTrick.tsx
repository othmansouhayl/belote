import { useState } from 'react';
import type { CompletedTrick, Seat, Suit } from '../engine/index.ts';
import { CardView } from './CardView.tsx';
import { positionOf } from './labels.ts';
import type { SeatNames } from './labels.ts';

interface LastTrickProps {
  readonly trick: CompletedTrick;
  readonly mySeat: Seat;
  readonly names: SeatNames;
  readonly trump: Suit | null;
}

/** Miniature du dernier pli joué, en haut à droite ; un appui l'agrandit. */
export function LastTrick({ trick, mySeat, names, trump }: LastTrickProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="last-trick" onClick={() => setOpen(true)} aria-label="Voir le dernier pli">
        <span className="last-trick__label">Dernier pli</span>
        <span className="last-trick__cards">
          {trick.cards.map(({ seat, card }) => (
            <span key={card.id} className={`last-trick__card last-trick__card--${positionOf(seat, mySeat)}`}>
              <CardView card={card} size="trick" trump={trump} />
            </span>
          ))}
        </span>
      </button>
      {open && (
        <div className="overlay" role="dialog" aria-modal="true" aria-label="Dernier pli" onClick={() => setOpen(false)}>
          <div className="dialog last-trick-dialog">
            <h2 className="dialog__title">Dernier pli</h2>
            <div className="last-trick-dialog__table">
              {trick.cards.map(({ seat, card }) => (
                <figure
                  key={card.id}
                  className={`last-trick-dialog__slot last-trick-dialog__slot--${positionOf(seat, mySeat)}${seat === trick.winner ? ' last-trick-dialog__slot--winner' : ''}`}
                >
                  <CardView card={card} size="trick" trump={trump} />
                  <figcaption>{seat === mySeat ? 'Vous' : names[seat]}</figcaption>
                </figure>
              ))}
            </div>
            <p className="dialog__note">
              {trick.winner === mySeat ? 'Vous avez remporté ce pli.' : `${names[trick.winner]} a remporté ce pli.`}
            </p>
            <button type="button" className="btn btn--primary btn--wide" onClick={() => setOpen(false)} autoFocus>
              Fermer
            </button>
          </div>
        </div>
      )}
    </>
  );
}
