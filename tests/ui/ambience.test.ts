import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AMBIENCE_VOLUME, CAFE_NOISES, parseAmbienceSettings } from '../../src/ui/ambienceSettings.ts';

describe('Ambiance du café (sans musique)', () => {
  it('plus aucun morceau de musique dans le site (droits d’auteur)', () => {
    expect(existsSync(new URL('../../public/music', import.meta.url))).toBe(false);
  });

  it('pendant la partie, l’ambiance est bien plus basse : la voix passe avant', () => {
    expect(AMBIENCE_VOLUME.game).toBeLessThan(AMBIENCE_VOLUME.home / 3);
  });

  it('réglages enregistrés : relus, et réglages par défaut s’ils sont abîmés', () => {
    expect(parseAmbienceSettings(null)).toEqual({ on: true, volumes: AMBIENCE_VOLUME });
    expect(parseAmbienceSettings('{"on":false,"volumes":{"home":0.2,"game":0.05}}')).toEqual({ on: false, volumes: { home: 0.2, game: 0.05 } });
    expect(parseAmbienceSettings('{"volumes":{"home":7}}').volumes.home).toBe(AMBIENCE_VOLUME.home);
    expect(parseAmbienceSettings('pas du json')).toEqual({ on: true, volumes: AMBIENCE_VOLUME });
  });

  it('les petits bruits reviennent de temps en temps, pas en continu', () => {
    for (const [min, max] of Object.values(CAFE_NOISES)) {
      expect(min).toBeGreaterThan(1);
      expect(max).toBeGreaterThan(min);
    }
  });
});
