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

/**
 * Ce que Nader apporte vraiment : jamais ce qui a été commandé (il oublie toujours).
 * Le même pour les 4 joueurs (calculé à partir de la table et de la manche), sans passer par le serveur.
 */
export function servedDrink(ordered: Drink, key: string): Drink {
  const others = DRINKS.filter((d) => d !== ordered);
  return others[hash(`${key}:${ordered}`) % others.length]!;
}

export function servedDrinks(ordered: Partial<Record<number, Drink>>, key: string): Partial<Record<number, Drink>> {
  const served: Partial<Record<number, Drink>> = {};
  for (const [seat, drink] of Object.entries(ordered)) if (drink) served[Number(seat)] = servedDrink(drink, `${key}:${seat}`);
  return served;
}
