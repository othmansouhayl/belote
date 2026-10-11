import { describe, expect, it } from 'vitest';
import { CAFE_LINES, bubbleDuration } from '../../src/ui/cafe/cafeLines.ts';
import { TAREK_END_LINE } from '../../src/ui/labels.ts';

describe('Les phrases du café', () => {
  it('Tarek, Nader et Mohamed Naceur ont leurs répliques', () => {
    expect(CAFE_LINES.tarek).toHaveLength(5);
    expect(CAFE_LINES.tarek).toContain(TAREK_END_LINE);
    expect(CAFE_LINES.nader).toHaveLength(4);
    expect(CAFE_LINES.naceur).toHaveLength(3);
  });

  it('les bulles longues restent plus longtemps, sans dépasser 7 secondes', () => {
    expect(bubbleDuration('يزي مالحس غادي')).toBeLessThan(bubbleDuration(CAFE_LINES.nader[1]!));
    expect(bubbleDuration('x'.repeat(500))).toBe(7000);
  });
});
