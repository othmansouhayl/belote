/**
 * Plan du Café Chouâa (قهوة الشعاع), relevé dans la maquette Revit « rayon.ifc », en mètres.
 * Repère : celui du fichier (x d'ouest en est), mais z = −y du fichier : z va du nord (négatif)
 * au sud (positif), y est la hauteur. Le café fait l'angle de deux rues : la rue principale au sud
 * (l'entrée principale donne dessus) et une rue de côté à l'est (les 8 petites fenêtres) ; la porte
 * d'angle est dans le pan coupé, au sud-est.
 */
export const CHOUAA = {
  /** La salle : 11,90 m × 13,70 m (intérieur des murs de 20 cm). */
  room: { x0: -5.68, x1: 6.22, z0: -7.31, z1: 6.39 },
  wallHeight: 2.75,
  wallThickness: 0.2,
  /** L'estrade du fond : 25 cm plus haut, sur toute la largeur. */
  estrade: { z0: -7.31, z1: -4.46, height: 0.25 },
  /** Le comptoir en L, posé sur l'estrade (0,95 m au-dessus d'elle) : le long de l'estrade, puis un retour vers le mur. */
  counter: {
    front: { x0: 1.01, x1: 6.22, z0: -5.21, z1: -4.46 },
    back: { x0: 1.01, x1: 1.72, z0: -6.81, z1: -5.21 },
    height: 0.95,
  },
  /** Les WC, dans le coin nord-ouest (sur l'estrade et un peu au-delà). */
  toilets: { x0: -5.68, x1: -4.37, z0: -7.31, z1: -4.18, height: 2.2 },
  /** Les 4 poteaux porteurs (20 × 20 cm). */
  pillars: [
    { x: -1.78, z: 1.09 },
    { x: 1.12, z: 1.09 },
    { x: -1.78, z: -4.61 },
    { x: 1.12, z: -4.61 },
  ],
  pillarSize: 0.2,
  /** Entrée principale ⑦ : une ouverture de 2,56 m dans la façade sud, sur la rue principale. */
  mainDoor: { z: 6.49, x0: 1.92, x1: 4.48 },
  /** Porte d'angle ⑧, dans le pan coupé du coin sud-est. */
  cornerDoor: { a: { x: 5.15, z: 6.2 }, b: { x: 6.06, z: 5.13 } },
  /** Fin du mur est, au début du pan coupé. */
  eastWallEnd: 5.09,
  /** Les 8 petites fenêtres (0,60 × 0,95 m) du mur est, sur la rue de côté : leur centre en z. */
  eastWindows: [-5.91, -4.11, -2.81, -1.71, -0.51, 1.29, 2.89, 3.79],
  /** Les 2 fenêtres de la façade sud, côté ouest : leur centre en x. */
  southWindows: [-4.83, -3.98],
  window: { width: 0.6, sill: 0.8, top: 1.75 },
  /** Le trottoir de 1,50 m le long de la façade sud (12 cm de bordure), puis la rue principale. */
  sidewalk: { z0: 6.59, z1: 8.09, height: 0.12 },
  /** Le trottoir de la rue de côté, le long du mur est. */
  sideSidewalk: { x0: 6.42, x1: 7.9 },
  mainStreet: { z0: 8.09, z1: 15.5 },
  /** La rue de côté, à l'est. */
  sideStreet: { x0: 7.9, x1: 14.5 },
  /** Le bâtiment voisin, collé au mur ouest (3 m de haut). */
  neighbour: { x0: -8.8, x1: -5.88, z0: -7.41, z1: 6.59, height: 3 },
  /** La télé, suspendue au plafond contre la façade sud (entre les fenêtres et l'entrée), tournée vers le fond. */
  tv: { x: -1.0, y: 2.1, z: 6.15, width: 1.3 },
} as const;

/** Hauteur du sol : 25 cm sur l'estrade, 12 cm sur les trottoirs, au niveau de la rue partout ailleurs (la salle aussi). */
export function chouaaGroundAt(x: number, z: number): number {
  const { room, estrade, sidewalk, sideSidewalk } = CHOUAA;
  if (x >= room.x0 && x <= room.x1 && z >= estrade.z0 && z <= estrade.z1) return estrade.height;
  const onSouth = z >= sidewalk.z0 && z <= sidewalk.z1 && x >= room.x0 - 3.2 && x <= sideSidewalk.x1;
  const onEast = x >= sideSidewalk.x0 && x <= sideSidewalk.x1 && z >= room.z0 - 0.1 && z <= sidewalk.z1;
  return onSouth || onEast ? sidewalk.height : 0;
}

/** Comment les chaises sont placées autour d'une table : tout autour, au nord et au sud, ou à l'est et à l'ouest. */
export type ChairLayout = 'four' | 'ns' | 'ew';

export interface ChouaaTable {
  readonly x: number;
  readonly z: number;
  readonly chairs: ChairLayout;
}

/** Les petites tables (70 cm) : chaises à 55 cm du centre. Les tables de belote (95 cm) : chaises à 68 cm. */
export const SMALL_TABLE = { size: 0.7, chairDistance: 0.55 } as const;
export const BELOTE_TABLE = { size: 0.95, chairDistance: 0.68 } as const;

/** Les 2 tables dédiées à la belote, au milieu de la salle (entre les poteaux) : elles ouvriront au jeu plus tard. */
export const CHOUAA_BELOTE_TABLES: readonly { readonly x: number; readonly z: number }[] = [
  { x: -0.33, z: -1.6 },
  { x: -0.33, z: 3.6 },
];

const grid = (xs: readonly number[], zs: readonly number[], chairs: ChairLayout): ChouaaTable[] =>
  xs.flatMap((x) => zs.map((z) => ({ x, z, chairs })));
const ROWS = [-2.5, -0.75, 1.0, 2.75, 4.5];

/**
 * Toutes les autres tables : le café est toujours encombré. Dans la salle, des rangées serrées ; un
 * couloir reste libre de l'entrée principale au comptoir, et une allée devant l'estrade. Dehors, la
 * terrasse le long de la façade sud. (Les tables hautes de l'estrade sont à part, plus bas.)
 */
export const CHOUAA_TABLES: readonly ChouaaTable[] = [
  // Salle, côté ouest : 2 colonnes de tables à 4 chaises.
  ...grid([-4.85, -3.1], ROWS, 'four'),
  // Au milieu, entre les deux tables de belote, et contre la façade sud (sous la télé).
  { x: -0.33, z: 1.0, chairs: 'ns' },
  { x: -0.33, z: 5.6, chairs: 'ew' },
  // Entre les poteaux de l'est et le couloir de l'entrée.
  ...grid([1.9], ROWS, 'ns'),
  // Le long des 8 fenêtres de la rue de côté.
  ...grid([5.3], [-2.6, -0.9, 0.8, 2.5, 4.2], 'ns'),
  // La terrasse : sur le trottoir de la rue principale, à l'ouest de l'entrée (rien côté rue de côté).
  ...grid([-6.4, -4.6, -2.8, -1.0, 0.8], [7.35], 'ew'),
];

/**
 * Sur l'estrade, à gauche du comptoir : des tables hautes (1,05 m), deux tabourets hauts à l'est et à
 * l'ouest, et de la place au nord et au sud pour ceux qui restent debout.
 */
export const HIGH_TABLE = { size: 0.6, height: 1.05, stoolDistance: 0.5, stoolSeat: 0.75 } as const;
export const CHOUAA_HIGH_TABLES: readonly { readonly x: number; readonly z: number }[] = [
  { x: -3.5, z: -5.85 },
  { x: -2.0, z: -5.85 },
  { x: -0.55, z: -5.85 },
];

/** L'emprise d'une table haute : ses tabourets à l'est et à l'ouest, les gens debout au nord et au sud. */
export function highTableFootprint(t: { readonly x: number; readonly z: number }) {
  const rx = HIGH_TABLE.stoolDistance + 0.2;
  const rz = 0.75;
  return { x0: t.x - rx, x1: t.x + rx, z0: t.z - rz, z1: t.z + rz };
}

/** Les clients debout au comptoir (côté salle, à droite du couloir de l'entrée). */
export const COUNTER_STANDING: readonly { readonly x: number; readonly z: number }[] = [
  { x: 4.6, z: -4.1 },
  { x: 5.5, z: -4.1 },
];

/** L'emprise d'une table avec ses chaises (vue de dessus). */
export function tableFootprint(t: { readonly x: number; readonly z: number; readonly chairs: ChairLayout }, belote = false) {
  const { size, chairDistance } = belote ? BELOTE_TABLE : SMALL_TABLE;
  const reach = chairDistance + 0.25;
  const rx = t.chairs === 'ns' ? size / 2 : reach;
  const rz = t.chairs === 'ew' ? size / 2 : reach;
  return { x0: t.x - rx, x1: t.x + rx, z0: t.z - rz, z1: t.z + rz };
}

/**
 * La tournée de Nizar, le serveur : la machine à café derrière le comptoir (par le petit passage le
 * long du mur du fond), les tables hautes de l'estrade, l'allée devant l'estrade, le couloir de l'entrée,
 * la terrasse de la rue principale (il passe au bord de la chaussée), et retour au comptoir.
 */
export const NIZAR_ROUND: readonly { readonly x: number; readonly z: number; readonly pause?: number }[] = [
  { x: 3.6, z: -6.1, pause: 2.5 },
  { x: 2.4, z: -7.05 },
  { x: 0.5, z: -7.05 },
  { x: 0.4, z: -4.9, pause: 1 },
  { x: 0.4, z: -3.85 },
  { x: -4.0, z: -3.85, pause: 1.2 },
  { x: 3.3, z: -3.85 },
  { x: 3.3, z: 1.0, pause: 1 },
  { x: 3.3, z: 6.0 },
  { x: 3.2, z: 7.4, pause: 1.2 },
  { x: 2.0, z: 8.45 },
  { x: -5.5, z: 8.45, pause: 1.2 },
  { x: 2.0, z: 8.45 },
  { x: 3.2, z: 7.4 },
  { x: 3.3, z: 5.5 },
  { x: 3.3, z: -3.85 },
  { x: 0.4, z: -3.85 },
  { x: 0.45, z: -7.05 },
  { x: 2.4, z: -7.05 },
];

/** Vue de départ : au-dessus du carrefour, côté sud-est, pour voir la façade, la salle et le comptoir. */
export const CHOUAA_VIEW = { camera: [12, 15, 17], target: [0.3, 0, -0.6] } as const;
