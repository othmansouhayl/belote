import { useEffect, useRef, useState } from 'react';
import type { Seat } from '../../engine/index.ts';
import { DRINKS } from '../../server/types.ts';
import type { Drink, RoomView } from '../../server/types.ts';
import type { SeatNames } from '../labels.ts';
import { DRINK_LABELS } from './drinks.ts';

interface OrderPanelProps {
  readonly view: RoomView;
  readonly names: SeatNames;
  readonly onChoose: (drink: Drink) => void;
  /** Échéance passée : on demande à Naceur de choisir pour les retardataires. */
  readonly onTimeout: () => void;
}

/** La commande de Mohamed Naceur : chacun choisit sa boisson ; tout le monde voit le papier. */
export function OrderPanel({ view, names, onChoose, onTimeout }: OrderPanelProps) {
  const order = view.order!;
  const mine = order.chosen[view.mySeat];
  const [now, setNow] = useState(() => Date.now());
  const asked = useRef(false);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, []);
  const left = Math.max(0, Math.ceil((order.deadline - now) / 1000));
  useEffect(() => {
    if (left > 0 || asked.current) return;
    asked.current = true;
    onTimeout();
  }, [left, onTimeout]);

  return (
    <div className="order">
      <p className="order__title">
        <span lang="ar" dir="rtl">
          « شنو بش تشربو هاي فيسع »
        </span>
        <span className="order__hint">{mine ? 'On attend les autres…' : `Choisis ta boisson (${left} s)`}</span>
      </p>
      <div className="order__drinks" role="group" aria-label="Boissons">
        {DRINKS.map((drink) => (
          <button
            key={drink}
            type="button"
            className={`order__drink${mine === drink ? ' order__drink--chosen' : ''}`}
            aria-pressed={mine === drink}
            onClick={() => onChoose(drink)}
          >
            {DRINK_LABELS[drink]}
          </button>
        ))}
      </div>
      <ul className="order__paper" aria-label="La commande">
        {view.players.map((p) => (
          <li key={p.seat}>
            <span>{names[p.seat as Seat]}</span>
            <span className="order__pen">{order.chosen[p.seat as Seat] ? DRINK_LABELS[order.chosen[p.seat as Seat]!] : '…'}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
