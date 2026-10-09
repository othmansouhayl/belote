import { useState } from 'react';
import { ROOM_CODE_LENGTH } from '../server/rooms.ts';
import { cardImageUrl } from './CardView.tsx';
import { SoundToggle } from './SoundToggle.tsx';
import { onlineConfigured } from './online/client.ts';
import type { SavedRoom } from './online/client.ts';

/** Les quatre Valets, maîtres de l'atout en belote. */
const HERO_CARDS = ['V-trefle', 'V-carreau', 'V-pique', 'V-coeur'];

interface HomeProps {
  readonly nickname: string;
  readonly onNickname: (nickname: string) => void;
  readonly initialCode: string;
  readonly savedRoom: SavedRoom | null;
  readonly busy: boolean;
  readonly error: string | null;
  readonly onLocal: () => void;
  readonly onCreate: () => void;
  readonly onJoin: (code: string) => void;
  readonly onResume: (room: SavedRoom) => void;
}

export function Home(props: HomeProps) {
  const { nickname, onNickname, initialCode, savedRoom, busy, error, onLocal, onCreate, onJoin, onResume } = props;
  const [code, setCode] = useState(initialCode);
  const cleanCode = code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, ROOM_CODE_LENGTH);
  const nicknameOk = nickname.trim().length > 0;
  // Arrivé par un lien d'invitation : « Rejoindre » devient l'action principale.
  const invited = initialCode.length > 0;

  return (
    <div className="screen home">
      <SoundToggle className="home__sound" />
      <header className="home__hero">
        <div className="hero-fan" aria-hidden="true">
          {HERO_CARDS.map((id, i) => (
            <img key={id} className="hero-fan__card" src={cardImageUrl(id)} alt="" style={{ ['--i' as string]: i }} />
          ))}
        </div>
        <h1 className="home__title">
          Belote
          <span className="home__subtitle">coinchée tunisienne</span>
        </h1>
        <p className="home__tagline">Jouez à quatre, entre amis, où que vous soyez.</p>
      </header>

      {savedRoom && (
        <section className="card-panel card-panel--resume">
          <p className="screen__text">Vous avez une partie en cours (salon {savedRoom.code}).</p>
          <button type="button" className="btn btn--primary btn--wide" disabled={busy} onClick={() => onResume(savedRoom)}>
            Reprendre la partie
          </button>
        </section>
      )}

      <section className="card-panel card-panel--main">
        <h2 className="card-panel__title">Jouer en ligne avec des amis</h2>
        {onlineConfigured ? (
          <>
            <label className="field">
              <span className="field__label">Votre pseudo</span>
              <input
                className="field__input"
                value={nickname}
                maxLength={20}
                autoComplete="nickname"
                placeholder="Ex. : Othman"
                onChange={(e) => onNickname(e.target.value)}
              />
            </label>
            <button
              type="button"
              className={`btn btn--wide ${invited ? 'btn--ghost' : 'btn--primary'}`}
              disabled={busy || !nicknameOk}
              onClick={onCreate}
            >
              Créer un salon privé
            </button>
            <div className="join-row">
              <label className="field field--grow">
                <span className="field__label">Code du salon</span>
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
              <button
                type="button"
                className={`btn ${invited ? 'btn--primary' : 'btn--ghost'}`}
                disabled={busy || !nicknameOk || cleanCode.length !== ROOM_CODE_LENGTH}
                onClick={() => onJoin(cleanCode)}
              >
                Rejoindre
              </button>
            </div>
            {!nicknameOk && <p className="screen__hint">Choisissez un pseudo pour jouer en ligne.</p>}
          </>
        ) : (
          <p className="screen__hint">Le jeu en ligne n'est pas encore configuré sur ce site.</p>
        )}
        {error && (
          <p className="screen__error" role="alert">
            {error}
          </p>
        )}
      </section>

      <section className="card-panel">
        <h2 className="card-panel__title">S'entraîner</h2>
        <button type="button" className="btn btn--ghost btn--wide" onClick={onLocal}>
          Jouer seul contre 3 bots
        </button>
      </section>

      <footer className="home__footer">
        <span>Règles tunisiennes</span>
        <span aria-hidden="true">·</span>
        <span>Partie en 1500 points</span>
        <span aria-hidden="true">·</span>
        <span>Vocal intégré</span>
      </footer>
    </div>
  );
}
