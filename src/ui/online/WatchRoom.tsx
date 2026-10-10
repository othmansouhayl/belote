import { useMemo } from 'react';
import type { Seat } from '../../engine/index.ts';
import { GameTable } from '../GameTable.tsx';
import type { SeatNames } from '../labels.ts';
import { useTableEffects } from '../useTableEffects.ts';
import { useWatch } from './cafeData.ts';

interface WatchRoomProps {
  readonly roomId: string;
  readonly tableNumber: number;
  readonly onExit: () => void;
}

const NO_OP = () => undefined;

/** Regarder une partie du café en spectateur : uniquement les cartes posées sur la table. */
export function WatchRoom({ roomId, tableNumber, onExit }: WatchRoomProps) {
  const { view, gone } = useWatch(roomId);

  const names = useMemo<SeatNames>(() => {
    const map = { 0: 'Place 1', 1: 'Place 2', 2: 'Place 3', 3: 'Place 4' } as Record<Seat, string>;
    for (const p of view?.players ?? []) map[p.seat] = p.nickname;
    return map;
  }, [view]);

  const effects = useTableEffects(view?.game ?? null, names, true);

  if (gone && !view) {
    return (
      <Message title={`Table ${tableNumber}`} text="Cette partie est terminée ou la table s'est libérée." onBack={onExit} />
    );
  }
  if (!view) return <Message title={`Table ${tableNumber}`} text="On s'approche de la table…" onBack={onExit} />;
  if (!view.game) {
    const players = view.players.map((p) => p.nickname).join(', ');
    return (
      <Message
        title={`Table ${tableNumber}`}
        text={`Les joueurs s'installent (${view.players.length}/4${players ? ` : ${players}` : ''}). La partie n'a pas encore commencé.`}
        onBack={onExit}
      />
    );
  }

  return (
    <GameTable
      view={view.game}
      names={names}
      effects={effects}
      spectator
      banner={`Vous regardez la table ${tableNumber}`}
      onAction={NO_OP}
      cont={{ label: '', acked: true, waitingNames: [], onContinue: NO_OP }}
      onHome={onExit}
      menuLabel="Quitter la table"
      onMenu={onExit}
    />
  );
}

function Message({ title, text, onBack }: { title: string; text: string; onBack: () => void }) {
  return (
    <div className="screen screen--center">
      <h1 className="screen__title">{title}</h1>
      <p className="screen__text">{text}</p>
      <button type="button" className="btn btn--primary" onClick={onBack}>
        Retour au café
      </button>
    </div>
  );
}
