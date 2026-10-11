import { CHANNELS, setMusicOn, setMusicVolume, useMusic } from './music.ts';
import type { MusicMood } from './music.ts';

/** Musique : allumer / éteindre, et volume (un réglage pour l'accueil, un pour les parties). */
export function MusicControls({ mood, showSwitch = true }: { readonly mood: MusicMood; readonly showSwitch?: boolean }) {
  const music = useMusic();
  const percent = Math.round(music.volumes[mood] * 100);
  return (
    <div className="music-controls">
      {showSwitch && (
        <label className="music-controls__switch">
          <input type="checkbox" role="switch" checked={music.on} onChange={(e) => setMusicOn(e.target.checked)} />
          <span>Musique{music.on ? ` · ${CHANNELS[music.channel]!.title}` : ' coupée'}</span>
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
          disabled={!music.on}
          aria-valuetext={`${percent} %`}
          onChange={(e) => setMusicVolume(mood, Number(e.target.value) / 100)}
        />
        <output>{percent} %</output>
      </label>
    </div>
  );
}
