/**
 * Zoom et déplacement de la carte avec les doigts : calculs purs (sans navigateur).
 * La « vue » est la zone du plan affichée (le viewBox du SVG, centré, sans déformation).
 */
import { MAP_VIEW } from './oudhref.ts';

export interface MapViewBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface ScreenSize {
  readonly width: number;
  readonly height: number;
}

/** Zoom de 1 (toute la ville) à 3 (deux cafés voisins bien séparés). */
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 3;
/** Le centre de la vue reste sur la ville (on ne se perd pas dans les champs). */
const CENTER_BOUNDS = { minX: 200, maxX: 1000, minY: 120, maxY: 680 } as const;

export const INITIAL_VIEW: MapViewBox = { ...MAP_VIEW };

/** Échelle (pixels par unité du plan) et marges, comme le fait le SVG avec « xMidYMid meet ». */
function fit(view: MapViewBox, size: ScreenSize) {
  const k = Math.min(size.width / view.width, size.height / view.height);
  return { k, offsetX: (size.width - view.width * k) / 2, offsetY: (size.height - view.height * k) / 2 };
}

/** Le point du plan qui est sous un point de l'écran (en pixels dans la carte). */
export function toMapPoint(view: MapViewBox, size: ScreenSize, px: number, py: number) {
  const { k, offsetX, offsetY } = fit(view, size);
  return { x: view.x + (px - offsetX) / k, y: view.y + (py - offsetY) / k };
}

export function zoomOf(view: MapViewBox): number {
  return MAP_VIEW.width / view.width;
}

/** Garde le zoom entre ses limites et le centre de la vue sur la ville. */
export function clampView(view: MapViewBox): MapViewBox {
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoomOf(view)));
  const width = MAP_VIEW.width / zoom;
  const height = MAP_VIEW.height / zoom;
  const cx = Math.min(CENTER_BOUNDS.maxX, Math.max(CENTER_BOUNDS.minX, view.x + view.width / 2));
  const cy = Math.min(CENTER_BOUNDS.maxY, Math.max(CENTER_BOUNDS.minY, view.y + view.height / 2));
  return { x: cx - width / 2, y: cy - height / 2, width, height };
}

/**
 * La vue telle que le point du plan `anchor` se retrouve sous le point de l'écran (px, py),
 * avec le zoom demandé. Sert au pincement (deux doigts), au déplacement (un doigt) et à la molette.
 */
export function viewAt(anchor: { x: number; y: number }, size: ScreenSize, px: number, py: number, zoom: number): MapViewBox {
  const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
  const width = MAP_VIEW.width / z;
  const height = MAP_VIEW.height / z;
  const { k, offsetX, offsetY } = fit({ x: 0, y: 0, width, height }, size);
  return clampView({ x: anchor.x - (px - offsetX) / k, y: anchor.y - (py - offsetY) / k, width, height });
}
