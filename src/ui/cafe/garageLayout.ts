/**
 * Plan du Café Garage (قهوة الڨراج), d'après la vue satellite, en mètres.
 * Repère : x d'ouest en est, z du nord (négatif) au sud (positif), y la hauteur.
 * Le café est au croisement de trois rues : la rue du milieu longe sa façade nord, la place
 * « الڨاراج » (qui lui a donné son nom) s'ouvre à l'est, une rue en diagonale arrive du nord-ouest
 * sur la place et une autre rue passe au sud, derrière le pâté de maisons.
 */
export const GARAGE = {
  /** La salle fermée : de x = -6 à 4, de z = -4,5 à 4,5. */
  room: { x0: -6, x1: 4, z0: -4.5, z1: 4.5 },
  wallHeight: 2.9,
  /** Devant l'entrée, côté place : une terrasse de 2 m, 20 cm plus haut que la rue. */
  entryTerrace: { x0: 4, x1: 6, z0: -4.5, z1: 4.5, height: 0.2 },
  /** Entrée principale : dans la façade est, elle ouvre sur la terrasse d'entrée et la place. */
  mainDoor: { x: 4, z0: -1.1, z1: 1.1 },
  /** Entrée secondaire, sur la rue du milieu (mur nord). */
  sideDoor: { z: -4.5, x0: -2.4, x1: -0.8 },
  /** Le poteau, en plein milieu de la salle. */
  pillar: { x: -1, z: 0, size: 0.4 },
  /** Le comptoir, le long du mur nord, entre les WC et la porte de côté (Khalifa derrière, côté mur). */
  counter: { z: -3.5, x0: -4.4, x1: -2.6, depth: 0.7 },
  /** Les WC, dans le coin nord-ouest. */
  toilets: { x0: -6, x1: -4.6, z0: -4.5, z1: -3.1 },
  /** La télé, accrochée au mur ouest. */
  tv: { z: -0.6, y: 1.9, width: 1.3 },
  /** La rue du milieu, devant la façade nord. */
  middleStreet: { z0: -8.3, z1: -4.6 },
  /** La place « الڨاراج », à l'est (en enrobé, comme les rues). */
  square: { x0: 6, x1: 17, z0: -11, z1: 7 },
  /** La rue du sud, derrière le pâté de maisons. */
  southStreet: { z0: 7.2, z1: 10.6 },
} as const;

/** Hauteur du sol : 20 cm sur la terrasse d'entrée, au niveau de la rue partout ailleurs. */
export function garageGroundAt(x: number, z: number): number {
  const t = GARAGE.entryTerrace;
  return x >= t.x0 && x <= t.x1 && z >= t.z0 && z <= t.z1 ? t.height : 0;
}

export interface GarageTable {
  readonly x: number;
  readonly z: number;
}

/** Les 2 tables de belote du Café Garage (elles ouvriront au jeu en ligne). */
export const GARAGE_BELOTE_TABLES: readonly GarageTable[] = [
  { x: 2.6, z: 2.4 },
  { x: -2.6, z: 2.6 },
];

/** Petites tables de la salle, pour les habitués (2 chaises chacune, côté nord et sud). */
export const GARAGE_SMALL_TABLES: readonly GarageTable[] = [
  { x: 3.0, z: -2.6 },
  { x: 0.5, z: -2.9 },
  { x: -4.9, z: 2.9 },
];

/** Les 4 tables laissées dehors, sur la place, devant la terrasse d'entrée (chaises à l'est et à l'ouest). */
export const GARAGE_PLACE_TABLES: readonly GarageTable[] = [
  { x: 7.8, z: -3.0 },
  { x: 9.7, z: -1.2 },
  { x: 7.9, z: 2.3 },
  { x: 9.9, z: 3.6 },
];

/** Où se tient Khalifa : derrière son comptoir, dos au mur nord. */
export const KHALIFA_SPOT = { x: -3.5, z: -4.12 } as const;

/** La tournée de Rochdi (toujours pressé) : comptoir, salle, puis dehors par l'entrée principale. */
export const ROCHDI_ROUND: readonly { readonly x: number; readonly z: number; readonly pause?: number }[] = [
  { x: -3.4, z: -2.7, pause: 1.5 },
  { x: -2.2, z: -1.6 },
  { x: 1.1, z: -2.9, pause: 1.2 },
  { x: 2.4, z: -1.6 },
  { x: 2.45, z: -2.6, pause: 1 },
  { x: 3.0, z: -0.3 },
  { x: 4.0, z: 0 },
  { x: 5.0, z: 0 },
  { x: 6.6, z: 0 },
  { x: 7.8, z: -2.35, pause: 1.2 },
  { x: 9.0, z: -0.4, pause: 1 },
  { x: 8.0, z: 1.65, pause: 1.2 },
  { x: 6.6, z: 0.3 },
  { x: 5.0, z: 0.3 },
  { x: 3.6, z: 0.4 },
  { x: 2.6, z: 1.3, pause: 1 },
  { x: 0.4, z: 1.3 },
  { x: -2.4, z: 1.0 },
  { x: -3.0, z: -1.8 },
];

/** Vue de départ : au-dessus de la place, côté nord-est, pour voir la salle, la terrasse d'entrée et la place. */
export const GARAGE_VIEW = { camera: [16, 14, -8.5], target: [3.2, 0, 0] } as const;
