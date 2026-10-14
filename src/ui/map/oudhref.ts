/**
 * Carte de Oudhref (وذرف), redessinée d'après le plan de la ville : routes, avenue principale,
 * oued, jardins et les cafés où l'on joue. Coordonnées dans le repère du plan (1193 × 753),
 * nord en haut.
 */

/** La zone toujours visible (les cafés et leurs noms) ; autour, la carte continue jusqu'aux bords de l'écran. */
export const MAP_VIEW = { x: 250, y: 200, width: 560, height: 360 } as const;

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
  /** De quel côté du repère s'affiche le nom (pour ne pas chevaucher les autres). */
  readonly labelSide: 'left' | 'right';
}

export const TOWN_CAFES: readonly TownCafe[] = [
  // Au bout de l'avenue, au croisement avec la P15 (Cité Assalam).
  { id: 'tarek', ar: 'قهوة طارق', fr: 'Café Tarek', x: 716, y: 494, open: true, labelSide: 'left' },
  // Au coin où l'avenue tourne vers la rue du 13 Août.
  { id: 'garage', ar: 'قهوة الڨراج', fr: 'Café Garage', x: 566, y: 318, open: false, labelSide: 'right' },
  // À l'ouest, au départ de l'avenue sur la P15 (حي خير الدين).
  { id: 'chouaa', ar: 'قهوة الشعاع', fr: 'Café Chouâa', x: 330, y: 340, open: false, labelSide: 'right' },
  // Au nord, près du jardin et du marché.
  { id: 'souk', ar: 'قهوة السوق', fr: 'Café du Souk', x: 486, y: 274, open: false, labelSide: 'left' },
];

/** Ce qu'on lit sur la porte d'un café pas encore ouvert. */
export const CLOSED_LINE = 'مازلنا مسكرين';

/** Les tracés, en commandes SVG. */
export const ROADS = {
  // Route nationale P15 : du nord-ouest au sud-est, puis vers le sud après Cité Assalam.
  p15: 'M-40 60 L60 166 L165 283 L290 326 L465 398 L650 460 L705 482 L728 506 L800 640 L860 760 L900 840',
  // Route C208 : part de la P15 près du Café Amir et descend vers le sud.
  c208: 'M150 280 L205 480 L235 590 L262 700 L280 840',
  // L'avenue principale (en bleu sur le plan) : de la P15 à l'ouest jusqu'au Café Tarek, par le Café Garage.
  avenue: 'M284 333 L360 330 L450 330 L520 323 L566 318 L592 348 L622 386 L662 432 L700 476 L716 494',
  // Grandes rues de la ville.
  big: [
    'M596 380 L760 352 L900 330 L1060 305 L1240 280',
    'M566 318 L540 270 L520 236 L505 190',
    'M450 330 L452 270 L470 225',
    'M592 348 L700 300 L820 250 L960 210',
    'M465 398 L455 470 L440 560 L430 660',
  ],
  // Petites rues (le quadrillage, simplifié).
  small: [
    'M180 200 L330 180 L470 190',
    'M215 260 L330 250 L452 270',
    'M230 380 L380 360',
    'M240 440 L360 420 L455 470',
    'M250 510 L440 560',
    'M270 600 L430 660',
    'M330 340 L340 420 L360 520',
    'M390 330 L395 250 L410 180',
    'M520 323 L540 420 L560 520 L570 620',
    'M622 386 L640 470',
    'M700 300 L740 420 L780 560',
    'M760 352 L820 520',
    'M820 250 L860 340 L900 480',
    'M900 330 L960 500',
    'M505 190 L620 175 L760 165 L900 180',
    'M560 560 L700 600 L800 640',
    'M650 460 L620 560 L600 640',
    'M960 210 L990 300 L990 450',
    'M330 60 L360 130 L390 180',
    'M470 28 L470 110 L470 190',
    'M600 70 L560 130 L520 160',
    'M300 110 L420 100 L560 110 L680 140',
    'M240 160 L400 140',
    'M300 650 L460 610 L560 640',
    'M380 700 L400 600 L420 520',
    'M700 640 L740 560',
  ],
  // L'oued au nord-est.
  river: 'M590 18 C640 50 700 72 770 62 C840 52 900 22 1010 6',
};

/** La ville (zone bâtie, du quartier de Sidi Taher au nord à Cité Assalam au sud) et les jardins. */
export const TOWN_AREA =
  'M160 240 L225 130 L330 60 L470 28 L600 70 L700 130 L900 160 L985 240 L1000 520 L900 620 L780 690 L600 720 L430 700 L300 700 L230 610 L190 440 L165 320 Z';
export const PARKS = [
  { cx: 488, cy: 318, rx: 32, ry: 18 },
  { cx: 530, cy: 252, rx: 14, ry: 18 },
];

/** Quelques quartiers, écrits en petit sur la carte (là où ils ne gênent pas les cafés). */
export const DISTRICTS: readonly { readonly ar: string; readonly fr?: string; readonly x: number; readonly y: number }[] = [
  { ar: 'زاوية سيدي الطاهر', fr: 'Zaouiet Sidi Taher', x: 470, y: 70 },
  { ar: 'حي السلام', fr: 'Cité Assalam', x: 640, y: 560 },
  { ar: 'حي التحرير', fr: 'Cité Tahrir', x: 330, y: 560 },
  { ar: 'حي المزارع', x: 880, y: 230 },
  { ar: 'حي الكرامة', x: 760, y: 420 },
  { ar: 'حي الإردهار', x: 520, y: 470 },
];
