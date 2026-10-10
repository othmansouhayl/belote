import { useSyncExternalStore } from 'react';

/** Événement non standard (Chrome, Edge, Samsung Internet) qui permet de proposer l'installation. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

// L'événement peut arriver avant l'affichage de l'accueil : on le capte dès le chargement.
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferred = event as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    notify();
  });
}

export type InstallState = 'installed' | 'prompt' | 'ios' | 'unavailable';

function currentState(): InstallState {
  if (isStandalone()) return 'installed';
  if (deferred) return 'prompt';
  if (isIos()) return 'ios';
  return 'unavailable';
}

export function useInstallState(): InstallState {
  return useSyncExternalStore((l) => {
    listeners.add(l);
    return () => listeners.delete(l);
  }, currentState);
}

export async function promptInstall(): Promise<void> {
  const event = deferred;
  if (!event) return;
  await event.prompt();
  await event.userChoice.catch(() => undefined);
  deferred = null;
  notify();
}
