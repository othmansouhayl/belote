import type { Seat } from '../engine/index.ts';
import { PLAYER_NAMES, POSITIONS } from './labels.ts';

interface PlayerSeatProps {
  readonly seat: Seat;
  readonly isDealer: boolean;
  readonly isActive: boolean;
  readonly isTaker: boolean;
  readonly cardsLeft: number;
  readonly bubble: string | null;
  readonly highlightBubble: boolean;
}

export function PlayerSeat({ seat, isDealer, isActive, isTaker, cardsLeft, bubble, highlightBubble }: PlayerSeatProps) {
  const team = seat % 2 === 0 ? 'us' : 'them';
  return (
    <div className={`seat seat--${POSITIONS[seat]} seat--${team}${isActive ? ' seat--active' : ''}`}>
      <div className="seat__badge">
        <span className="seat__name">{PLAYER_NAMES[seat]}</span>
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
      {seat !== 0 && (
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
