/**
 * Ambiance lumineuse du café selon l'heure réelle à Tunis : jour, fin d'après-midi, soirée, nuit.
 * Fonctions pures (testables) : la scène 3D applique simplement les valeurs.
 */

export type DayPhase = 'day' | 'golden' | 'evening' | 'night';

export interface Ambiance {
  readonly phase: DayPhase;
  /** Couleur du ciel / du fond autour du café. */
  readonly sky: number;
  /** Lumière d'ambiance (ciel / sol). */
  readonly hemiSky: number;
  readonly hemiGround: number;
  readonly hemiIntensity: number;
  /** Lumière principale qui donne les ombres (soleil le jour, plafonniers la nuit). */
  readonly keyColor: number;
  readonly keyIntensity: number;
  /** Ampoules des suspensions et lampes chaudes. */
  readonly lampIntensity: number;
  readonly bulbGlow: number;
  /** Couleur de la rue (plus claire le jour). */
  readonly street: number;
  /** Lampadaire et enseigne allumés. */
  readonly streetLights: boolean;
}

/** Heure décimale à Tunis (ex. 21.5 pour 21 h 30), quel que soit le fuseau du téléphone. */
export function tunisHour(date: Date): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Tunis',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return get('hour') + get('minute') / 60;
}

export function phaseAt(hour: number): DayPhase {
  if (hour >= 7 && hour < 17) return 'day';
  if (hour >= 17 && hour < 19) return 'golden';
  if (hour >= 19 && hour < 23) return 'evening';
  if (hour >= 6 && hour < 7) return 'golden';
  return 'night';
}

const AMBIANCES: Record<DayPhase, Ambiance> = {
  day: {
    phase: 'day',
    sky: 0x9cc7e0,
    hemiSky: 0xfff6e8,
    hemiGround: 0x8a7a66,
    hemiIntensity: 1.25,
    keyColor: 0xfff1dc,
    keyIntensity: 2.1,
    lampIntensity: 1.5,
    bulbGlow: 0.6,
    street: 0x8d8a85,
    streetLights: false,
  },
  golden: {
    phase: 'golden',
    sky: 0xe7a76f,
    hemiSky: 0xffd9a8,
    hemiGround: 0x6a4a36,
    hemiIntensity: 1.0,
    keyColor: 0xffc58a,
    keyIntensity: 1.7,
    lampIntensity: 3.5,
    bulbGlow: 1.2,
    street: 0x6e6460,
    streetLights: false,
  },
  evening: {
    phase: 'evening',
    sky: 0x1a2440,
    hemiSky: 0xffd7a8,
    hemiGround: 0x2a2018,
    hemiIntensity: 0.7,
    keyColor: 0xffd29a,
    keyIntensity: 1.25,
    lampIntensity: 6,
    bulbGlow: 2.4,
    street: 0x3a3d44,
    streetLights: true,
  },
  night: {
    phase: 'night',
    sky: 0x0b1222,
    hemiSky: 0xffcf96,
    hemiGround: 0x1a140f,
    hemiIntensity: 0.55,
    keyColor: 0xffc88a,
    keyIntensity: 1.05,
    lampIntensity: 6.5,
    bulbGlow: 2.6,
    street: 0x2a2c32,
    streetLights: true,
  },
};

export function ambianceAt(hour: number): Ambiance {
  return AMBIANCES[phaseAt(hour)];
}

/** Heure à utiliser : celle de Tunis, ou celle forcée dans l'adresse (?heure=21) pour tester. */
export function currentHour(now: Date, search: string): number {
  const forced = new URLSearchParams(search).get('heure');
  const value = forced === null ? NaN : Number(forced);
  return Number.isFinite(value) && value >= 0 && value < 24 ? value : tunisHour(now);
}
