import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NEW_MATCH, SEATS, isMatchOver } from '../../engine/index.ts';
import type { GameAction, Seat } from '../../engine/index.ts';
import type { RoomRequest } from '../../server/types.ts';
import { GameTable } from '../GameTable.tsx';
import { GameMenu } from '../GameMenu.tsx';
import type { SeatNames } from '../labels.ts';
import { useTableEffects } from '../useTableEffects.ts';
import { Lobby } from './Lobby.tsx';
import { sendRequest } from './client.ts';
import { useAbsentSeats, useRoom } from './useRoom.ts';
import { VoiceBar } from './voice/VoiceBar.tsx';
import { SuitText } from '../SuitText.tsx';
import { useVoice } from './voice/useVoice.ts';
import { useListenChannel } from './voice/useListenChannel.ts';
import { audienceText } from './audience.ts';
import { voiceLinkOf } from './voice/voiceLink.ts';
import type { VoiceLinkState } from '../VoiceDot.tsx';
import { CafeCutscene } from './CafeCutscene.tsx';
import { OrderPanel } from './OrderPanel.tsx';
import { DRINK_LABELS, naderDrinkLine, servedDrinks } from './drinks.ts';
import type { Cutscene } from '../cafe/cafeScene.ts';
import type { Drink } from '../../server/types.ts';

interface OnlineRoomProps {
  readonly roomId: string;
  /** Retour à l'accueil ; `forget` efface le salon mémorisé. */
  readonly onExit: (forget: boolean) => void;
}

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

export function OnlineRoom({ roomId, onExit }: OnlineRoomProps) {
  const { view, connection, presentSeats, removed, error, sendVoice, onVoice } = useRoom(roomId);
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const names = useMemo<SeatNames>(() => {
    const map = {
      0: 'Place 1',
      1: 'Place 2',
      2: 'Place 3',
      3: 'Place 4',
    } as Record<Seat, string>;
    for (const p of view?.players ?? []) {
      map[p.seat] = p.seat === view?.mySeat ? 'Vous' : p.left ? `${p.nickname} (parti)` : p.nickname;
    }
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

  // Spectateurs autorisés à écouter : on ouvre le canal d'écoute pendant la partie.
  const spectatorMode = view?.settings.spectators ?? 'watch';
  const listenChannel = useListenChannel(roomId, spectatorMode === 'listen' && view?.status === 'playing');
  const voice = useVoice({
    roomId,
    mySeat: view?.mySeat ?? null,
    online: connection === 'online',
    presentSeats,
    sendVoice,
    onVoice,
    listenChannel: spectatorMode === 'listen' ? listenChannel : null,
  });
  const audience = audienceText(view?.spectators ?? [], spectatorMode, voice.listeners);

  const voiceLinks = useMemo(() => {
    const links = new Map<Seat, VoiceLinkState>();
    for (const seat of SEATS) {
      const link = voiceLinkOf(voice.snapshot, seat, view?.mySeat ?? null);
      if (link) links.set(seat, link);
    }
    return links;
  }, [voice.snapshot, view?.mySeat]);

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

  // Seuils du match : à 500 points, Nader apporte les boissons ; à 1000, il presse la table.
  const [scenes, setScenes] = useState<('drinks' | 'hung')[]>([]);
  const seenScenes = useRef(new Set<string>());
  useEffect(() => {
    const g = view?.game;
    const hand = g?.lastHandResult;
    if (!g || !hand || (g.phase !== 'handOver' && g.phase !== 'gameOver')) return;
    const before = [g.scores[0] - hand.handScore[0], g.scores[1] - hand.handScore[1]];
    const crossed = (t: number) => [0, 1].some((i) => before[i]! < t && g.scores[i]! >= t);
    const manche = (view.match?.games.length ?? 0) - (g.phase === 'gameOver' ? 1 : 0);
    const next: ('drinks' | 'hung')[] = [];
    if (crossed(500) && Object.keys(view.drinks ?? {}).length > 0) next.push('drinks');
    if (crossed(1000)) next.push('hung');
    const fresh = next.filter((kind) => !seenScenes.current.has(`${manche}:${kind}`));
    if (fresh.length === 0) return;
    for (const kind of fresh) seenScenes.current.add(`${manche}:${kind}`);
    setScenes((queue) => [...queue, ...fresh]);
  }, [view]);
  const [sceneArrived, setSceneArrived] = useState(false);
  const closeScene = useCallback(() => {
    setSceneArrived(false);
    setScenes((queue) => queue.slice(1));
  }, []);
  const onSceneArrive = useCallback(() => setSceneArrived(true), []);

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

  const tableNumber = view.tableNumber ?? 1;
  const tablePlayers = view.players.map((p) => ({ seat: p.seat, nickname: p.nickname }));

  // Début du match : Mohamed Naceur prend la commande des boissons, en 3D.
  if (view.order && !view.game) {
    return (
      <>
        <CafeCutscene cutscene={{ kind: 'order', table: tableNumber }} players={tablePlayers}>
          <OrderPanel
            view={view}
            names={names}
            onChoose={(drink: Drink) => void send({ type: 'drink', drink })}
            onTimeout={() => void sendRequest({ type: 'drink', roomId })}
          />
          <VoiceBar voice={voice} className="voice--lobby" />
        </CafeCutscene>
        {effects.notice && (
          <div className="toast toast--fixed" role="status">
            <SuitText text={effects.notice} />
          </div>
        )}
      </>
    );
  }

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
          onSettings={(settings) => void send({ type: 'settings', settings })}
          onLeave={async () => {
            if (await send({ type: 'leave' })) onExit(true);
          }}
          onCopied={showNotice}
          voiceBar={<VoiceBar voice={voice} className="voice--lobby" />}
          speakingSeats={voice.snapshot.speaking}
          voiceMutedSeats={voice.snapshot.mutedSeats}
          voiceLinks={voiceLinks}
        />
        {effects.notice && (
          <div className="toast toast--fixed" role="status">
            <SuitText text={effects.notice} />
          </div>
        )}
      </>
    );
  }

  const game = view.game;
  const acked = view.ackSeats.includes(view.mySeat);
  const scene = scenes[0];
  const mancheKey = `${roomId}:${(view.match?.games.length ?? 0) - (game.phase === 'gameOver' ? 1 : 0)}`;
  const served = servedDrinks(view.drinks ?? {}, mancheKey);
  // Les boissons : chacun voit la scène de sa place. Celui qui reçoit la mauvaise boisson a droit à la phrase de Nader.
  const myOrder = view.drinks?.[view.mySeat];
  const myServed = served[view.mySeat];
  const cutscene: Cutscene | null = !scene
    ? null
    : scene === 'drinks'
      ? {
          kind: scene,
          table: tableNumber,
          served,
          viewerSeat: view.mySeat,
          line: myOrder && myServed && myServed !== myOrder ? naderDrinkLine(myOrder, myServed) : undefined,
        }
      : { kind: scene, table: tableNumber, served };
  const waitingNames = acked ? SEATS.filter((s) => !view.ackSeats.includes(s)).map((s) => names[s]) : [];

  return (
    <>
      <GameTable
        view={game}
        names={names}
        effects={effects}
        busy={busy}
        absentSeats={absentSeats}
        banner={banner}
        audience={audience}
        voiceBar={<VoiceBar voice={voice} className="voice--table" />}
        speakingSeats={voice.snapshot.speaking}
        voiceMutedSeats={voice.snapshot.mutedSeats}
        voiceLinks={voiceLinks}
        onAction={(action: GameAction) => void send({ type: 'game', action })}
        cont={{
          label:
            game.phase === 'gameOver' ? (isMatchOver(view.match ?? NEW_MATCH) ? 'Nouveau match' : 'Manche suivante') : 'Donne suivante',
          acked,
          waitingNames,
          onContinue: () => void send({ type: 'continue' }),
        }}
        onHome={() => onExit(false)}
        match={view.match ?? NEW_MATCH}
        onEndMatch={async () => {
          if (window.confirm('Terminer le match pour toute la table ?')) await send({ type: 'endMatch' });
        }}
        menuLabel="Menu"
        onMenu={() => setMenuOpen(true)}
      />
      {menuOpen && (
        <GameMenu
          onClose={() => setMenuOpen(false)}
          actions={[
            {
              label: 'Revenir à l’accueil',
              hint: 'Ta place est gardée : tu pourras reprendre la partie.',
              onClick: () => onExit(false),
            },
            {
              label: 'Quitter la table',
              danger: true,
              hint: 'Quand les 4 joueurs ont quitté la table, elle se libère pour d’autres.',
              onClick: async () => {
                if (!window.confirm('Quitter la table ? Tu ne pourras revenir qu’avec le code du salon.')) return;
                if (await send({ type: 'quit' })) onExit(true);
              },
            },
          ]}
        />
      )}
      {cutscene && !effects.pausedTrick && !effects.finale && (
        <CafeCutscene key={`${scenes.length}-${scene}`} cutscene={cutscene} players={tablePlayers} onArrive={onSceneArrive}>
          <ScenePanel
            kind={cutscene.kind}
            arrived={sceneArrived}
            ordered={view.drinks ?? {}}
            served={served}
            names={names}
            onClose={closeScene}
          />
        </CafeCutscene>
      )}
    </>
  );
}

/** Le panneau sous la scène 3D : ce que Nader a servi (faux), ou « علقتو ؟ ». Se ferme tout seul. */
function ScenePanel(props: {
  readonly kind: Cutscene['kind'];
  /** Le serveur est arrivé à la table : on laisse le temps de lire, puis on revient au jeu. */
  readonly arrived: boolean;
  readonly ordered: Partial<Record<number, Drink>>;
  readonly served: Partial<Record<number, Drink>>;
  readonly names: SeatNames;
  readonly onClose: () => void;
}) {
  const { kind, arrived, ordered, served, names, onClose } = props;
  useEffect(() => {
    // Après l'arrivée du serveur : le temps de lire ; sinon, au plus 40 s (3D très lente).
    const timer = setTimeout(onClose, arrived ? (kind === 'drinks' ? 9000 : 7000) : 40000);
    return () => clearTimeout(timer);
  }, [kind, arrived, onClose]);
  return (
    <div className="order">
      {kind === 'drinks' ? (
        <>
          <p className="order__title">
            Nader apporte les boissons…
            <span className="order__hint">comme d’habitude, il s’est trompé 😅</span>
          </p>
          <ul className="order__paper">
            {SEATS.filter((s) => ordered[s]).map((s) => (
              <li key={s}>
                <span>{names[s]}</span>
                <span className="order__pen">
                  <s>{DRINK_LABELS[ordered[s]!]}</s> → {DRINK_LABELS[served[s]!]}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="order__title">
          <span lang="ar" dir="rtl">
            « علقتو ؟ ... هيا إكبسو رواحكم الماتش بش يبدا »
          </span>
          <span className="order__hint">Nader presse la table : le match à la télé va commencer.</span>
        </p>
      )}
      <button type="button" className="btn btn--primary btn--wide" onClick={onClose}>
        Revenir à la partie
      </button>
    </div>
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
