/**
 * Plan du Café Tarek d'après la maquette (20 m × 5 m), en mètres.
 * Repère : l'entrée est en z = 0, le fond (porte de garage) en z = -20 ;
 * x va du mur de gauche (-2,5) au mur de droite (+2,5) quand on entre ; y est la hauteur.
 */
export const CAFE = {
  width: 5,
  length: 20,
  wallHeight: 2.6,
  /** Début de la salle du fond, surélevée de 20 cm. */
  stepZ: -12.5,
  stepHeight: 0.2,
  terraceDepth: 4.5,
} as const;

export type SeatSide = 'south' | 'east' | 'north' | 'west';

/**
 * Place 0 côté entrée, puis dans le sens de jeu (anti-horaire vu du dessus) :
 * la place suivante est à droite du joueur.
 */
export const SEAT_SIDES: readonly SeatSide[] = ['south', 'east', 'north', 'west'];

export interface TableSpot {
  readonly number: number;
  readonly x: number;
  readonly z: number;
}

/** Les 6 tables de belote de la salle du fond, près de la télé (numérotées depuis la marche). */
export const BELOTE_TABLES: readonly TableSpot[] = [
  { number: 1, x: -1.2, z: -15.3 },
  { number: 2, x: 1.2, z: -15.3 },
  { number: 3, x: -1.2, z: -17.0 },
  { number: 4, x: 1.2, z: -17.0 },
  { number: 5, x: -1.2, z: -18.7 },
  { number: 6, x: 1.2, z: -18.7 },
];

/** Table de la terrasse, dehors devant l'entrée : la partie contre les bots. */
export const TERRACE_TABLE = { x: -1.2, z: 2.0 } as const;

/**
 * Terrasse sur palier, dehors le long du mur de droite (2 m de large, toute la longueur du café) :
 * +50 cm sur les 10 premiers mètres, +70 cm sur les 10 suivants (une marche de 20 cm au milieu).
 */
export const SIDE_TERRACE = {
  x0: CAFE.width / 2 + 0.2,
  x1: CAFE.width / 2 + 2.2,
  splitZ: -10,
  frontHeight: 0.5,
  backHeight: 0.7,
  /** Escalier devant, sur le trottoir, pour monter sur la terrasse. */
  stairs: { x1: CAFE.width / 2 + 1.4, depth: 0.9 },
  /** Marches qui descendent vers la 2e entrée du café (ouverture dans le mur de droite). */
  sideDoor: { from: -11.3, to: -12.3, x1: CAFE.width / 2 + 1.1 },
  /** Tables de la terrasse (2 chaises chacune) ; la première est celle du patron. */
  tableX: CAFE.width / 2 + 1.45,
  tables: [-2.2, -5.3, -8.4, -14.0, -16.6, -19.1],
} as const;

/** Hauteur du sol à un endroit (café, salle du fond, terrasse sur palier, escaliers). */
export function groundAt(x: number, z: number): number {
  const t = SIDE_TERRACE;
  if (x >= t.x0 && x <= t.x1) {
    // Escalier de devant : on monte en pente douce (plus fluide à l'écran que marche par marche).
    if (z > 0 && z <= t.stairs.depth) return x <= t.stairs.x1 ? t.frontHeight * (1 - z / t.stairs.depth) : 0;
    if (z <= 0 && z >= -CAFE.length) {
      if (z <= t.sideDoor.from && z >= t.sideDoor.to && x < t.sideDoor.x1) {
        return t.backHeight * ((x - t.x0) / (t.sideDoor.x1 - t.x0));
      }
      return z > t.splitZ ? t.frontHeight : t.backHeight;
    }
    return 0;
  }
  return Math.abs(x) <= CAFE.width / 2 && z < CAFE.stepZ && z >= -CAFE.length ? CAFE.stepHeight : 0;
}

/** Les deux points de vue : l'entrée (comptoir) et le fond du café (télé, tables de belote). */
export const VIEWPOINTS = {
  // Assez haut pour voir par-dessus l'enseigne, un peu à droite pour voir la terrasse sur palier.
  entrance: { camera: [1.1, 12.6, 7.6], target: [0.85, 0, -4.6] },
  back: { camera: [0.8, 9.4, -10.2], target: [0.8, 0.2, -16.3] },
} as const;

export type Viewpoint = keyof typeof VIEWPOINTS;

/** Décalage d'une chaise par rapport au centre de sa table. */
export function seatOffset(side: SeatSide, distance: number): { dx: number; dz: number; rotation: number } {
  switch (side) {
    case 'south':
      return { dx: 0, dz: distance, rotation: 0 };
    case 'north':
      return { dx: 0, dz: -distance, rotation: Math.PI };
    case 'east':
      return { dx: distance, dz: 0, rotation: Math.PI / 2 };
    case 'west':
      return { dx: -distance, dz: 0, rotation: -Math.PI / 2 };
  }
}
