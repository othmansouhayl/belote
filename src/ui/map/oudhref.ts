/**
 * Carte simplifiée de Oudhref (وذرف) : les grandes routes et les cafés où l'on joue.
 * Coordonnées dans le repère du dessin (viewBox 0 0 360 440), nord en haut.
 */
export const MAP_SIZE = { width: 360, height: 440 } as const;

export type TownCafeId = 'tarek' | 'garage' | 'chouaa' | 'souk';

export interface TownCafe {
  readonly id: TownCafeId;
  /** Nom en arabe (tunisien) et en français. */
  readonly ar: string;
  readonly fr: string;
  readonly x: number;
  readonly y: number;
  /** Ouvert : on peut y entrer et jouer. Sinon, « مازلنا مسكرين ». */
  readonly open: boolean;
  /** De quel côté du repère s'affiche le nom (pour ne pas sortir de la carte). */
  readonly labelSide: 'left' | 'right';
}

export const TOWN_CAFES: readonly TownCafe[] = [
  { id: 'tarek', ar: 'قهوة طارق', fr: 'Café Tarek', x: 296, y: 322, open: true, labelSide: 'left' },
  { id: 'garage', ar: 'قهوة الڨراج', fr: 'Café Garage', x: 214, y: 152, open: false, labelSide: 'right' },
  { id: 'chouaa', ar: 'قهوة الشعاع', fr: 'Café Chouâa', x: 98, y: 178, open: false, labelSide: 'right' },
  { id: 'souk', ar: 'قهوة السوق', fr: 'Café du Souk', x: 168, y: 92, open: false, labelSide: 'left' },
];

/** Ce qu'on lit sur la porte d'un café pas encore ouvert. */
export const CLOSED_LINE = 'مازلنا مسكرين';
