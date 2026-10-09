import { HangUpIcon, MicIcon, MicOffIcon, SpeakerIcon } from '../../icons.tsx';
import type { VoiceControls } from './useVoice.ts';

/** Boutons du vocal : rejoindre, couper le micro, quitter, et réactiver le son si le téléphone l'a bloqué. */
export function VoiceBar({ voice, className = '' }: { readonly voice: VoiceControls; readonly className?: string }) {
  const { snapshot, join, leave, toggleMute, resume } = voice;
  const problem = snapshot.micProblem;

  return (
    <div
      className={`voice ${className}`}
      role="group"
      aria-label="Discussion audio"
      data-voice-status={snapshot.status}
      data-voice-connected={snapshot.connected.size}
    >
      {snapshot.status === 'off' && (
        <button type="button" className="voice__btn voice__btn--join" onClick={join}>
          <MicIcon />
          <span>Vocal</span>
        </button>
      )}
      {snapshot.status === 'starting' && <span className="voice__state">Connexion au vocal…</span>}
      {snapshot.status === 'on' && (
        <>
          {!snapshot.listenOnly && (
            <button
              type="button"
              className={`voice__btn${snapshot.muted ? ' voice__btn--muted' : ' voice__btn--live'}`}
              aria-pressed={snapshot.muted}
              aria-label={snapshot.muted ? 'Réactiver le micro' : 'Couper le micro'}
              onClick={toggleMute}
            >
              {snapshot.muted ? <MicOffIcon /> : <MicIcon />}
            </button>
          )}
          <button type="button" className="voice__btn voice__btn--leave" aria-label="Quitter le vocal" onClick={leave}>
            <HangUpIcon />
          </button>
        </>
      )}
      {snapshot.status === 'on' && (snapshot.needsAudioUnlock || snapshot.micInterrupted) && (
        <button type="button" className="voice__btn voice__btn--unlock" onClick={resume}>
          <SpeakerIcon />
          <span>{snapshot.micInterrupted ? 'Réactiver le micro' : 'Activer le son'}</span>
        </button>
      )}
      {problem && <p className="voice__problem">{problem}</p>}
    </div>
  );
}
