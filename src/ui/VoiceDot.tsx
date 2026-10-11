/** Voyant du vocal : vert = on s'entend, orange = connexion en cours, rouge = pas de connexion. */
export type VoiceLinkState = 'connected' | 'connecting' | 'failed';

const TITLES: Record<VoiceLinkState, string> = {
  connected: 'Vocal : connecté',
  connecting: 'Vocal : connexion en cours…',
  failed: 'Vocal : pas de connexion avec ce joueur',
};

export function VoiceDot({ state }: { readonly state: VoiceLinkState }) {
  return <span className={`voice-dot voice-dot--${state}`} title={TITLES[state]} aria-label={TITLES[state]} role="img" />;
}

/** Petites barres animées qui bougent quand le joueur parle (comme sur Meet ou Teams). */
export function SpeakingBars() {
  return (
    <span className="speak-bars" aria-label="Parle" role="img">
      <span />
      <span />
      <span />
    </span>
  );
}
