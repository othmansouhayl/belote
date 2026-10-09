import type { Seat } from '../engine/index.ts';
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

export function PlayerSeat(props: PlayerSeatProps) {
  const { seat, mySeat, name, isDealer, isActive, isTaker, isAbsent, cardsLeft, bubble, highlightBubble, speaking, voiceMuted } = props;
  const team = seat % 2 === mySeat % 2 ? 'us' : 'them';
  return (
    <div
      className={`seat seat--${positionOf(seat, mySeat)} seat--${team}${isActive ? ' seat--active' : ''}${isAbsent ? ' seat--absent' : ''}${speaking ? ' seat--speaking' : ''}`}
    >
      <div className="seat__badge">
        <span className="seat__name">{name}</span>
        {voiceMuted && (
          <span className="seat__mic-off" title="Micro coupé">
            <MicOffIcon size={14} />
          </span>
        )}
        {isDealer && (
          <span className="seat__chip" title="Donneur">
            D
          </span>
        )}
        {isTaker && (
          <span className="seat__chip seat__chip--taker" title="Preneur">
            P
          </span>
        )}
      </div>
      {isAbsent && <div className="seat__absent">Hors ligne</div>}
      {seat !== mySeat && (
        <div className="seat__backs" aria-label={`${cardsLeft} cartes`}>
          {Array.from({ length: cardsLeft }, (_, i) => (
            <span key={i} className="seat__back" />
          ))}
        </div>
      )}
      {bubble && <div className={`seat__bubble${highlightBubble ? ' seat__bubble--strong' : ''}`}>{bubble}</div>}
    </div>
  );
}
