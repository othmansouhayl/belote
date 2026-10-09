import type { FinalContract, Team } from '../engine/index.ts';
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
}

export function TopBar({ scores, myTeam, target, contract, names, subtitle, menuLabel, onMenu }: TopBarProps) {
  return (
    <header className="topbar">
      <div className="score score--us">
        <span className="score__label">Nous</span>
        <span className="score__value">{scores[myTeam]}</span>
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
        <span className="score__label">Eux</span>
        <span className="score__value">{scores[myTeam === 0 ? 1 : 0]}</span>
      </div>
      <button type="button" className="topbar__menu" aria-label={menuLabel} title={menuLabel} onClick={onMenu}>
        ☰
      </button>
    </header>
  );
}
