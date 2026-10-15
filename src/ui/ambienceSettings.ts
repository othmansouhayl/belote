/**
 * Réglages de l'ambiance du café (sans navigateur : testable). L'ambiance est fabriquée par le code
 * (bruits du café), il n'y a aucun morceau de musique : pas de droits d'auteur.
 */

/** Accueil : volume normal ; partie : bas, la voix des joueurs passe avant. */
export type AmbienceMood = 'home' | 'game';
export const AMBIENCE_VOLUME: Record<AmbienceMood, number> = { home: 0.5, game: 0.15 };

export interface AmbienceSettings {
  readonly on: boolean;
  /** Volume choisi (0 à 1) : un pour l'accueil, un pendant les parties. */
  readonly volumes: Readonly<Record<AmbienceMood, number>>;
}

const clampVolume = (v: unknown, fallback: number) => (typeof v === 'number' && v >= 0 && v <= 1 ? v : fallback);

/** Relit les réglages enregistrés (valeurs abîmées ou absentes : réglages par défaut). */
export function parseAmbienceSettings(saved: string | null): AmbienceSettings {
  try {
    const data = JSON.parse(saved ?? '{}') as { on?: unknown; volumes?: Partial<Record<AmbienceMood, unknown>> };
    return {
      on: data.on !== false,
      volumes: {
        home: clampVolume(data.volumes?.home, AMBIENCE_VOLUME.home),
        game: clampVolume(data.volumes?.game, AMBIENCE_VOLUME.game),
      },
    };
  } catch {
    return { on: true, volumes: AMBIENCE_VOLUME };
  }
}

/**
 * Les petits bruits du café, avec l'intervalle (en secondes, tiré au hasard entre les deux bornes)
 * qui les sépare : tasses et cuillères, une chaise qu'on tire, une carte qu'on claque sur la table.
 */
export const CAFE_NOISES = {
  clink: [1.5, 6],
  chair: [12, 30],
  cardSlap: [4, 11],
} as const satisfies Record<string, readonly [number, number]>;
