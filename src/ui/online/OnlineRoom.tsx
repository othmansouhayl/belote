import { useCallback, useMemo, useState } from 'react';
import { SEATS } from '../../engine/index.ts';
import type { GameAction, Seat } from '../../engine/index.ts';
import type { RoomRequest } from '../../server/types.ts';
import { GameTable } from '../GameTable.tsx';
import type { SeatNames } from '../labels.ts';
import { useTableEffects } from '../useTableEffects.ts';
import { Lobby } from './Lobby.tsx';
import { sendRequest } from './client.ts';
import { useAbsentSeats, useRoom } from './useRoom.ts';
import { VoiceBar } from './voice/VoiceBar.tsx';
import { useVoice } from './voice/useVoice.ts';

interface OnlineRoomProps {
  readonly roomId: string;
  /** Retour à l'accueil ; `forget` efface le salon mémorisé. */
  readonly onExit: (forget: boolean) => void;
}

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

export function OnlineRoom({ roomId, onExit }: OnlineRoomProps) {
  const { view, connection, presentSeats, removed, error, sendVoice, onVoice } = useRoom(roomId);
  const [busy, setBusy] = useState(false);

  const names = useMemo<SeatNames>(() => {
    const map = { 0: 'Place 1', 1: 'Place 2', 2: 'Place 3', 3: 'Place 4' } as Record<Seat, string>;
    for (const p of view?.players ?? []) map[p.seat] = p.seat === view?.mySeat ? 'Vous' : p.nickname;
    return map;
  }, [view]);

  const effects = useTableEffects(view?.game ?? null, names);
  const { showNotice } = effects;
  const seatsInRoom = useMemo(() => view?.players.map((p) => p.seat) ?? [], [view]);
  const absentSeats = useAbsentSeats(
    seatsInRoom,
    presentSeats,
    view?.mySeat ?? null,
    view?.settings.absenceDelaySeconds ?? 30,
    connection === 'online',
  );

  const voice = useVoice({
    roomId,
    mySeat: view?.mySeat ?? null,
    online: connection === 'online',
    presentSeats,
    sendVoice,
    onVoice,
  });

  const send = useCallback(
    async (request: DistributiveOmit<RoomRequest, 'roomId'>) => {
      setBusy(true);
      const result = await sendRequest({ ...request, roomId } as RoomRequest);
      setBusy(false);
      if (!result.ok) showNotice(result.error);
      return result.ok;
    },
    [roomId, showNotice],
  );

  if (removed) {
    return (
      <Message
        title="Vous n'êtes plus dans ce salon"
        text="Le salon a peut-être été fermé ou vous l'avez quitté depuis un autre appareil."
        action="Retour à l'accueil"
        onAction={() => onExit(true)}
      />
    );
  }
  if (error) {
    return <Message title="Connexion impossible" text={error} action="Retour à l'accueil" onAction={() => onExit(false)} />;
  }
  if (!view) return <Message title="Connexion au salon…" text="Un instant." />;

  const banner = connection === 'offline' ? 'Connexion perdue : reconnexion en cours…' : null;

  if (view.status === 'lobby' || !view.game) {
    return (
      <>
        {banner && <div className="banner banner--fixed">{banner}</div>}
        <Lobby
          view={view}
          presentSeats={presentSeats}
          busy={busy}
          onSeat={(seat) => void send({ type: 'seat', seat })}
          onReady={(ready) => void send({ type: 'ready', ready })}
          onLeave={async () => {
            if (await send({ type: 'leave' })) onExit(true);
          }}
          onCopied={showNotice}
          voiceBar={<VoiceBar voice={voice} className="voice--lobby" />}
          speakingSeats={voice.snapshot.speaking}
          voiceMutedSeats={voice.snapshot.mutedSeats}
        />
        {effects.notice && (
          <div className="toast toast--fixed" role="status">
            {effects.notice}
          </div>
        )}
      </>
    );
  }

  const game = view.game;
  const acked = view.ackSeats.includes(view.mySeat);
  const waitingNames = acked ? SEATS.filter((s) => !view.ackSeats.includes(s)).map((s) => names[s]) : [];

  return (
    <GameTable
      view={game}
      names={names}
      effects={effects}
      busy={busy}
      absentSeats={absentSeats}
      banner={banner}
      voiceBar={<VoiceBar voice={voice} className="voice--table" />}
      speakingSeats={voice.snapshot.speaking}
      voiceMutedSeats={voice.snapshot.mutedSeats}
      onAction={(action: GameAction) => void send({ type: 'game', action })}
      cont={{
        label: game.phase === 'gameOver' ? 'Rejouer avec la même table' : 'Manche suivante',
        acked,
        waitingNames,
        onContinue: () => void send({ type: 'continue' }),
      }}
      menuLabel="Retour à l'accueil"
      onMenu={() => {
        if (window.confirm('Revenir à l’accueil ? Votre place est gardée : vous pourrez reprendre la partie.')) onExit(false);
      }}
    />
  );
}

function Message({ title, text, action, onAction }: { title: string; text: string; action?: string; onAction?: () => void }) {
  return (
    <div className="screen screen--center">
      <h1 className="screen__title">{title}</h1>
      <p className="screen__text">{text}</p>
      {action && onAction && (
        <button type="button" className="btn btn--primary" onClick={onAction}>
          {action}
        </button>
      )}
    </div>
  );
}
