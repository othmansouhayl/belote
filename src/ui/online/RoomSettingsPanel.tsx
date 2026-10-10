import { useEffect, useState } from 'react';
import { makeRules } from '../../engine/index.ts';
import type { ContractSuccessScoring } from '../../engine/index.ts';
import { ABSENCE_DELAYS, TARGET_SCORES } from '../../server/rooms.ts';
import type { RoomSettings } from '../../server/types.ts';

const SCORINGS: readonly (readonly [ContractSuccessScoring, string, string])[] = [
  ['realizedPoints', 'Ses points', 'ses points'],
  ['contractOnly', 'Le contrat', 'valeur du contrat'],
  ['contractPlusPoints', 'Points + contrat', 'points + contrat'],
];

type ToggleKey = 'allowRebidAfterPass' | 'allowOverbidSameSuit' | 'requireUndertrump' | 'beloteAlwaysScored' | 'capotMultiplied';

const TOGGLES: readonly { readonly key: ToggleKey; readonly label: string; readonly hint: string }[] = [
  { key: 'allowRebidAfterPass', label: 'Reparler après avoir passé', hint: 'Un joueur qui a passé peut encore annoncer.' },
  { key: 'allowOverbidSameSuit', label: 'Monter dans la couleur du partenaire', hint: "Surenchérir dans l'atout annoncé par son partenaire (une autre couleur reste toujours possible)." },
  { key: 'requireUndertrump', label: 'Sous-couper obligatoire', hint: 'Sans atout plus fort, on doit quand même jouer atout.' },
  { key: 'beloteAlwaysScored', label: 'Belote de la défense comptée', hint: 'Contrat réussi : la défense garde ses 20 points de belote.' },
  { key: 'capotMultiplied', label: 'Capot multiplié par la coinche', hint: 'Les 500 / 250 points du capot sont doublés ou quadruplés.' },
];

interface RoomSettingsPanelProps {
  readonly settings: RoomSettings;
  readonly editable: boolean;
  readonly hostName: string | null;
  readonly busy: boolean;
  readonly onChange: (settings: RoomSettings) => void;
}

/** Réglages de la partie, modifiables par l'hôte avant le début (score cible, règles optionnelles). */
export function RoomSettingsPanel({ settings: fromServer, editable, hostName, busy, onChange }: RoomSettingsPanelProps) {
  // Le choix de l'hôte s'affiche tout de suite, puis la version du serveur fait foi dès qu'elle arrive.
  const [draft, setDraft] = useState<RoomSettings | null>(null);
  const serverKey = JSON.stringify(fromServer);
  useEffect(() => setDraft(null), [serverKey]);
  const settings = draft ?? fromServer;
  const rules = makeRules(settings.rules);
  const current = {
    targetScore: rules.targetScore,
    contractSuccessScoring: rules.contractSuccessScoring,
    allowRebidAfterPass: rules.allowRebidAfterPass,
    allowOverbidSameSuit: rules.allowOverbidSameSuit,
    requireUndertrump: rules.requireUndertrump,
    beloteAlwaysScored: rules.beloteAlwaysScored,
    capotMultiplied: rules.capotMultiplied,
  };
  const update = (patch: Partial<typeof current>, absenceDelaySeconds = settings.absenceDelaySeconds) => {
    const next: RoomSettings = { rules: { ...current, ...patch }, absenceDelaySeconds };
    setDraft(next);
    onChange(next);
  };
  const disabled = !editable || busy;

  return (
    <details className="settings">
      <summary className="settings__summary">
        <span className="settings__title">Réglages de la partie</span>
        <span className="settings__short">
          {rules.targetScore} points · {SCORINGS.find(([v]) => v === rules.contractSuccessScoring)?.[2]}
        </span>
      </summary>
      <div className="settings__body">
        {!editable && <p className="screen__hint">Seul l'hôte{hostName ? ` (${hostName})` : ''} peut modifier ces réglages.</p>}

        <fieldset className="settings__group" disabled={disabled}>
          <legend className="settings__label">Score à atteindre</legend>
          <div className="segmented">
            {TARGET_SCORES.map((t) => (
              <button
                key={t}
                type="button"
                className={`segmented__option${rules.targetScore === t ? ' segmented__option--on' : ''}`}
                aria-pressed={rules.targetScore === t}
                onClick={() => update({ targetScore: t })}
              >
                {t}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="settings__group" disabled={disabled}>
          <legend className="settings__label">Contrat réussi : le preneur marque</legend>
          <div className="segmented">
            {SCORINGS.map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={`segmented__option${rules.contractSuccessScoring === value ? ' segmented__option--on' : ''}`}
                aria-pressed={rules.contractSuccessScoring === value}
                onClick={() => update({ contractSuccessScoring: value })}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="settings__group" disabled={disabled}>
          <legend className="settings__label">Règles optionnelles</legend>
          {TOGGLES.map(({ key, label, hint }) => (
            <label key={key} className="switch-row">
              <span className="switch-row__text">
                <span className="switch-row__label">{label}</span>
                <span className="switch-row__hint">{hint}</span>
              </span>
              <input
                type="checkbox"
                className="switch"
                checked={rules[key]}
                onChange={(e) => update({ [key]: e.target.checked })}
              />
            </label>
          ))}
        </fieldset>

        <fieldset className="settings__group" disabled={disabled}>
          <legend className="settings__label">Joueur déconnecté affiché « hors ligne » après</legend>
          <div className="segmented">
            {ABSENCE_DELAYS.map((d) => (
              <button
                key={d}
                type="button"
                className={`segmented__option${settings.absenceDelaySeconds === d ? ' segmented__option--on' : ''}`}
                aria-pressed={settings.absenceDelaySeconds === d}
                onClick={() => update({}, d)}
              >
                {d} s
              </button>
            ))}
          </div>
        </fieldset>
      </div>
    </details>
  );
}
