import { Component, Suspense, lazy, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { CAFE_TABLE_COUNT, ROOM_CODE_LENGTH, TARGET_SCORES } from '../server/rooms.ts';
import { SoundToggle } from './SoundToggle.tsx';
import { promptInstall, useInstallState } from './install.ts';
import { onlineConfigured } from './online/client.ts';
import type { SavedRoom } from './online/client.ts';
import { useCafeTables } from './online/cafeData.ts';
import type { CafeTable } from './online/cafeData.ts';
import type { CafeTarget, SceneTable } from './cafe/cafeScene.ts';
import type { Viewpoint } from './cafe/cafeLayout.ts';
import { supportsWebGL } from './cafe/webgl.ts';

const CafeView = lazy(() => import('./cafe/CafeView.tsx'));

interface HomeProps {
  readonly nickname: string;
  readonly onNickname: (nickname: string) => void;
  readonly initialCode: string;
  readonly savedRoom: SavedRoom | null;
  readonly busy: boolean;
  readonly error: string | null;
  readonly onLocal: (targetScore: number) => void;
  readonly onCreate: (table: number) => void;
  readonly onJoin: (code: string) => void;
  readonly onResume: (room: SavedRoom) => void;
  readonly onWatch: (roomId: string, table: number) => void;
}

/** Si la 3D ne peut pas se charger (vieux téléphone, hors ligne), on affiche le plan en 2D. */
class SceneBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

const STATUS_TEXT: Record<CafeTable['info']['status'], string> = {
  lobby: 'Les joueurs s’installent',
  playing: 'Partie en cours',
  finished: 'Partie terminée',
};

function toSceneTables(tables: readonly CafeTable[]): SceneTable[] {
  return Array.from({ length: CAFE_TABLE_COUNT }, (_, i) => {
    const t = tables.find((x) => x.number === i + 1);
    return t
      ? { number: t.number, status: t.info.status, players: t.info.players, scores: t.info.scores }
      : { number: i + 1, status: 'free' as const, players: [], scores: null };
  });
}

export function Home(props: HomeProps) {
  const { nickname, onNickname, initialCode, savedRoom, busy, error, onLocal, onCreate, onJoin, onResume, onWatch } = props;
  const { tables } = useCafeTables();
  const sceneTables = useMemo(() => toSceneTables(tables), [tables]);
  const [selected, setSelected] = useState<CafeTarget | null>(null);
  const [view, setView] = useState<Viewpoint>('entrance');
  const [codeMode, setCodeMode] = useState(initialCode.length > 0);
  const [code, setCode] = useState(initialCode);
  const [localTarget, setLocalTarget] = useState(1500);
  const [webgl] = useState(supportsWebGL);
  const install = useInstallState();

  const cleanCode = code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, ROOM_CODE_LENGTH);
  const nicknameOk = nickname.trim().length > 0;
  const full = onlineConfigured && tables.length >= CAFE_TABLE_COUNT;

  const select = (target: CafeTarget) => {
    setSelected(target);
    setCodeMode(false);
    // Toucher une table du fond depuis l'entrée y amène la caméra.
    if (target.kind === 'table') setView('back');
    if (target.kind === 'terrace') setView('entrance');
  };

  const plan = <CafePlan tables={sceneTables} selected={selected} onSelect={select} />;
  const table = selected?.kind === 'table' ? tables.find((t) => t.number === selected.number) : undefined;

  const nicknameField = (
    <label className="field">
      <span className="field__label">Ton pseudo</span>
      <input
        className="field__input"
        value={nickname}
        maxLength={20}
        autoComplete="nickname"
        placeholder="Ex. : Othman"
        onChange={(e) => onNickname(e.target.value)}
      />
    </label>
  );

  const codeField = (
    <label className="field field--grow">
      <span className="field__label">Code de la table</span>
      <input
        className="field__input field__input--code"
        value={cleanCode}
        inputMode="text"
        autoCapitalize="characters"
        autoComplete="off"
        placeholder="ABC234"
        onChange={(e) => setCode(e.target.value)}
      />
    </label>
  );

  let sheet: ReactNode;
  if (codeMode) {
    sheet = (
      <>
        <h2 className="sheet__title">Rejoindre une table avec un code</h2>
        {nicknameField}
        <div className="join-row">
          {codeField}
          <button
            type="button"
            className="btn btn--primary"
            disabled={busy || !nicknameOk || cleanCode.length !== ROOM_CODE_LENGTH}
            onClick={() => onJoin(cleanCode)}
          >
            Rejoindre
          </button>
        </div>
      </>
    );
  } else if (selected?.kind === 'terrace') {
    sheet = (
      <>
        <h2 className="sheet__title">Terrasse · contre les bots</h2>
        <p className="sheet__text">Une partie tranquille dehors, contre trois bots. Score à atteindre :</p>
        <div className="segmented" role="group" aria-label="Score à atteindre">
          {TARGET_SCORES.map((t) => (
            <button
              key={t}
              type="button"
              className={`segmented__option${localTarget === t ? ' segmented__option--on' : ''}`}
              aria-pressed={localTarget === t}
              onClick={() => setLocalTarget(t)}
            >
              {t}
            </button>
          ))}
        </div>
        <button type="button" className="btn btn--primary btn--wide" onClick={() => onLocal(localTarget)}>
          S'asseoir sur la terrasse
        </button>
      </>
    );
  } else if (selected?.kind === 'table' && !onlineConfigured) {
    sheet = (
      <>
        <h2 className="sheet__title">Table {selected.number}</h2>
        <p className="sheet__text">Le jeu en ligne n'est pas encore configuré sur ce site : joue sur la terrasse contre les bots.</p>
      </>
    );
  } else if (selected?.kind === 'table' && !table) {
    sheet = (
      <>
        <h2 className="sheet__title">
          Table {selected.number} <span className="sheet__tag sheet__tag--free">Libre</span>
        </h2>
        <p className="sheet__text">Assieds-toi : tu recevras un code à envoyer à tes trois amis.</p>
        {nicknameField}
        <button type="button" className="btn btn--primary btn--wide" disabled={busy || !nicknameOk} onClick={() => onCreate(selected.number)}>
          S'asseoir à la table {selected.number}
        </button>
      </>
    );
  } else if (selected?.kind === 'table' && table) {
    const seatsLeft = 4 - table.info.players.length;
    const canJoin = table.info.status === 'lobby' && seatsLeft > 0;
    const canWatch = table.info.status !== 'lobby';
    sheet = (
      <>
        <h2 className="sheet__title">
          Table {table.number} <span className="sheet__tag">{STATUS_TEXT[table.info.status]}</span>
        </h2>
        <ul className="sheet__players">
          {[0, 1, 2, 3].map((seat) => {
            const player = table.info.players.find((p) => p.seat === seat);
            return (
              <li key={seat} className={`sheet__player sheet__player--team${seat % 2}`}>
                {player ? player.nickname : <em>place libre</em>}
              </li>
            );
          })}
        </ul>
        {table.info.scores && (
          <p className="sheet__text">
            Score : {table.info.scores[0]} – {table.info.scores[1]} (objectif {table.info.targetScore})
          </p>
        )}
        {canJoin && (
          <>
            <p className="sheet__text">Pour t'asseoir à cette table, il te faut le code que t'a envoyé un des joueurs.</p>
            {nicknameField}
            <div className="join-row">
              {codeField}
              <button
                type="button"
                className="btn btn--primary"
                disabled={busy || !nicknameOk || cleanCode.length !== ROOM_CODE_LENGTH}
                onClick={() => onJoin(cleanCode)}
              >
                Rejoindre
              </button>
            </div>
          </>
        )}
        {canWatch && (
          <button type="button" className="btn btn--primary btn--wide" onClick={() => onWatch(table.roomId, table.number)}>
            Regarder la partie
          </button>
        )}
      </>
    );
  } else {
    sheet = (
      <>
        <p className="sheet__text">
          Touche une <strong>table au fond du café</strong> pour jouer en ligne avec tes amis, ou la <strong>terrasse</strong> pour
          jouer contre les bots.
        </p>
        {onlineConfigured && (
          <button type="button" className="btn btn--ghost btn--wide" onClick={() => setCodeMode(true)}>
            J'ai un code de table
          </button>
        )}
        {install === 'prompt' && (
          <button type="button" className="btn btn--ghost btn--wide" onClick={() => void promptInstall()}>
            Installer l'application sur ce téléphone
          </button>
        )}
        {install === 'ios' && (
          <p className="install-hint">
            Pour l'installer sur iPhone : bouton <strong>Partager</strong> de Safari, puis <strong>« Sur l'écran d'accueil »</strong>.
          </p>
        )}
      </>
    );
  }

  return (
    <div className="home-cafe">
      <header className="cafe-header">
        <div className="cafe-header__titles">
          <h1 className="cafe-header__title" lang="ar" dir="rtl">
            قهوة طارق
          </h1>
          <p className="cafe-header__welcome">
            <span lang="en">Welcome to Café Tarek</span>
            <span aria-hidden="true"> · </span>
            <span lang="ar" dir="rtl">
              مرحبا بكم في قهوة طارق
            </span>
          </p>
        </div>
        <SoundToggle className="cafe-header__sound" />
      </header>

      <div className="cafe-stage">
        {webgl ? (
          <SceneBoundary fallback={plan}>
            <Suspense fallback={<div className="cafe-loading">On ouvre le café…</div>}>
              <CafeView tables={sceneTables} selected={selected} view={view} onSelect={select} onView={setView} />
            </Suspense>
          </SceneBoundary>
        ) : (
          plan
        )}
        {webgl && (
          <button
            type="button"
            className="cafe-move"
            onClick={() => {
              if (selected?.kind === 'table') setSelected(null);
              setView(view === 'entrance' ? 'back' : 'entrance');
            }}
          >
            {view === 'entrance' ? 'Aller au fond · tables de belote ↑' : '↓ Revenir à l’entrée'}
          </button>
        )}
        {full && !selected && (
          <p className="cafe-full" role="status">
            Café complet · touche une table pour regarder en spectateur
          </p>
        )}
      </div>

      <section className="cafe-sheet" aria-live="polite">
        {savedRoom && (
          <div className="sheet__resume">
            <span>Tu as une partie en cours.</span>
            <button type="button" className="btn btn--primary" disabled={busy} onClick={() => onResume(savedRoom)}>
              Reprendre
            </button>
          </div>
        )}
        {(selected || codeMode) && (
          <button
            type="button"
            className="sheet__close"
            aria-label="Fermer"
            onClick={() => {
              setSelected(null);
              setCodeMode(false);
            }}
          >
            ×
          </button>
        )}
        {sheet}
        {error && (
          <p className="screen__error" role="alert">
            {error}
          </p>
        )}
      </section>
    </div>
  );
}

/** Plan du café en 2D, quand la 3D n'est pas disponible. */
function CafePlan({
  tables,
  selected,
  onSelect,
}: {
  readonly tables: readonly SceneTable[];
  readonly selected: CafeTarget | null;
  readonly onSelect: (target: CafeTarget) => void;
}) {
  return (
    <div className="cafe-plan">
      <p className="cafe-plan__zone">Au fond, près de la télé</p>
      <div className="cafe-plan__grid">
        {tables.map((t) => (
          <button
            key={t.number}
            type="button"
            className={`cafe-plan__table cafe-plan__table--${t.status}${selected?.kind === 'table' && selected.number === t.number ? ' cafe-plan__table--selected' : ''}`}
            onClick={() => onSelect({ kind: 'table', number: t.number })}
          >
            <span className="cafe-plan__name">Table {t.number}</span>
            <span className="cafe-plan__status">{t.status === 'free' ? 'Libre' : `${t.players.length}/4`}</span>
            {t.players.length > 0 && <span className="cafe-plan__players">{t.players.map((p) => p.nickname).join(' · ')}</span>}
          </button>
        ))}
      </div>
      <p className="cafe-plan__zone">Dehors</p>
      <button
        type="button"
        className={`cafe-plan__table cafe-plan__table--terrace${selected?.kind === 'terrace' ? ' cafe-plan__table--selected' : ''}`}
        onClick={() => onSelect({ kind: 'terrace' })}
      >
        <span className="cafe-plan__name">Terrasse</span>
        <span className="cafe-plan__status">Contre les bots</span>
      </button>
    </div>
  );
}
