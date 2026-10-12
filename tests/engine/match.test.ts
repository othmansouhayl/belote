import { describe, expect, it } from 'vitest';
import { NEW_MATCH, endMatch, isMatchOver, matchWinner, matchWins, recordGame } from '../../src/engine/index.ts';

describe('Le match : 5 manches au plus, 3 gagnantes', () => {
  it('compte les manches gagnées et s’arrête à 3', () => {
    let m = NEW_MATCH;
    m = recordGame(m, [1510, 900], 0);
    expect(matchWins(m)).toEqual([1, 0]);
    expect(isMatchOver(m)).toBe(false);
    m = recordGame(m, [1200, 1530], 1);
    m = recordGame(m, [1600, 700], 0);
    m = recordGame(m, [1100, 1500], 1);
    expect(matchWins(m)).toEqual([2, 2]);
    expect(isMatchOver(m)).toBe(false);
    m = recordGame(m, [1520, 1490], 0);
    expect(matchWins(m)).toEqual([3, 2]);
    expect(matchWinner(m)).toBe(0);
    expect(isMatchOver(m)).toBe(true);
    // Une manche de plus n'est plus comptée.
    expect(recordGame(m, [0, 1500], 1)).toBe(m);
  });

  it('3 - 0 termine le match tout de suite', () => {
    let m = NEW_MATCH;
    for (let i = 0; i < 3; i++) m = recordGame(m, [0, 1500], 1);
    expect(matchWinner(m)).toBe(1);
    expect(isMatchOver(m)).toBe(true);
  });

  it('on peut arrêter le match après une manche (pas avant)', () => {
    expect(endMatch(NEW_MATCH)).toBe(NEW_MATCH);
    const m = endMatch(recordGame(NEW_MATCH, [1500, 300], 0));
    expect(isMatchOver(m)).toBe(true);
    expect(matchWinner(m)).toBeNull();
    expect(matchWins(m)).toEqual([1, 0]);
  });
});
