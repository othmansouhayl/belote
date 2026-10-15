import { useState } from 'react';
import { setAmbienceOn, useAmbience } from './ambience.ts';
import { AmbienceControls } from './AmbienceControls.tsx';
import { SpeakingBars } from './VoiceDot.tsx';
import { PowerIcon } from './icons.tsx';

/** Le bouton de l'ambiance du café (brouhaha, tasses, chaises) : on l'allume ou on le coupe avant de s'asseoir. */
export function Remote() {
  const [open, setOpen] = useState(false);
  const ambience = useAmbience();
  const sounding = ambience.on && ambience.playing;
  return (
    <div className={`remote${open ? ' remote--open' : ''}`}>
      <button
        type="button"
        className="remote__toggle"
        aria-expanded={open}
        aria-label="Ambiance du café"
        onClick={() => setOpen(!open)}
      >
        <span aria-hidden="true">☕</span>
        {sounding && <SpeakingBars />}
      </button>
      {open && (
        <div className="remote__panel" role="group" aria-label="Ambiance du café">
          <div className="remote__top">
            <span className="remote__screen">
              <span className="remote__title">{ambience.on ? 'Ambiance du café' : 'Ambiance coupée'}</span>
            </span>
            {/* Allumée mais pas encore lancée (le navigateur attendait un toucher) : ce bouton la lance. */}
            <button
              type="button"
              className={`remote__power${ambience.on ? ' remote__power--on' : ''}`}
              aria-pressed={ambience.on}
              aria-label={sounding ? "Couper l'ambiance" : "Allumer l'ambiance"}
              onClick={() => setAmbienceOn(!sounding)}
            >
              <PowerIcon />
            </button>
          </div>
          <AmbienceControls mood="home" showSwitch={false} />
          <p className="remote__note">Le brouhaha, les tasses, les chaises… Pendant la partie, il baisse pour qu’on s’entende (réglable dans le menu ☰).</p>
        </div>
      )}
    </div>
  );
}
