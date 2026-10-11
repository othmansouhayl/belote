import { useState } from 'react';
import { CHANNELS, setMusicOn, tune, useMusic } from './music.ts';
import { SpeakingBars } from './VoiceDot.tsx';

/** La télécommande de la télé du café : on choisit la musique avant de s'asseoir. */
export function Remote() {
  const [open, setOpen] = useState(false);
  const music = useMusic();
  const current = CHANNELS[music.channel]!;
  return (
    <div className={`remote${open ? ' remote--open' : ''}`}>
      <button
        type="button"
        className="remote__toggle"
        aria-expanded={open}
        aria-label="Télécommande de la télé"
        onClick={() => setOpen(!open)}
      >
        <span aria-hidden="true">📺</span>
        {music.on && music.playing && <SpeakingBars />}
      </button>
      {open && (
        <div className="remote__panel" role="group" aria-label="Télécommande">
          <div className="remote__top">
            <span className="remote__screen">
              {music.on ? (
                <>
                  <span className="remote__artist" lang="ar" dir="rtl">
                    {current.artist}
                  </span>
                  <span className="remote__title">{current.title}</span>
                </>
              ) : (
                'Télé éteinte'
              )}
            </span>
            <button
              type="button"
              className={`remote__power${music.on ? ' remote__power--on' : ''}`}
              aria-pressed={music.on}
              aria-label={music.on ? 'Éteindre la musique' : 'Allumer la musique'}
              onClick={() => setMusicOn(!music.on)}
            >
              ⏻
            </button>
          </div>
          <div className="remote__channels">
            {CHANNELS.map((channel, i) => (
              <button
                key={channel.id}
                type="button"
                className={`remote__channel${music.on && music.channel === i ? ' remote__channel--active' : ''}`}
                aria-pressed={music.on && music.channel === i}
                onClick={() => {
                  tune(i);
                  // On referme pour voir la télé changer de chaîne.
                  setOpen(false);
                }}
              >
                <span className="remote__number">{i + 1}</span>
                <span className="remote__label">{channel.title}</span>
              </button>
            ))}
          </div>
          <p className="remote__note">Pendant la partie, la musique baisse pour qu’on s’entende.</p>
        </div>
      )}
    </div>
  );
}
