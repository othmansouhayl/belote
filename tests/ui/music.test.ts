import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CHANNELS, MUSIC_VOLUME } from '../../src/ui/musicChannels.ts';

describe('Télé du café : la musique', () => {
  it('chaque chaîne de la télécommande a son fichier', () => {
    expect(CHANNELS.length).toBe(2);
    for (const channel of CHANNELS) expect(existsSync(new URL(`../../public/${channel.src}`, import.meta.url))).toBe(true);
  });

  it('pendant la partie, la musique est bien plus basse que les voix', () => {
    expect(MUSIC_VOLUME.game).toBeLessThan(MUSIC_VOLUME.home / 3);
  });
});
