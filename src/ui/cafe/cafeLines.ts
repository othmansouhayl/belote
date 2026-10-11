import { TAREK_END_LINE } from '../labels.ts';

/**
 * Ce que disent les gens du café (bulle quand on les touche, et de temps en temps tout seuls).
 * Les phrases sont en tunisien, telles que données par les joueurs.
 */
export type CafeCharacter = 'tarek' | 'nader' | 'naceur';

export const CAFE_NAMES: Record<CafeCharacter, string> = {
  tarek: 'طارق · le patron 😠',
  nader: 'نادر · serveur',
  naceur: 'محمد ناصر · serveur',
};

export const CAFE_LINES: Record<CafeCharacter, readonly string[]> = {
  tarek: ['كالعادة؟ Tapis, ورقة و ستيلو؟', 'ڨازوز بارد ما فماش!!', 'يزي مالحس غادي', 'جماعة الفري فاير، حولو للمخزن..', TAREK_END_LINE],
  nader: [
    'لولاد.. شنو باش تشربو.. فيسع مزروب',
    'مزال واحد يطيش الزريعة في الوطا نكسر على راسه السبركة',
    'ما فماش تاي، نجيبلك capucin؟',
    'تعالى هز الولعة وحدك',
  ],
  naceur: ['بن عمي مازلت نسالك 3 آلاف متاع آمس', 'هي كملتوش الكارطة، الماتش باش يبدا', 'خلصوني باش نبدلو السرفيس'],
};

/** Le temps de lire la bulle : plus la phrase est longue, plus elle reste. */
export function bubbleDuration(line: string): number {
  return Math.min(7000, 2500 + line.length * 70);
}
