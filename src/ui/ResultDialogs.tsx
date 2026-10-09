import type { HandResult, Seat, Team } from '../engine/index.ts';
import { SUIT_SYMBOLS, contractValueLabel } from './labels.ts';
import type { SeatNames } from './labels.ts';

const dash = (n: number) => (n === 0 ? '—' : String(n));

export interface ContinueState {
  readonly label: string;
  /** Vrai quand le joueur a déjà demandé à continuer (en ligne, on attend les autres). */
  readonly acked: boolean;
  readonly waitingNames: readonly string[];
  readonly onContinue: () => void;
}

function ContinueButton({ cont }: { readonly cont: ContinueState }) {
  return (
    <>
      <button
        type="button"
        className="btn btn--primary btn--wide"
        onClick={cont.onContinue}
        disabled={cont.acked}
        autoFocus
      >
        {cont.acked ? 'En attente des autres joueurs…' : cont.label}
      </button>
      {cont.waitingNames.length > 0 && (
        <p className="dialog__note dialog__note--after">En attente de : {cont.waitingNames.join(', ')}</p>
      )}
    </>
  );
}

interface HandResultDialogProps {
  readonly result: HandResult;
  readonly scores: readonly [number, number];
  readonly target: number;
  readonly myTeam: Team;
  readonly names: SeatNames;
  readonly cont: ContinueState;
}

export function HandResultDialog({ result, scores, target, myTeam, names, cont }: HandResultDialogProps) {
  const { contract } = result;
  const them: Team = myTeam === 0 ? 1 : 0;
  const good = result.success === (result.takerTeam === myTeam);
  const doubled = contract.surcoinchedBy !== null ? ' · surcoinché' : contract.coinchedBy !== null ? ' · coinché' : '';
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="hand-result-title">
      <div className="dialog">
        <h2 id="hand-result-title" className={`dialog__title ${good ? 'dialog__title--good' : 'dialog__title--bad'}`}>
          {result.success ? 'Contrat réussi' : 'Contrat chuté'}
        </h2>
        <p className="dialog__subtitle">
          {names[contract.bidder]} : {contractValueLabel(contract.value)} {SUIT_SYMBOLS[contract.suit]}
          {doubled}
        </p>
        {result.capot && <p className="dialog__badge">{result.capot === 'annonce' ? 'Capot annoncé' : 'Capot !'}</p>}
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
              <td>{result.trickPoints[myTeam]}</td>
              <td>{result.trickPoints[them]}</td>
            </tr>
            <tr>
              <th scope="row">Belote</th>
              <td>{dash(result.belotePoints[myTeam])}</td>
              <td>{dash(result.belotePoints[them])}</td>
            </tr>
            <tr className="score-table__strong">
              <th scope="row">Score de la manche</th>
              <td>{result.handScore[myTeam]}</td>
              <td>{result.handScore[them]}</td>
            </tr>
            <tr className="score-table__total">
              <th scope="row">Total (objectif {target})</th>
              <td>{scores[myTeam]}</td>
              <td>{scores[them]}</td>
            </tr>
          </tbody>
        </table>
        <ContinueButton cont={cont} />
      </div>
    </div>
  );
}

interface GameOverDialogProps {
  readonly winner: Team;
  readonly lastHand: HandResult | null;
  readonly scores: readonly [number, number];
  readonly hands: number;
  readonly myTeam: Team;
  readonly mySeat: Seat;
  readonly names: SeatNames;
  readonly cont: ContinueState;
}

export function GameOverDialog({ winner, lastHand, scores, hands, myTeam, mySeat, names, cont }: GameOverDialogProps) {
  const them: Team = myTeam === 0 ? 1 : 0;
  const winners = ([0, 1, 2, 3] as Seat[]).filter((s) => s % 2 === winner);
  const winnerText =
    winner === myTeam
      ? `${names[winners.find((s) => s !== mySeat)!]} et vous remportez la partie`
      : `${names[winners[0]!]} et ${names[winners[1]!]} remportent la partie`;
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="game-over-title">
      <div className="dialog">
        <h2 id="game-over-title" className={`dialog__title ${winner === myTeam ? 'dialog__title--good' : 'dialog__title--bad'}`}>
          {winner === myTeam ? 'Victoire !' : 'Défaite'}
        </h2>
        <p className="dialog__subtitle">
          {winnerText} en {hands} manche{hands > 1 ? 's' : ''}.
        </p>
        {lastHand && (
          <p className="dialog__note">
            Dernière manche : contrat {lastHand.success ? 'réussi' : 'chuté'} ({names[lastHand.contract.bidder]},{' '}
            {contractValueLabel(lastHand.contract.value)} {SUIT_SYMBOLS[lastHand.contract.suit]}), Nous +
            {lastHand.handScore[myTeam]}, Eux +{lastHand.handScore[them]}.
          </p>
        )}
        <div className="final-score">
          <div>
            <span className="final-score__label">Nous</span>
            <span className="final-score__value">{scores[myTeam]}</span>
          </div>
          <div>
            <span className="final-score__label">Eux</span>
            <span className="final-score__value">{scores[them]}</span>
          </div>
        </div>
        <ContinueButton cont={cont} />
      </div>
    </div>
  );
}
