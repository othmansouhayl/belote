import { useState } from 'react';
import type { ReactNode } from 'react';
import { MicOffIcon } from '../icons.tsx';
import type { Seat } from '../../engine/index.ts';
import type { RoomSettings, RoomView } from '../../server/types.ts';
import { RoomSettingsPanel } from './RoomSettingsPanel.tsx';
import { inviteLink } from './client.ts';

interface LobbyProps {
  readonly view: RoomView;
  readonly presentSeats: ReadonlySet<Seat>;
  readonly busy: boolean;
  readonly onSeat: (seat: Seat) => void;
  readonly onReady: (ready: boolean) => void;
  readonly onLeave: () => void;
  readonly onCopied: (text: string) => void;
  readonly voiceBar: ReactNode;
  readonly speakingSeats: ReadonlySet<Seat>;
  readonly voiceMutedSeats: ReadonlySet<Seat>;
  readonly onSettings: (settings: RoomSettings) => void;
}

const TEAMS: readonly { readonly name: string; readonly seats: readonly [Seat, Seat] }[] = [
  { name: 'Équipe 1', seats: [0, 2] },
  { name: 'Équipe 2', seats: [1, 3] },
];

export function Lobby(props: LobbyProps) {
  const { view, presentSeats, busy, onSeat, onReady, onLeave, onCopied, voiceBar, speakingSeats, voiceMutedSeats, onSettings } = props;
  const hostName = view.players.find((p) => p.seat === view.hostSeat)?.nickname ?? null;
  const [shareFailed, setShareFailed] = useState(false);
  const link = inviteLink(view.code);
  const me = view.players.find((p) => p.seat === view.mySeat);
  const count = view.players.length;
  const readyCount = view.players.filter((p) => p.ready).length;

  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Café Tarek', text: `Rejoins-moi${view.tableNumber ? ` à la table ${view.tableNumber}` : ''} au Café Tarek ! Code : ${view.code}`, url: link });
        return;
      }
      await navigator.clipboard.writeText(link);
      onCopied('Lien copié : envoyez-le à vos amis.');
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      setShareFailed(true);
    }
  };

  let status: string;
  if (count < 4) status = `En attente de joueurs (${count}/4)`;
  else if (readyCount < 4) status = `En attente que tout le monde soit prêt (${readyCount}/4)`;
  else status = 'La partie commence…';

  return (
    <div className="screen">
      <header className="screen__header">
        <p className="screen__eyebrow">{view.tableNumber ? `Café Tarek · table ${view.tableNumber}` : 'Salon privé'}</p>
        <h1 className="room-code" aria-label={`Code du salon : ${view.code.split('').join(' ')}`}>
          {view.code}
        </h1>
        <div className="screen__row">
          <button type="button" className="btn btn--primary" onClick={share}>
            Inviter des amis
          </button>
        </div>
        {voiceBar}
        {shareFailed && (
          <p className="screen__hint">
            Copiez ce lien : <span className="selectable">{link}</span>
          </p>
        )}
      </header>

      <section className="teams" aria-label="Places autour de la table">
        {TEAMS.map((team) => (
          <div key={team.name} className="team">
            <h2 className="team__name">{team.name}</h2>
            {team.seats.map((seat) => {
              const player = view.players.find((p) => p.seat === seat);
              const isMe = seat === view.mySeat;
              if (!player) {
                return (
                  <button key={seat} type="button" className="slot slot--free" disabled={busy} onClick={() => onSeat(seat)}>
                    <span className="slot__name">Place libre</span>
                    <span className="slot__action">S'asseoir ici</span>
                  </button>
                );
              }
              return (
                <div key={seat} className={`slot${isMe ? ' slot--me' : ''}${speakingSeats.has(seat) ? ' slot--speaking' : ''}`}>
                  <span className="slot__name">
                    {player.nickname}
                    {isMe && ' (vous)'}
                    {seat === view.hostSeat && <span className="slot__host">Hôte</span>}
                    {voiceMutedSeats.has(seat) && (
                      <span className="slot__mic-off" title="Micro coupé">
                        <MicOffIcon size={14} />
                      </span>
                    )}
                  </span>
                  <span className={`slot__state${player.ready ? ' slot__state--ready' : ''}`}>
                    {player.ready ? '✓ Prêt' : presentSeats.has(seat) || isMe ? 'Pas prêt' : 'Hors ligne'}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
        <p className="screen__hint">Les partenaires sont assis face à face. Touchez une place libre pour changer d'équipe.</p>
      </section>

      <RoomSettingsPanel
        settings={view.settings}
        editable={view.hostSeat === view.mySeat}
        hostName={hostName}
        busy={busy}
        onChange={onSettings}
      />

      <footer className="screen__footer">
        <p className="screen__status" aria-live="polite">
          {status}
        </p>
        <button
          type="button"
          className={`btn btn--wide ${me?.ready ? 'btn--ghost' : 'btn--primary'}`}
          disabled={busy}
          onClick={() => onReady(!me?.ready)}
        >
          {me?.ready ? 'Je ne suis plus prêt' : 'Je suis prêt'}
        </button>
        <button type="button" className="btn btn--link" disabled={busy} onClick={onLeave}>
          Quitter le salon
        </button>
      </footer>
    </div>
  );
}
