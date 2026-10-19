import { DRINKS } from '../../server/types.ts';
import type { Drink } from '../../server/types.ts';

/** Noms affichés des boissons du Café Tarek. */
export const DRINK_LABELS: Record<Drink, string> = {
  express: 'Express',
  tey: 'Tey',
  capucin: 'Capucin',
  allonge: 'Allongé',
  chicha: 'Chicha',
  filtre: 'Filtre',
};

/** Les mêmes, comme Nader les dit (pour sa phrase en tunisien). */
export const DRINK_AR: Record<Drink, string> = {
  express: 'إكسبريس',
  tey: 'تاي',
  capucin: 'كابوسان',
  allonge: 'ألونجي',
  chicha: 'شيشة',
  filtre: 'فيلتر',
};

/** Ce que Nader dit à chacun en posant la mauvaise boisson devant lui. */
export function naderDrinkLine(ordered: Drink, served: Drink): string {
  return `مافماش ${DRINK_AR[ordered]} جبتلك ${DRINK_AR[served]} .. موش عاجبك معادش تجي`;
}

/** À 1000 points, Nader passe presser la table : une de ces deux phrases (avec sa traduction). */
export const NADER_HURRY_LINES = [
  { ar: 'لاولاد هي فيسع بش نسكرو', fr: 'Allez les gars, vite, on va fermer !' },
  { ar: 'ديما خاسرين انتم ..', fr: 'Toujours perdants, vous…' },
] as const;

/** La phrase de Nader à 1000 points : la même sur les 4 téléphones (tirée à partir de la table et de la manche). */
export function naderHurryLine(key: string): (typeof NADER_HURRY_LINES)[number] {
  return NADER_HURRY_LINES[hash(`${key}:presse`) % NADER_HURRY_LINES.length]!;
}

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  // Brassage final : deux clés voisines donnent des résultats bien différents.
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** La mauvaise boisson que Nader apporte à celui qui n'a pas de chance : jamais celle qu'il a commandée. */
export function servedDrink(ordered: Drink, key: string): Drink {
  const others = DRINKS.filter((d) => d !== ordered);
  return others[hash(`${key}:${ordered}`) % others.length]!;
}

/** La place qui reçoit la mauvaise boisson : une seule par table, tirée à partir de la table et de la manche. */
export function unluckySeat(ordered: Partial<Record<number, Drink>>, key: string): number | null {
  const seats = Object.keys(ordered)
    .map(Number)
    .filter((seat) => ordered[seat])
    .sort((a, b) => a - b);
  return seats.length === 0 ? null : seats[hash(`${key}:malchanceux`) % seats.length]!;
}

/**
 * Ce que Nader apporte vraiment : il se trompe pour **une seule** personne de la table, les autres
 * ont ce qu'elles ont commandé. Le même résultat sur les 4 téléphones (calculé à partir de la table
 * et de la manche), sans passer par le serveur.
 */
export function servedDrinks(ordered: Partial<Record<number, Drink>>, key: string): Partial<Record<number, Drink>> {
  const unlucky = unluckySeat(ordered, key);
  const served: Partial<Record<number, Drink>> = {};
  for (const [seat, drink] of Object.entries(ordered)) {
    if (drink) served[Number(seat)] = Number(seat) === unlucky ? servedDrink(drink, `${key}:${seat}`) : drink;
  }
  return served;
}
