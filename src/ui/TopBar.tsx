import type { FinalContract } from '../engine/index.ts';
import { PLAYER_NAMES, SUIT_SYMBOLS, contractValueLabel, isRed } from './labels.ts';

interface TopBarProps {
  readonly scores: readonly [number, number];
  readonly target: number;
  readonly contract: FinalContract | null;
  readonly onNewGame: () => void;
}

export function TopBar({ scores, target, contract, onNewGame }: TopBarProps) {
  return (
    <header className="topbar">
      <div className="score score--us">
        <span className="score__label">Nous</span>
        <span className="score__value">{scores[0]}</span>
      </div>
      <div className="topbar__center">
        {contract ? (
          <div className="contract" aria-label="Contrat en cours">
            <span className={`contract__main${isRed(contract.suit) ? ' contract__main--red' : ''}`}>
              {contractValueLabel(contract.value)} {SUIT_SYMBOLS[contract.suit]}
            </span>
            <span className="contract__by">
              {PLAYER_NAMES[contract.bidder]}
              {contract.surcoinchedBy !== null ? ' · surcoinché ×4' : contract.coinchedBy !== null ? ' · coinché ×2' : ''}
            </span>
          </div>
        ) : (
          <div className="contract contract--empty">
            <span className="contract__main">Enchères</span>
            <span className="contract__by">Objectif {target}</span>
          </div>
        )}
      </div>
      <div className="score score--them">
        <span className="score__label">Eux</span>
        <span className="score__value">{scores[1]}</span>
      </div>
      <button
        type="button"
        className="topbar__menu"
        aria-label="Nouvelle partie"
        onClick={() => {
          if (window.confirm('Abandonner cette partie et en commencer une nouvelle ?')) onNewGame();
        }}
      >
        ↻
      </button>
    </header>
  );
}
