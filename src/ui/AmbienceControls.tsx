import { setAmbienceOn, setAmbienceVolume, useAmbience } from './ambience.ts';
import type { AmbienceMood } from './ambience.ts';

/** Ambiance du café : allumer / couper, et volume (un réglage pour l'accueil, un pour les parties). */
export function AmbienceControls({ mood, showSwitch = true }: { readonly mood: AmbienceMood; readonly showSwitch?: boolean }) {
  const ambience = useAmbience();
  const percent = Math.round(ambience.volumes[mood] * 100);
  return (
    <div className="music-controls">
      {showSwitch && (
        <label className="music-controls__switch">
          <input type="checkbox" role="switch" checked={ambience.on} onChange={(e) => setAmbienceOn(e.target.checked)} />
          <span>Ambiance du café{ambience.on ? '' : ' coupée'}</span>
        </label>
      )}
      <label className="music-controls__volume">
        <span>Volume {mood === 'game' ? 'pendant la partie' : 'au café'}</span>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={percent}
          disabled={!ambience.on}
          aria-valuetext={`${percent} %`}
          onChange={(e) => setAmbienceVolume(mood, Number(e.target.value) / 100)}
        />
        <output>{percent} %</output>
      </label>
    </div>
  );
}
