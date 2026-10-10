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
export const TERRACE_TABLE = { x: -1.4, z: 2.0 } as const;

/** Les deux points de vue : l'entrée (comptoir) et le fond du café (télé, tables de belote). */
export const VIEWPOINTS = {
  entrance: { camera: [0.6, 8.5, 7.2], target: [0, 0, -3.5] },
  back: { camera: [0, 9.4, -10.4], target: [0, 0.2, -16.3] },
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
