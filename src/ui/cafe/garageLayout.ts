/**
 * Plan du Café Garage (قهوة الڨراج), d'après la vue satellite, en mètres.
 * Repère : x d'ouest en est, z du nord (négatif) au sud (positif), y la hauteur.
 * Le café est au croisement de trois rues : la rue du milieu longe sa façade nord, la place
 * « الڨاراج » (qui lui a donné son nom) s'ouvre à l'est, une rue en diagonale arrive du nord-ouest
 * sur la place et une autre rue passe au sud, derrière le pâté de maisons.
 */
export const GARAGE = {
  /** Salle : de x = -6 à 6, de z = -4,5 à 4,5. */
  halfWidth: 6,
  halfDepth: 4.5,
  wallHeight: 2.9,
  /** Entrée principale, sur la place (mur est). */
  mainDoor: { x: 6, z0: -1.1, z1: 1.1 },
  /** Entrée secondaire, sur la rue du milieu (mur nord). */
  sideDoor: { z: -4.5, x0: -2.4, x1: -0.8 },
  /** Le poteau, en plein milieu de la salle. */
  pillar: { x: 0, z: 0, size: 0.4 },
  /** Le comptoir tout au fond à droite en entrant par la place : contre le mur ouest, côté nord. */
  counter: { x: -5.15, z0: -4.1, z1: -0.9, depth: 0.7 },
  /** La rue du milieu, devant la façade nord (la terrasse est posée dessus). */
  middleStreet: { z0: -8.3, z1: -4.6 },
  /** La place « الڨاراج », à l'est. */
  square: { x0: 6.1, x1: 17, z0: -11, z1: 7 },
  /** La rue du sud, derrière le pâté de maisons. */
  southStreet: { z0: 7.2, z1: 10.6 },
} as const;

export interface GarageTable {
  readonly x: number;
  readonly z: number;
}

/** Les 2 tables de belote du Café Garage (elles ouvriront au jeu en ligne). */
export const GARAGE_BELOTE_TABLES: readonly GarageTable[] = [
  { x: 2.7, z: 2.4 },
  { x: -1.9, z: 2.6 },
];

/** Petites tables de la salle, pour les habitués (2 chaises chacune, côté nord et sud). */
export const GARAGE_SMALL_TABLES: readonly GarageTable[] = [
  { x: 3.1, z: -2.6 },
  { x: 0.4, z: -2.9 },
  { x: -4.4, z: 2.9 },
];

/** La terrasse : 4 tables laissées sur la rue du milieu, le long de la façade (chaises à l'est et à l'ouest). */
export const GARAGE_TERRACE: readonly GarageTable[] = [
  { x: -4.4, z: -6.1 },
  { x: 0.7, z: -6.3 },
  { x: 2.9, z: -6.1 },
  { x: 5.0, z: -6.3 },
];

/** Où se tient Khalifa : derrière son comptoir. */
export const KHALIFA_SPOT = { x: -5.62, z: -2.5 } as const;

/** La tournée de Rochdi (toujours pressé) : comptoir, salle, terrasse par la porte de côté, place. */
export const ROCHDI_ROUND: readonly { readonly x: number; readonly z: number; readonly pause?: number }[] = [
  { x: -4.4, z: -1.6, pause: 1.5 },
  { x: -2.2, z: -1.4 },
  { x: 1.05, z: -2.9, pause: 1.2 },
  { x: 1.6, z: -1.0 },
  { x: 3.75, z: -2.6, pause: 1.2 },
  { x: 4.4, z: 0.4 },
  { x: 2.7, z: 1.3, pause: 1 },
  { x: 0.9, z: 1.0 },
  { x: -0.9, z: 1.0 },
  { x: -1.6, z: -1.2 },
  { x: -1.6, z: -3.9 },
  { x: -1.6, z: -5.2 },
  { x: 0.7, z: -5.4, pause: 1.2 },
  { x: 2.9, z: -5.3 },
  { x: 5.0, z: -5.4, pause: 1.2 },
  { x: 2.0, z: -5.2 },
  { x: -1.6, z: -5.1 },
  { x: -1.6, z: -3.6 },
  { x: -3.4, z: -1.8 },
];

/** Vue de départ : au-dessus de la place, côté nord-est, pour voir la salle, la terrasse sur la rue et la place. */
export const GARAGE_VIEW = { camera: [13.5, 13.5, -11], target: [1.2, 0, -1.6] } as const;
