import { useMemo } from 'react';
import type { Seat } from '../../engine/index.ts';
import { GameTable } from '../GameTable.tsx';
import type { SeatNames } from '../labels.ts';
import { useTableEffects } from '../useTableEffects.ts';
import { useWatch } from './cafeData.ts';
import { useListener } from './voice/useListener.ts';
import type { ListenerControls } from './voice/useListener.ts';

interface WatchRoomProps {
  readonly roomId: string;
  readonly tableNumber: number;
  /** Les joueurs le laissent écouter leur vocal (en écoute seule). */
  readonly listen: boolean;
  readonly onExit: () => void;
}

const NO_OP = () => undefined;

/** Bouton d'écoute du spectateur : il entend les joueurs, il ne parle jamais. */
function ListenBar({ listener }: { readonly listener: ListenerControls }) {
  const { snapshot, start, stop, resume } = listener;
  if (snapshot.status === 'off') {
    return (
      <div className="voice voice--table">
        <button type="button" className="voice__btn" onClick={start}>
          🎧 Écouter les joueurs
        </button>
      </div>
    );
  }
  return (
    <div className="voice voice--table">
      {snapshot.needsAudioUnlock ? (
        <button type="button" className="voice__btn" onClick={resume}>
          🔈 Toucher pour entendre
        </button>
      ) : (
        <span className="voice__status">
          {snapshot.status === 'starting'
            ? '🎧 Connexion…'
            : `🎧 ${snapshot.connected.size} joueur${snapshot.connected.size > 1 ? 's' : ''} au micro`}
        </span>
      )}
      <button type="button" className="voice__btn" onClick={stop} aria-label="Arrêter d'écouter">
        Arrêter
      </button>
    </div>
  );
}

/** Regarder une partie du café en spectateur : uniquement les cartes posées sur la table. */
export function WatchRoom({ roomId, tableNumber, listen, onExit }: WatchRoomProps) {
  const { view, gone } = useWatch(roomId);
  // Les joueurs peuvent changer d'avis entre-temps : on suit le réglage publié avec la partie.
  const canListen = listen && (view?.spectatorMode ?? 'listen') === 'listen';
  const listener = useListener(roomId, canListen);
  const others = view?.spectators ?? [];

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
      match={view.match}
      banner={`Vous regardez la table ${tableNumber}`}
      audience={others.length > 0 ? `👀 ${others.join(', ')}` : null}
      voiceBar={canListen ? <ListenBar listener={listener} /> : undefined}
      speakingSeats={listener.snapshot.speaking}
      voiceMutedSeats={listener.snapshot.mutedSeats}
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
