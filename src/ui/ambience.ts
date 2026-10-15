import { useSyncExternalStore } from 'react';
import { AMBIENCE_VOLUME, CAFE_NOISES, parseAmbienceSettings } from './ambienceSettings.ts';
import type { AmbienceMood, AmbienceSettings } from './ambienceSettings.ts';

/**
 * L'ambiance du café : le brouhaha des clients, les tasses, une chaise, une carte claquée sur la
 * table. Tout est fabriqué par WebAudio (aucun fichier, aucune musique : pas de droits d'auteur).
 * Allumée par défaut ; elle démarre au premier toucher (les navigateurs l'exigent), baisse pendant
 * les parties pour qu'on s'entende au vocal, et s'arrête quand l'application passe en arrière-plan.
 */
export { AMBIENCE_VOLUME };
export type { AmbienceMood } from './ambienceSettings.ts';

export interface AmbienceState extends AmbienceSettings {
  /** Le son sort vraiment (faux tant que personne n'a touché l'écran). */
  readonly playing: boolean;
}

const STORAGE_KEY = 'belote.ambiance';
const listeners = new Set<() => void>();
let state: AmbienceState = { ...readSaved(), playing: false };
let mood: AmbienceMood = 'home';

let context: AudioContext | null = null;
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;
/** Minuteries en cours (chacune s'enlève quand elle part) et sources qui tournent en boucle. */
const timers = new Set<ReturnType<typeof setTimeout>>();
let loops: AudioBufferSourceNode[] = [];

function later(run: () => void, ms: number) {
  const timer = setTimeout(() => {
    timers.delete(timer);
    run();
  }, ms);
  timers.add(timer);
}

function readSaved(): AmbienceSettings {
  try {
    return parseAmbienceSettings(localStorage.getItem(STORAGE_KEY));
  } catch {
    return parseAmbienceSettings(null);
  }
}

function setState(next: Partial<AmbienceState>) {
  state = { ...state, ...next };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ on: state.on, volumes: state.volumes }));
  } catch {
    // Stockage indisponible : le réglage vaut pour cette visite seulement.
  }
  listeners.forEach((l) => l());
}

const random = (min: number, max: number) => min + Math.random() * (max - min);

/** Bruit « rose » (plus doux que le bruit blanc) : la matière du brouhaha. */
function pinkNoise(ctx: AudioContext, seconds: number): AudioBuffer {
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99765 * b0 + white * 0.099046;
    b1 = 0.963 * b1 + white * 0.2965164;
    b2 = 0.57 * b2 + white * 1.0526913;
    data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.18;
  }
  return buffer;
}

/**
 * Le brouhaha : trois « tablées » de voix, chacune un bruit filtré sur les fréquences de la parole,
 * dont le volume monte et descend sans cesse comme une conversation (syllabes, rires, silences).
 */
function startMurmur(ctx: AudioContext, out: AudioNode, buffer: AudioBuffer) {
  for (const [frequency, level] of [
    [350, 0.55],
    [700, 0.45],
    [1200, 0.3],
  ] as const) {
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.loopStart = random(0, 1);
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = frequency;
    band.Q.value = 0.9;
    const voice = ctx.createGain();
    voice.gain.value = level * 0.5;
    source.connect(band).connect(voice).connect(out);
    source.start(ctx.currentTime, random(0, buffer.duration));
    loops.push(source);
    const talk = () => {
      const t = ctx.currentTime;
      voice.gain.setTargetAtTime(level * random(0.25, 1), t, random(0.05, 0.25));
      later(talk, random(180, 650));
    };
    talk();
  }
}

/** Une tasse posée sur sa soucoupe, une cuillère : un tintement aigu qui s'éteint vite. */
function clink(ctx: AudioContext, out: AudioNode) {
  const t = ctx.currentTime;
  const strikes = Math.random() < 0.35 ? 2 : 1;
  for (let s = 0; s < strikes; s++) {
    const start = t + s * random(0.09, 0.16);
    const base = random(2400, 4200);
    for (const [ratio, level] of [
      [1, 0.09],
      [2.76, 0.035],
    ] as const) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = base * ratio;
      const env = ctx.createGain();
      env.gain.setValueAtTime(0, start);
      env.gain.linearRampToValueAtTime(level, start + 0.003);
      env.gain.exponentialRampToValueAtTime(0.0001, start + random(0.25, 0.55));
      osc.connect(env).connect(out);
      osc.start(start);
      osc.stop(start + 0.6);
    }
  }
}

/** Une chaise qu'on tire : un frottement dont le son glisse vers l'aigu. */
function chair(ctx: AudioContext, out: AudioNode, buffer: AudioBuffer) {
  const t = ctx.currentTime;
  const length = random(0.25, 0.5);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const band = ctx.createBiquadFilter();
  band.type = 'bandpass';
  band.Q.value = 6;
  band.frequency.setValueAtTime(random(250, 400), t);
  band.frequency.linearRampToValueAtTime(random(700, 1100), t + length);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(0.35, t + 0.04);
  env.gain.setValueAtTime(0.35, t + length * 0.7);
  env.gain.linearRampToValueAtTime(0, t + length);
  source.connect(band).connect(env).connect(out);
  source.start(t, random(0, buffer.duration - 1));
  source.stop(t + length + 0.05);
}

/** Une carte (ou un atout) claquée sur la table, quelque part dans la salle. */
function cardSlap(ctx: AudioContext, out: AudioNode, buffer: AudioBuffer) {
  const t = ctx.currentTime;
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const low = ctx.createBiquadFilter();
  low.type = 'lowpass';
  low.frequency.value = random(900, 1600);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.5, t);
  env.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
  source.connect(low).connect(env).connect(out);
  source.start(t, random(0, buffer.duration - 1));
  source.stop(t + 0.1);
}

/** Relance un bruit du café au hasard, encore et encore. */
function every(range: readonly [number, number], play: () => void) {
  const next = () =>
    later(() => {
      play();
      next();
    }, random(range[0], range[1]) * 1000);
  next();
}

function applyVolume() {
  if (master && context) master.gain.setTargetAtTime(state.volumes[mood], context.currentTime, 0.3);
}

function start() {
  if (!state.on || document.hidden || state.playing) return;
  try {
    context ??= new AudioContext();
  } catch {
    return;
  }
  const ctx = context;
  if (ctx.state === 'suspended') void ctx.resume();
  noise ??= pinkNoise(ctx, 4);
  master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);
  const out = master;
  const buffer = noise;
  startMurmur(ctx, out, buffer);
  every(CAFE_NOISES.clink, () => clink(ctx, out));
  every(CAFE_NOISES.chair, () => chair(ctx, out, buffer));
  every(CAFE_NOISES.cardSlap, () => cardSlap(ctx, out, buffer));
  applyVolume();
  setState({ playing: true });
}

function stop() {
  for (const timer of timers) clearTimeout(timer);
  timers.clear();
  if (master && context) {
    // Le son s'éteint en douceur, puis les sources s'arrêtent et le graphe est débranché.
    const old = master;
    const oldLoops = loops;
    old.gain.setTargetAtTime(0, context.currentTime, 0.1);
    setTimeout(() => {
      for (const source of oldLoops) source.stop();
      old.disconnect();
    }, 600);
  }
  loops = [];
  master = null;
  if (state.playing) setState({ playing: false });
}

/** Allume ou coupe l'ambiance. */
export function setAmbienceOn(on: boolean) {
  setState({ on });
  if (on) start();
  else stop();
}

/** Règle le volume de l'ambiance (0 à 1) pour l'accueil ou pour les parties. */
export function setAmbienceVolume(which: AmbienceMood, volume: number) {
  setState({ volumes: { ...state.volumes, [which]: Math.min(1, Math.max(0, volume)) } });
  applyVolume();
}

/** Où l'on est : l'accueil ou une partie (le volume suit). */
export function setAmbienceMood(next: AmbienceMood) {
  if (mood === next) return;
  mood = next;
  applyVolume();
}

export function useAmbience(): AmbienceState {
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
