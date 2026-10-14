import { useState } from 'react';
import type { KeyboardEvent } from 'react';
import { BrandHeader, SiteFooter } from '../BrandHeader.tsx';
import type { SavedRoom } from '../online/client.ts';
import { CLOSED_LINE, MAP_SIZE, TOWN_CAFES } from './oudhref.ts';
import type { TownCafe, TownCafeId } from './oudhref.ts';

interface TownMapProps {
  readonly savedRoom: SavedRoom | null;
  readonly busy: boolean;
  readonly error: string | null;
  readonly onResume: (room: SavedRoom) => void;
  /** Entrer dans un café ouvert (pour l'instant : le Café Tarek). */
  readonly onEnter: (cafe: TownCafeId) => void;
}

/** Les routes, dessinées très simplement d'après la carte de Oudhref. */
const ROADS = {
  // Route P15 (Gabès ↔ Kébili), en diagonale du nord-ouest au sud-est.
  main: 'M0 112 L96 172 L200 232 L284 298 L302 352 L320 440',
  // Route C208, à l'ouest.
  west: 'M22 0 L34 150 L62 440',
  // Les rues de la ville.
  streets: [
    'M96 176 L214 152 L360 122',
    'M214 152 L250 218 L288 296',
    'M168 92 L214 152',
    'M168 92 L150 0',
    'M168 92 L80 60 L30 70',
    'M214 152 L270 80 L330 40',
    'M250 218 L360 200',
    'M200 232 L190 330 L160 440',
    'M120 300 L250 360 L360 330',
    'M96 176 L70 300',
    'M140 200 L120 300',
  ],
};

function onKeyActivate(action: () => void) {
  return (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      action();
    }
  };
}

/** Repère d'un café sur la carte : doré et animé s'il est ouvert, gris avec un cadenas sinon. */
function CafePin({ cafe, selected, onPick }: { readonly cafe: TownCafe; readonly selected: boolean; readonly onPick: () => void }) {
  const label = cafe.open ? `${cafe.fr}, ouvert : entrer` : `${cafe.fr}, encore fermé`;
  const textX = cafe.labelSide === 'left' ? -16 : 16;
  const anchor = cafe.labelSide === 'left' ? 'end' : 'start';
  return (
    <g
      className={`town-pin${cafe.open ? ' town-pin--open' : ' town-pin--locked'}${selected ? ' town-pin--selected' : ''}`}
      transform={`translate(${cafe.x} ${cafe.y})`}
      role="button"
      tabIndex={0}
      aria-label={label}
      onClick={onPick}
      onKeyDown={onKeyActivate(onPick)}
    >
      {/* Zone de toucher plus grande que le dessin. */}
      <circle r="26" className="town-pin__hit" />
      {cafe.open && <circle cy="-21" r="14" className="town-pin__pulse" />}
      <path d="M0 0 C-9 -10 -12 -15 -12 -21 A12 12 0 1 1 12 -21 C12 -15 9 -10 0 0 Z" className="town-pin__drop" />
      <text y="-16" className="town-pin__icon" textAnchor="middle">
        {cafe.open ? '☕' : '🔒'}
      </text>
      <text x={textX} y="-24" className="town-pin__name" textAnchor={anchor} lang="ar">
        {cafe.ar}
      </text>
      <text x={textX} y="-9" className="town-pin__fr" textAnchor={anchor}>
        {cafe.open ? cafe.fr : `${cafe.fr} · fermé`}
      </text>
    </g>
  );
}

/**
 * L'entrée du jeu : la carte de Oudhref (وذرف) et ses cafés. On touche un café ouvert pour y entrer ;
 * les autres affichent « مازلنا مسكرين » (on n'a pas encore ouvert).
 */
export function TownMap({ savedRoom, busy, error, onResume, onEnter }: TownMapProps) {
  const [closed, setClosed] = useState<TownCafe | null>(null);
  const pick = (cafe: TownCafe) => {
    if (cafe.open) onEnter(cafe.id);
    else setClosed(cafe);
  };

  return (
    <div className="home-cafe town">
      <BrandHeader place="Les cafés de Oudhref" />

      <div className="town__stage">
        <svg
          className="town__map"
          viewBox={`0 0 ${MAP_SIZE.width} ${MAP_SIZE.height}`}
          preserveAspectRatio="xMidYMid meet"
          role="group"
          aria-label="Carte de Oudhref : choisis un café"
        >
          <rect width={MAP_SIZE.width} height={MAP_SIZE.height} rx="18" className="town__fields" />
          {/* La ville, la sebkha au nord-est et deux jardins. */}
          <path
            d="M40 70 C90 30 200 30 300 70 C350 110 350 250 320 380 C260 430 120 420 70 380 C30 300 20 150 40 70 Z"
            className="town__city"
          />
          <path d="M250 0 C270 22 320 30 360 18 L360 0 Z" className="town__water" />
          <ellipse cx="190" cy="112" rx="20" ry="13" className="town__park" />
          <ellipse cx="128" cy="160" rx="13" ry="9" className="town__park" />
          {ROADS.streets.map((d) => (
            <path key={d} d={d} className="town__street" />
          ))}
          {/* Routes principales : un bord gris puis la chaussée claire par-dessus. */}
          <path d={ROADS.west} className="town__road-edge" />
          <path d={ROADS.main} className="town__road-edge town__road-edge--main" />
          <path d={ROADS.west} className="town__road town__road--west" />
          <path d={ROADS.main} className="town__road town__road--main" />
          <g className="town__shield" transform="translate(242 265)">
            <rect x="-15" y="-9" width="30" height="18" rx="4" />
            <text textAnchor="middle" y="4">
              P15
            </text>
          </g>
          <g className="town__shield town__shield--green" transform="translate(48 400)">
            <rect x="-17" y="-9" width="34" height="18" rx="4" />
            <text textAnchor="middle" y="4">
              C208
            </text>
          </g>
          <text x="180" y="262" textAnchor="middle" className="town__title" lang="ar">
            وذرف
          </text>
          <text x="180" y="280" textAnchor="middle" className="town__subtitle">
            Oudhref
          </text>
          {TOWN_CAFES.map((cafe) => (
            <CafePin key={cafe.id} cafe={cafe} selected={closed?.id === cafe.id} onPick={() => pick(cafe)} />
          ))}
        </svg>
        {closed && (
          <p className="town__closed" role="status">
            <span lang="ar" dir="rtl">
              {closed.ar} : {CLOSED_LINE}
            </span>
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
        {closed ? (
          <>
            <h2 className="sheet__title">
              <span lang="ar">{closed.ar}</span> · {closed.fr}
            </h2>
            <p className="town__sign" lang="ar" dir="rtl">
              🔒 {CLOSED_LINE}
            </p>
            <p className="sheet__text">Ce café n'est pas encore ouvert. En attendant, on se retrouve au Café Tarek.</p>
            <button type="button" className="btn btn--primary btn--wide" onClick={() => onEnter('tarek')}>
              Aller au Café Tarek
            </button>
            <button type="button" className="btn btn--ghost btn--wide" onClick={() => setClosed(null)}>
              Revoir la carte
            </button>
          </>
        ) : (
          <>
            <p className="sheet__text">
              Choisis un <strong>café de Oudhref</strong> pour jouer à la belote.
            </p>
            <ul className="town__list">
              {TOWN_CAFES.map((cafe) => (
                <li key={cafe.id}>
                  <button type="button" className={`town__item${cafe.open ? ' town__item--open' : ''}`} onClick={() => pick(cafe)}>
                    <span className="town__item-name">
                      <span lang="ar">{cafe.ar}</span>
                      <small>{cafe.fr}</small>
                    </span>
                    <span className="town__item-state">
                      {cafe.open ? (
                        'Entrer ›'
                      ) : (
                        <span lang="ar" dir="rtl">
                          🔒 {CLOSED_LINE}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
        {error && (
          <p className="screen__error" role="alert">
            {error}
          </p>
        )}
        <SiteFooter />
      </section>
    </div>
  );
}
