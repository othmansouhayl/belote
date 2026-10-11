import { describe, expect, it } from 'vitest';
import { ambianceAt, currentHour, phaseAt, tunisHour } from '../../src/ui/cafe/ambiance.ts';

describe('Ambiance du café selon l’heure de Tunis', () => {
  it('lit l’heure de Tunis quel que soit le fuseau du téléphone', () => {
    // 2026-10-11 19:30 UTC = 20:30 à Tunis (UTC+1, pas d'heure d'été).
    expect(tunisHour(new Date('2026-10-11T19:30:00Z'))).toBe(20.5);
    expect(tunisHour(new Date('2026-01-15T23:00:00Z'))).toBe(0);
  });

  it('jour, fin d’après-midi, soirée, nuit', () => {
    expect(phaseAt(10)).toBe('day');
    expect(phaseAt(17.5)).toBe('golden');
    expect(phaseAt(6.5)).toBe('golden');
    expect(phaseAt(21)).toBe('evening');
    expect(phaseAt(2)).toBe('night');
    expect(ambianceAt(21).streetLights).toBe(true);
    expect(ambianceAt(12).streetLights).toBe(false);
  });

  it('?heure=21 dans l’adresse force l’heure (pour tester)', () => {
    expect(currentHour(new Date('2026-10-11T10:00:00Z'), '?heure=21')).toBe(21);
    expect(currentHour(new Date('2026-10-11T10:00:00Z'), '?heure=abc')).toBe(11);
  });
});
