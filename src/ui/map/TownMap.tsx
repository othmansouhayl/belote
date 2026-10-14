import { useEffect, useRef, useState } from 'react';
import type {
  CSSProperties,
  KeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  WheelEvent as ReactWheelEvent,
} from 'react';
import { BrandHeader, SiteFooter } from '../BrandHeader.tsx';
import type { SavedRoom } from '../online/client.ts';
import { INITIAL_VIEW, toMapPoint, viewAt, zoomOf } from './mapView.ts';
import type { MapViewBox } from './mapView.ts';
import { CLOSED_LINE, DISTRICTS, PARKS, ROADS, TOWN_AREA, TOWN_CAFES } from './oudhref.ts';
import type { TownCafe, TownCafeId } from './oudhref.ts';

interface TownMapProps {
  readonly savedRoom: SavedRoom | null;
  readonly busy: boolean;
  readonly error: string | null;
  readonly onResume: (room: SavedRoom) => void;
  /** Entrer dans un café ouvert (pour l'instant : le Café Tarek). */
  readonly onEnter: (cafe: TownCafeId) => void;
}

function onKeyActivate(action: () => void) {
  return (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      action();
    }
  };
}

type Point = { readonly x: number; readonly y: number };

/** Échelle de la carte sur un téléphone moyen (412 pixels pour les 560 unités de la vue). */
const PHONE_PIXELS_PER_UNIT = 0.74;

const middle = (pts: readonly Point[]): Point => ({
  x: pts.reduce((sum, p) => sum + p.x, 0) / pts.length,
  y: pts.reduce((sum, p) => sum + p.y, 0) / pts.length,
});
const gap = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * Les doigts sur la carte : un doigt la déplace, deux doigts (pincer) zooment autour d'eux.
 * La molette zoome aussi sur ordinateur. Un appui qui a glissé n'ouvre pas de café.
 */
function useMapGestures() {
  const svgRef = useRef<SVGSVGElement>(null);
  const [view, setView] = useState<MapViewBox>(INITIAL_VIEW);
  const [screen, setScreen] = useState({ width: 390, height: 640 });
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const observer = new ResizeObserver(() => {
      const r = svg.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) setScreen({ width: r.width, height: r.height });
    });
    observer.observe(svg);
    return () => observer.disconnect();
  }, []);
  const viewRef = useRef(view);
  viewRef.current = view;
  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef<{ anchor: Point; zoom: number; spread: number } | null>(null);
  const start = useRef<Point | null>(null);
  const dragged = useRef(false);

  const frame = () => {
    const r = svgRef.current!.getBoundingClientRect();
    return { left: r.left, top: r.top, size: { width: r.width, height: r.height } };
  };
  const at = (e: { clientX: number; clientY: number }): Point => {
    const { left, top } = frame();
    return { x: e.clientX - left, y: e.clientY - top };
  };
  // À chaque doigt posé ou levé, on repart de la vue actuelle.
  const begin = () => {
    const pts = [...pointers.current.values()];
    if (pts.length === 0) {
      gesture.current = null;
      return;
    }
    const mid = middle(pts);
    gesture.current = {
      anchor: toMapPoint(viewRef.current, frame().size, mid.x, mid.y),
      zoom: zoomOf(viewRef.current),
      spread: pts.length > 1 ? gap(pts[0]!, pts[1]!) : 0,
    };
  };

  const onPointerDown = (e: ReactPointerEvent) => {
    pointers.current.set(e.pointerId, at(e));
    if (pointers.current.size === 1) {
      start.current = at(e);
      dragged.current = false;
    }
    begin();
  };
  const onPointerMove = (e: ReactPointerEvent) => {
    if (!pointers.current.has(e.pointerId) || !gesture.current) return;
    const p = at(e);
    pointers.current.set(e.pointerId, p);
    if (start.current && gap(p, start.current) > 8) dragged.current = true;
    if (!dragged.current) return;
    const pts = [...pointers.current.values()];
    const mid = middle(pts);
    const g = gesture.current;
    const zoom = pts.length > 1 && g.spread > 0 ? g.zoom * (gap(pts[0]!, pts[1]!) / g.spread) : g.zoom;
    setView(viewAt(g.anchor, frame().size, mid.x, mid.y, zoom));
  };
  const onPointerEnd = (e: ReactPointerEvent) => {
    pointers.current.delete(e.pointerId);
    begin();
  };
  const onWheel = (e: ReactWheelEvent) => {
    const p = at(e);
    const { size } = frame();
    const anchor = toMapPoint(viewRef.current, size, p.x, p.y);
    setView(viewAt(anchor, size, p.x, p.y, zoomOf(viewRef.current) * Math.exp(-e.deltaY / 400)));
  };
  // Après un glissement, le « clic » qui suit n'ouvre pas le café touché au départ.
  const onClickCapture = (e: ReactMouseEvent) => {
    if (dragged.current) {
      e.stopPropagation();
      dragged.current = false;
    }
  };

  return {
    svgRef,
    view,
    screen,
    handlers: { onPointerDown, onPointerMove, onPointerUp: onPointerEnd, onPointerCancel: onPointerEnd, onWheel, onClickCapture },
  };
}

/** Repère d'un café : rouge et animé s'il est ouvert, gris avec un cadenas sinon. */
function CafePin(props: { readonly cafe: TownCafe; readonly closedShown: boolean; readonly scale: number; readonly onPick: () => void }) {
  const { cafe, closedShown, scale, onPick } = props;
  const label = cafe.open ? `${cafe.fr} : entrer` : `${cafe.fr} : encore fermé`;
  const textX = cafe.labelSide === 'left' ? -22 : 22;
  const anchor = cafe.labelSide === 'left' ? 'end' : 'start';
  return (
    <g
      className={`town-pin${cafe.open ? ' town-pin--open' : ' town-pin--locked'}${closedShown ? ' town-pin--selected' : ''}`}
      // Les repères gardent la même taille à l'écran quand on zoome : seuls les cafés s'écartent.
      transform={`translate(${cafe.x} ${cafe.y}) scale(${scale})`}
      role="button"
      tabIndex={0}
      aria-label={label}
      onClick={onPick}
      onKeyDown={onKeyActivate(onPick)}
    >
      {/* Zone de toucher plus grande que le dessin (nom compris). */}
      <rect x={cafe.labelSide === 'left' ? -150 : -30} y={-62} width={180} height={70} className="town-pin__hit" />
      {cafe.open && <circle cy="-30" r="20" className="town-pin__pulse" />}
      <path d="M0 0 C-13 -14 -18 -22 -18 -30 A18 18 0 1 1 18 -30 C18 -22 13 -14 0 0 Z" className="town-pin__drop" />
      <text y="-23" className="town-pin__icon" textAnchor="middle">
        {cafe.open ? '☕' : '🔒'}
      </text>
      <text x={textX} y="-34" className="town-pin__name" textAnchor={anchor} lang="ar">
        {cafe.ar}
      </text>
      <text x={textX} y="-14" className="town-pin__fr" textAnchor={anchor}>
        {cafe.open ? `${cafe.fr} · entrer` : cafe.fr}
      </text>
      {closedShown && (
        <g className="town-pin__closed" transform="translate(0 -74)">
          <rect x="-82" y="-22" width="164" height="36" rx="18" />
          <text y="3" textAnchor="middle" lang="ar">
            🔒 {CLOSED_LINE}
          </text>
        </g>
      )}
    </g>
  );
}

/**
 * L'entrée du jeu : la carte de Oudhref (وذرف). On touche un café sur la carte : le Café Tarek
 * s'ouvre, les autres affichent « مازلنا مسكرين » (on n'a pas encore ouvert).
 */
export function TownMap({ savedRoom, busy, error, onResume, onEnter }: TownMapProps) {
  const [closed, setClosed] = useState<TownCafeId | null>(null);
  const { svgRef, view, screen, handlers } = useMapGestures();
  const zoom = zoomOf(view);
  // Taille des repères et des noms : celle d'un téléphone (≈ 0,74 pixel par unité du plan) ; jamais plus
  // gros sur un grand écran, et constante à l'écran quand on zoome.
  const pixelsPerUnit = Math.min(screen.width / view.width, screen.height / view.height);
  const labelScale = Math.min(1, PHONE_PIXELS_PER_UNIT / (pixelsPerUnit / zoom));
  // La bulle « مازلنا مسكرين » s'efface toute seule.
  useEffect(() => {
    if (!closed) return;
    const timer = setTimeout(() => setClosed(null), 3500);
    return () => clearTimeout(timer);
  }, [closed]);
  const pick = (cafe: TownCafe) => {
    if (cafe.open) onEnter(cafe.id);
    else setClosed(cafe.id);
  };
  // Dessinés en dernier (donc au-dessus) : le café dont la bulle est affichée, puis le Café Tarek.
  const pins = [...TOWN_CAFES].sort((a, b) => Number(a.id === closed) - Number(b.id === closed) || Number(a.open) - Number(b.open));

  return (
    <div className="home-cafe town">
      <BrandHeader place="Les cafés de Oudhref" />

      <div className="town__stage">
        <svg
          ref={svgRef}
          className="town__map"
          viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`}
          // Les routes s'affinent un peu quand on zoome (sinon elles deviennent énormes).
          style={{ '--zs': zoom ** 0.7 } as CSSProperties}
          {...handlers}
          preserveAspectRatio="xMidYMid meet"
          role="group"
          aria-label="Carte de Oudhref : touche un café pour y entrer"
        >
          {/* Le fond déborde largement : la carte remplit l'écran quelle que soit sa forme. */}
          <defs>
            {/* Les oliviers autour de la ville. */}
            <pattern id="town-olives" width="28" height="28" patternUnits="userSpaceOnUse">
              <circle cx="7" cy="7" r="4" className="town__olive" />
              <circle cx="21" cy="21" r="4" className="town__olive" />
            </pattern>
          </defs>
          <rect x="-1500" y="-1500" width="4200" height="3800" className="town__fields" />
          <rect x="-1500" y="-1500" width="4200" height="3800" fill="url(#town-olives)" />
          <path d={TOWN_AREA} className="town__city" />
          <path d={ROADS.river} className="town__river" />
          {PARKS.map((p) => (
            <ellipse key={`${p.cx}-${p.cy}`} {...p} className="town__park" />
          ))}
          {ROADS.small.map((d) => (
            <path key={d} d={d} className="town__street" />
          ))}
          {ROADS.big.map((d) => (
            <path key={d} d={d} className="town__street town__street--big" />
          ))}
          {/* Routes principales : un bord, puis la chaussée par-dessus. */}
          <path d={ROADS.c208} className="town__road-edge" />
          <path d={ROADS.p15} className="town__road-edge town__road-edge--main" />
          <path d={ROADS.avenue} className="town__road-edge town__road-edge--avenue" />
          <path d={ROADS.c208} className="town__road town__road--c208" />
          <path d={ROADS.p15} className="town__road town__road--main" />
          <path d={ROADS.avenue} className="town__road town__road--avenue" />
          <g className="town__shield" transform="translate(410 375) rotate(22)">
            <rect x="-20" y="-12" width="40" height="24" rx="5" />
            <text textAnchor="middle" y="5">
              P15
            </text>
          </g>
          <g className="town__shield town__shield--green" transform="translate(212 520)">
            <rect x="-24" y="-12" width="48" height="24" rx="5" />
            <text textAnchor="middle" y="5">
              C208
            </text>
          </g>
          {DISTRICTS.map((d) => (
            <g key={d.ar} className="town__district" transform={`translate(${d.x} ${d.y}) scale(${labelScale / zoom ** 0.5})`}>
              <text textAnchor="middle" lang="ar">
                {d.ar}
              </text>
              {d.fr && (
                <text textAnchor="middle" y="15" className="town__district-fr">
                  {d.fr}
                </text>
              )}
            </g>
          ))}
          <g transform={`translate(300 470) scale(${labelScale / zoom ** 0.5})`}>
            <text textAnchor="middle" className="town__title" lang="ar">
              وذرف
            </text>
            <text y="24" textAnchor="middle" className="town__subtitle">
              Oudhref
            </text>
          </g>
          {pins.map((cafe) => (
            <CafePin key={cafe.id} cafe={cafe} closedShown={closed === cafe.id} scale={labelScale / zoom} onPick={() => pick(cafe)} />
          ))}
        </svg>

        <p className="town__hint">Touche un café · pince pour zoomer</p>

        <div className="town__bottom">
          {savedRoom && (
            <div className="sheet__resume town__resume">
              <span>Tu as une partie en cours.</span>
              <button type="button" className="btn btn--primary" disabled={busy} onClick={() => onResume(savedRoom)}>
                Reprendre
              </button>
            </div>
          )}
          {error && (
            <p className="screen__error town__error" role="alert">
              {error}
            </p>
          )}
          <SiteFooter />
        </div>
      </div>
    </div>
  );
}
