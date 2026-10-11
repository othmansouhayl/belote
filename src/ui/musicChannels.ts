/** Les chaînes de la télé du café (sans navigateur : testable). */
export interface Channel {
  readonly id: string;
  readonly artist: string;
  readonly title: string;
  /** Fichier dans `public/music`. */
  readonly src: string;
}

export const CHANNELS: readonly Channel[] = [
  { id: 'ezin-ezin', artist: 'الهادي الجويني', title: 'Ezin Ezin', src: 'music/hedi-jouini-ezin-ezin.mp3' },
  { id: 'maftoun', artist: 'الهادي الجويني', title: 'مفتون بخرزة عينيها', src: 'music/hedi-jouini-maftoun.mp3' },
];

/** Accueil : volume normal ; partie : très bas, la voix des joueurs passe avant. */
export type MusicMood = 'home' | 'game';
export const MUSIC_VOLUME: Record<MusicMood, number> = { home: 0.5, game: 0.12 };
