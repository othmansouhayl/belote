import { SpeakerIcon, SpeakerOffIcon } from './icons.tsx';
import { setSoundEnabled, useSoundEnabled } from './sound.ts';

export function SoundToggle({ className = '' }: { readonly className?: string }) {
  const on = useSoundEnabled();
  return (
    <button
      type="button"
      className={`icon-btn ${className}`}
      aria-pressed={on}
      aria-label={on ? 'Couper le son' : 'Activer le son'}
      title={on ? 'Couper le son' : 'Activer le son'}
      onClick={() => setSoundEnabled(!on)}
    >
      {on ? <SpeakerIcon /> : <SpeakerOffIcon />}
    </button>
  );
}
