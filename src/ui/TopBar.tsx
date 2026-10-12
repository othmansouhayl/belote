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
  /** Manches gagnées dans le match (équipe 0, équipe 1), ou null en début de match. */
  readonly matchWins?: readonly [number, number] | null;
  /** Toucher le score ouvre le carton. */
  readonly onScores?: () => void;
}

export function TopBar(props: TopBarProps) {
  const { scores, myTeam, target, contract, names, subtitle, menuLabel, onMenu, teamLabels = ['Nous', 'Eux'], matchWins = null, onScores } = props;
  return (
    <header className="topbar">
      <button type="button" className="score score--us" onClick={onScores} aria-label={`${teamLabels[0]} : ${scores[myTeam]} points. Voir le carton`}>
        <span className="score__label">{teamLabels[0]}</span>
        <span className="score__value">{scores[myTeam]}</span>
        <span className="score__bar" style={{ ['--p' as string]: Math.min(1, scores[myTeam] / target) }} />
      </button>
      <div className="topbar__center">
        {contract ? (
          <div className="contract" aria-label="Contrat en cours">
            <span className={`contract__main${isRed(contract.suit) ? ' contract__main--red' : ''}`}>
              {contractValueLabel(contract.value)} {SUIT_SYMBOLS[contract.suit]}
            </span>
            <span className="contract__by">
              {names[contract.bidder]}
              {contract.surcoinchedBy !== null ? ' · surcontré ×4' : contract.coinchedBy !== null ? ' · contré ×2' : ''}
            </span>
          </div>
        ) : (
          <div className="contract contract--empty">
            <span className="contract__main">Enchères</span>
            <span className="contract__by">{subtitle ?? `Objectif ${target}`}</span>
          </div>
        )}
        {matchWins && (
          <span className="topbar__wins" aria-label="Manches gagnées">
            {matchWins[myTeam]} - {matchWins[myTeam === 0 ? 1 : 0]}
          </span>
        )}
      </div>
      <button
        type="button"
        className="score score--them"
        onClick={onScores}
        aria-label={`${teamLabels[1]} : ${scores[myTeam === 0 ? 1 : 0]} points. Voir le carton`}
      >
        <span className="score__label">{teamLabels[1]}</span>
        <span className="score__value">{scores[myTeam === 0 ? 1 : 0]}</span>
        <span className="score__bar" style={{ ['--p' as string]: Math.min(1, scores[myTeam === 0 ? 1 : 0] / target) }} />
      </button>
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
