import type { FinalContract, Team } from '../engine/index.ts';
import { SoundToggle } from './SoundToggle.tsx';
import { SUIT_SYMBOLS, contractValueLabel, isRed } from './labels.ts';
import type { SeatNames } from './labels.ts';

interface TopBarProps {
  readonly scores: readonly [number, number];
  readonly myTeam: Team;
  readonly target: number;
  readonly contract: FinalContract | null;
  readonly names: SeatNames;
  readonly subtitle?: string;
  readonly menuLabel: string;
  readonly onMenu: () => void;
  /** Noms des équipes (« Nous » / « Eux » pour un joueur, les pseudos pour un spectateur). */
  readonly teamLabels?: readonly [string, string];
}

export function TopBar({ scores, myTeam, target, contract, names, subtitle, menuLabel, onMenu, teamLabels = ['Nous', 'Eux'] }: TopBarProps) {
  return (
    <header className="topbar">
      <div className="score score--us">
        <span className="score__label">{teamLabels[0]}</span>
        <span className="score__value">{scores[myTeam]}</span>
        <span className="score__bar" style={{ ['--p' as string]: Math.min(1, scores[myTeam] / target) }} />
      </div>
      <div className="topbar__center">
        {contract ? (
          <div className="contract" aria-label="Contrat en cours">
            <span className={`contract__main${isRed(contract.suit) ? ' contract__main--red' : ''}`}>
              {contractValueLabel(contract.value)} {SUIT_SYMBOLS[contract.suit]}
            </span>
            <span className="contract__by">
              {names[contract.bidder]}
              {contract.surcoinchedBy !== null ? ' · surcoinché ×4' : contract.coinchedBy !== null ? ' · coinché ×2' : ''}
            </span>
          </div>
        ) : (
          <div className="contract contract--empty">
            <span className="contract__main">Enchères</span>
            <span className="contract__by">{subtitle ?? `Objectif ${target}`}</span>
          </div>
        )}
      </div>
      <div className="score score--them">
        <span className="score__label">{teamLabels[1]}</span>
        <span className="score__value">{scores[myTeam === 0 ? 1 : 0]}</span>
        <span className="score__bar" style={{ ['--p' as string]: Math.min(1, scores[myTeam === 0 ? 1 : 0] / target) }} />
      </div>
      <div className="topbar__actions">
        <SoundToggle />
        <button type="button" className="icon-btn" aria-label={menuLabel} title={menuLabel} onClick={onMenu}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
      </div>
    </header>
  );
}
