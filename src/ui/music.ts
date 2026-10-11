import { useSyncExternalStore } from 'react';

/**
 * Musique du café : la télé de Tarek, qu'on change avec la télécommande de l'accueil.
 * Allumée par défaut ; elle démarre au premier toucher (les navigateurs l'exigent),
 * baisse pendant les parties pour qu'on s'entende au vocal, et se met en pause
 * quand l'application passe en arrière-plan.
 */
import { CHANNELS, MUSIC_VOLUME } from './musicChannels.ts';
import type { MusicMood } from './musicChannels.ts';

export { CHANNELS, MUSIC_VOLUME };
export type { Channel, MusicMood } from './musicChannels.ts';

export interface MusicState {
  readonly on: boolean;
  readonly channel: number;
  /** Volume choisi (0 à 1) : un pour l'accueil, un pendant les parties. */
  readonly volumes: Readonly<Record<MusicMood, number>>;
  /** Le son sort vraiment (faux tant que personne n'a touché l'écran). */
  readonly playing: boolean;
}

const STORAGE_KEY = 'belote.musique';
const listeners = new Set<() => void>();
let state: MusicState = { ...readSaved(), playing: false };
let mood: MusicMood = 'home';
let audio: HTMLAudioElement | null = null;
let gain: GainNode | null = null;
let context: AudioContext | null = null;

const clampVolume = (v: unknown, fallback: number) => (typeof v === 'number' && v >= 0 && v <= 1 ? v : fallback);

function readSaved(): Omit<MusicState, 'playing'> {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as {
      on?: unknown;
      channel?: unknown;
      volumes?: Partial<Record<MusicMood, unknown>>;
    };
    const channel = typeof saved.channel === 'number' && saved.channel >= 0 && saved.channel < CHANNELS.length ? saved.channel : 0;
    const volumes = {
      home: clampVolume(saved.volumes?.home, MUSIC_VOLUME.home),
      game: clampVolume(saved.volumes?.game, MUSIC_VOLUME.game),
    };
    return { on: saved.on !== false, channel, volumes };
  } catch {
    return { on: true, channel: 0, volumes: MUSIC_VOLUME };
  }
}

function setState(next: Partial<MusicState>) {
  state = { ...state, ...next };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ on: state.on, channel: state.channel, volumes: state.volumes }));
  } catch {
    // Stockage indisponible : le réglage vaut pour cette visite seulement.
  }
  listeners.forEach((l) => l());
}

/** Volume réglé par WebAudio (seul moyen sur iPhone), sinon directement sur le lecteur. */
function applyVolume() {
  const volume = state.volumes[mood];
  if (gain && context) gain.gain.setTargetAtTime(volume, context.currentTime, 0.15);
  else if (audio) audio.volume = volume;
}

function player(): HTMLAudioElement {
  if (audio) return audio;
  audio = new Audio();
  audio.preload = 'none';
  // Morceau fini : on passe au suivant, comme une radio.
  audio.addEventListener('ended', () => tune((state.channel + 1) % CHANNELS.length));
  audio.addEventListener('playing', () => setState({ playing: true }));
  audio.addEventListener('pause', () => setState({ playing: false }));
  try {
    context = new AudioContext();
    gain = context.createGain();
    gain.gain.value = state.volumes[mood];
    context.createMediaElementSource(audio).connect(gain).connect(context.destination);
  } catch {
    context = null;
    gain = null;
  }
  applyVolume();
  return audio;
}

function start() {
  if (!state.on || document.hidden) return;
  const el = player();
  const src = CHANNELS[state.channel]!.src;
  if (!el.src.endsWith(src)) el.src = src;
  if (context?.state === 'suspended') void context.resume();
  el.play().catch(() => {
    // Lecture refusée avant le premier toucher : on réessaie à ce moment-là.
  });
}

function stop() {
  audio?.pause();
}

/** Allume ou éteint la télé. */
export function setMusicOn(on: boolean) {
  setState({ on });
  if (on) start();
  else stop();
}

/** Change de chaîne (et allume la télé si elle était éteinte). */
export function tune(channel: number) {
  setState({ channel: ((channel % CHANNELS.length) + CHANNELS.length) % CHANNELS.length, on: true });
  if (audio) audio.src = CHANNELS[state.channel]!.src;
  start();
}

/** Règle le volume de la musique (0 à 1) pour l'accueil ou pour les parties. */
export function setMusicVolume(which: MusicMood, volume: number) {
  setState({ volumes: { ...state.volumes, [which]: Math.min(1, Math.max(0, volume)) } });
  applyVolume();
}

/** Où l'on est : l'accueil ou une partie (le volume suit). */
export function currentMusicMood(): MusicMood {
  return mood;
}

export function setMusicMood(next: MusicMood) {
  if (mood === next) return;
  mood = next;
  applyVolume();
}

export function useMusic(): MusicState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state,
  );
}

if (typeof window !== 'undefined') {
  // Premier toucher : les navigateurs autorisent enfin le son.
  const unlock = () => {
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
    start();
  };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else start();
  });
}
