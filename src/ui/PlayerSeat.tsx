import type { Seat } from '../engine/index.ts';
import { CARD_BACK_URL } from './CardView.tsx';
import { MicOffIcon } from './icons.tsx';
import { positionOf } from './labels.ts';

interface PlayerSeatProps {
  readonly seat: Seat;
  readonly mySeat: Seat;
  readonly name: string;
  readonly isDealer: boolean;
  readonly isActive: boolean;
  readonly isTaker: boolean;
  readonly isAbsent: boolean;
  readonly cardsLeft: number;
  readonly bubble: string | null;
  readonly highlightBubble: boolean;
  readonly speaking?: boolean;
  readonly voiceMuted?: boolean;
}

/** Initiale affichée dans l'avatar (« Vous » → V). */
const initial = (name: string) => [...name.trim()][0]?.toUpperCase() ?? '?';

export function PlayerSeat(props: PlayerSeatProps) {
  const { seat, mySeat, name, isDealer, isActive, isTaker, isAbsent, cardsLeft, bubble, highlightBubble, speaking, voiceMuted } = props;
  const team = seat % 2 === mySeat % 2 ? 'us' : 'them';
  const position = positionOf(seat, mySeat);
  const classes = [
    'seat',
    `seat--${position}`,
    `seat--${team}`,
    isActive && 'seat--active',
    isAbsent && 'seat--absent',
    speaking && 'seat--speaking',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes}>
      <div className="seat__player">
        <div className="seat__avatar" aria-hidden="true">
          {initial(name)}
          {isDealer && (
            <span className="seat__token seat__token--dealer" title="Donneur">
              D
            </span>
          )}
          {isTaker && (
            <span className="seat__token seat__token--taker" title="Preneur">
              P
            </span>
          )}
        </div>
        <div className="seat__badge">
          <span className="seat__name">{name}</span>
          {voiceMuted && (
            <span className="seat__mic-off" title="Micro coupé">
              <MicOffIcon size={14} />
            </span>
          )}
        </div>
        <span className="visually-hidden">
          {isDealer ? ', donneur' : ''}
          {isTaker ? ', preneur' : ''}
        </span>
      </div>
      {isAbsent && <div className="seat__absent">Hors ligne</div>}
      {seat !== mySeat && cardsLeft > 0 && (
        <div className="seat__backs" aria-label={`${cardsLeft} cartes`} style={{ ['--n' as string]: cardsLeft }}>
          {Array.from({ length: cardsLeft }, (_, i) => (
            <img
              key={i}
              className="seat__back"
              src={CARD_BACK_URL}
              alt=""
              draggable={false}
              style={{ ['--i' as string]: i }}
            />
          ))}
        </div>
      )}
      {bubble && <div className={`seat__bubble${highlightBubble ? ' seat__bubble--strong' : ''}`}>{bubble}</div>}
    </div>
  );
}
