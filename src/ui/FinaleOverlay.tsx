import type { Seat, Suit } from '../engine/index.ts';
import { CardView } from './CardView.tsx';
import type { SeatNames } from './labels.ts';
import type { Finale } from './useTableEffects.ts';

interface FinaleOverlayProps {
  readonly finale: Finale;
  readonly mySeat: Seat;
  readonly names: SeatNames;
  readonly trump: Suit | null;
}

/** Fin de manche anticipée : cartes étalées (« تي إفرش عاد ») ou capot chuté (« يروووووووح »). */
export function FinaleOverlay({ finale, mySeat, names, trump }: FinaleOverlayProps) {
  if (finale.kind === 'claim') {
    const who = finale.seat === mySeat ? 'Vous étalez vos cartes' : `${names[finale.seat]} étale ses cartes`;
    return (
      <div className="finale finale--claim" role="status">
        <p className="finale__shout" lang="ar" dir="rtl">
          تي إفرش عاد
        </p>
        <p className="finale__caption">{who} : tous les plis restants sont pour son équipe.</p>
        <div className="finale__cards">
          {finale.cards.map((card, i) => (
            <span key={card.id} className="finale__card" style={{ ['--i' as string]: i }}>
              <CardView card={card} size="trick" trump={trump} />
            </span>
          ))}
        </div>
      </div>
    );
  }
  const who = finale.seat === mySeat ? 'Vous prenez' : `${names[finale.seat]} prend`;
  return (
    <div className="finale finale--capot" role="status">
      <p className="finale__shout finale__shout--laugh" lang="ar" dir="rtl">
        يروووووووح
      </p>
      <p className="finale__caption">Capot chuté ! {who} un pli, les cartes sont ramassées.</p>
    </div>
  );
}
