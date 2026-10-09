import type { HandResult, Team } from '../engine/index.ts';
import { PLAYER_NAMES, SUIT_SYMBOLS, contractValueLabel } from './labels.ts';

const dash = (n: number) => (n === 0 ? '—' : String(n));

interface HandResultDialogProps {
  readonly result: HandResult;
  readonly scores: readonly [number, number];
  readonly target: number;
  readonly onNext: () => void;
}

export function HandResultDialog({ result, scores, target, onNext }: HandResultDialogProps) {
  const { contract } = result;
  const takerIsUs = result.takerTeam === 0;
  const good = result.success === takerIsUs;
  const doubled = contract.surcoinchedBy !== null ? ' · surcoinché' : contract.coinchedBy !== null ? ' · coinché' : '';
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="hand-result-title">
      <div className="dialog">
        <h2 id="hand-result-title" className={`dialog__title ${good ? 'dialog__title--good' : 'dialog__title--bad'}`}>
          {result.success ? 'Contrat réussi' : 'Contrat chuté'}
        </h2>
        <p className="dialog__subtitle">
          {PLAYER_NAMES[contract.bidder]} : {contractValueLabel(contract.value)} {SUIT_SYMBOLS[contract.suit]}
          {doubled}
        </p>
        {result.capot && (
          <p className="dialog__badge">{result.capot === 'annonce' ? 'Capot annoncé' : 'Capot !'}</p>
        )}
        <table className="score-table">
          <thead>
            <tr>
              <th scope="col" />
              <th scope="col">Nous</th>
              <th scope="col">Eux</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Points des plis</th>
              <td>{result.trickPoints[0]}</td>
              <td>{result.trickPoints[1]}</td>
            </tr>
            <tr>
              <th scope="row">Belote</th>
              <td>{dash(result.belotePoints[0])}</td>
              <td>{dash(result.belotePoints[1])}</td>
            </tr>
            <tr className="score-table__strong">
              <th scope="row">Score de la manche</th>
              <td>{result.handScore[0]}</td>
              <td>{result.handScore[1]}</td>
            </tr>
            <tr className="score-table__total">
              <th scope="row">Total (objectif {target})</th>
              <td>{scores[0]}</td>
              <td>{scores[1]}</td>
            </tr>
          </tbody>
        </table>
        <button type="button" className="btn btn--primary btn--wide" onClick={onNext} autoFocus>
          Manche suivante
        </button>
      </div>
    </div>
  );
}

interface GameOverDialogProps {
  readonly winner: Team;
  readonly lastHand: HandResult | null;
  readonly scores: readonly [number, number];
  readonly hands: number;
  readonly onNewGame: () => void;
}

export function GameOverDialog({ winner, lastHand, scores, hands, onNewGame }: GameOverDialogProps) {
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="game-over-title">
      <div className="dialog">
        <h2 id="game-over-title" className={`dialog__title ${winner === 0 ? 'dialog__title--good' : 'dialog__title--bad'}`}>
          {winner === 0 ? 'Victoire !' : 'Défaite'}
        </h2>
        <p className="dialog__subtitle">
          {winner === 0 ? 'Leïla et vous remportez la partie' : 'Karim et Sami remportent la partie'} en {hands} manche
          {hands > 1 ? 's' : ''}.
        </p>
        {lastHand && (
          <p className="dialog__note">
            Dernière manche : contrat {lastHand.success ? 'réussi' : 'chuté'} ({PLAYER_NAMES[lastHand.contract.bidder]},{' '}
            {contractValueLabel(lastHand.contract.value)} {SUIT_SYMBOLS[lastHand.contract.suit]}), Nous +{lastHand.handScore[0]}, Eux +
            {lastHand.handScore[1]}.
          </p>
        )}
        <div className="final-score">
          <div>
            <span className="final-score__label">Nous</span>
            <span className="final-score__value">{scores[0]}</span>
          </div>
          <div>
            <span className="final-score__label">Eux</span>
            <span className="final-score__value">{scores[1]}</span>
          </div>
        </div>
        <button type="button" className="btn btn--primary btn--wide" onClick={onNewGame} autoFocus>
          Nouvelle partie
        </button>
      </div>
    </div>
  );
}
