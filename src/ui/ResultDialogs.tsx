import type { HandResult, Team } from '../engine/index.ts';
import { SUIT_SYMBOLS, contractValueLabel, isRed } from './labels.ts';
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
  /** Spectateur : pas de « nous », pas de bouton pour continuer. */
  readonly teamLabels?: readonly [string, string];
  readonly spectator?: boolean;
}

export function HandResultDialog(props: HandResultDialogProps) {
  const { result, scores, target, myTeam, names, cont, teamLabels = ['Nous', 'Eux'], spectator = false } = props;
  const { contract } = result;
  const them: Team = myTeam === 0 ? 1 : 0;
  const good = result.success === (result.takerTeam === myTeam);
  const doubled = contract.surcoinchedBy !== null ? ' · surcoinché' : contract.coinchedBy !== null ? ' · coinché' : '';
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="hand-result-title">
      <div className="dialog">
        <h2
          id="hand-result-title"
          className={`dialog__title${spectator ? '' : good ? ' dialog__title--good' : ' dialog__title--bad'}`}
        >
          {result.success ? 'Contrat réussi' : 'Contrat chuté'}
        </h2>
        <p className="dialog__subtitle">
          {names[contract.bidder]} : {contractValueLabel(contract.value)}{' '}
          <span className={isRed(contract.suit) ? 'suit-red' : undefined}>{SUIT_SYMBOLS[contract.suit]}</span>
          {doubled}
        </p>
        {result.capot && <p className="dialog__badge">{result.capot === 'annonce' ? 'Capot annoncé' : 'Capot !'}</p>}
        {result.ending.type === 'claim' && (
          <p className="dialog__note">
            Cartes étalées par {names[result.ending.seat] === 'Vous' ? 'vous' : names[result.ending.seat]} : les plis
            restants sont allés à son équipe.
          </p>
        )}
        {result.ending.type === 'capotFailed' && <p className="dialog__note">Capot chuté dès le premier pli perdu.</p>}
        <table className="score-table">
          <thead>
            <tr>
              <th scope="col" />
              <th scope="col">{teamLabels[0]}</th>
              <th scope="col">{teamLabels[1]}</th>
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
        {spectator ? <p className="dialog__note">Les joueurs lisent le score…</p> : <ContinueButton cont={cont} />}
      </div>
    </div>
  );
}
