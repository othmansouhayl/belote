import { useSyncExternalStore } from 'react';

/**
 * Sons du jeu, fabriqués par le navigateur (WebAudio) : aucun fichier à télécharger.
 * iOS n'autorise le son qu'après un premier appui : le contexte audio est débloqué
 * au premier toucher sur la page.
 */
export type SoundName = 'deal' | 'card' | 'trick' | 'turn' | 'bid' | 'coinche' | 'belote' | 'win' | 'lose';

const STORAGE_KEY = 'belote.son';
let context: AudioContext | null = null;
let enabled = readEnabled();
const listeners = new Set<() => void>();

function readEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function setSoundEnabled(value: boolean) {
  enabled = value;
  try {
    localStorage.setItem(STORAGE_KEY, value ? 'on' : 'off');
  } catch {
    // Stockage indisponible : le réglage vaut pour cette visite seulement.
  }
  if (value) unlockAudio();
  listeners.forEach((l) => l());
}

export function useSoundEnabled(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => enabled,
  );
}

function unlockAudio() {
  try {
    context ??= new AudioContext();
    if (context.state === 'suspended') void context.resume();
  } catch {
    context = null;
  }
}

if (typeof window !== 'undefined') {
  const unlock = () => {
    unlockAudio();
    if (context?.state === 'running') {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    }
  };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
}

function tone(ctx: AudioContext, freq: number, start: number, duration: number, type: OscillatorType, volume: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

let noiseBuffer: AudioBuffer | null = null;

/** Bruit bref filtré : le claquement d'une carte posée sur le tapis. */
function snap(ctx: AudioContext, start: number, volume = 0.35, freq = 2400) {
  if (!noiseBuffer) {
    noiseBuffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.12), ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 3);
  }
  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(freq, start);
  filter.Q.setValueAtTime(0.8, start);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(volume, start);
  source.connect(filter).connect(gain).connect(ctx.destination);
  source.start(start);
}

/** Glissement doux : le pli ramassé. */
function swoosh(ctx: AudioContext, start: number) {
  snap(ctx, start, 0.18, 900);
  snap(ctx, start + 0.05, 0.14, 700);
  snap(ctx, start + 0.1, 0.1, 500);
}

const RECIPES: Record<SoundName, (ctx: AudioContext, t: number) => void> = {
  deal: (ctx, t) => {
    for (let i = 0; i < 8; i++) snap(ctx, t + i * 0.055, 0.22, 2000 + (i % 3) * 300);
  },
  card: (ctx, t) => snap(ctx, t),
  trick: (ctx, t) => swoosh(ctx, t),
  turn: (ctx, t) => {
    tone(ctx, 880, t, 0.18, 'sine', 0.12);
    tone(ctx, 1318.5, t + 0.1, 0.25, 'sine', 0.1);
  },
  bid: (ctx, t) => tone(ctx, 660, t, 0.08, 'triangle', 0.12),
  coinche: (ctx, t) => {
    tone(ctx, 196, t, 0.12, 'square', 0.08);
    tone(ctx, 392, t + 0.09, 0.16, 'square', 0.07);
    snap(ctx, t, 0.4, 600);
  },
  belote: (ctx, t) => {
    [784, 988, 1175].forEach((f, i) => tone(ctx, f, t + i * 0.08, 0.2, 'triangle', 0.1));
  },
  win: (ctx, t) => {
    [523, 659, 784, 1047].forEach((f, i) => tone(ctx, f, t + i * 0.12, 0.35, 'triangle', 0.12));
  },
  lose: (ctx, t) => {
    [392, 349, 311, 262].forEach((f, i) => tone(ctx, f, t + i * 0.16, 0.35, 'sine', 0.1));
  },
};

export function playSound(name: SoundName, delaySeconds = 0) {
  if (!enabled || !context || context.state !== 'running') return;
  try {
    RECIPES[name](context, context.currentTime + 0.01 + delaySeconds);
  } catch {
    // Un son raté ne doit jamais gêner la partie.
  }
}
