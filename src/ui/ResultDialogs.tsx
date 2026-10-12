import type { ReactNode } from 'react';
import type { HandResult, Team } from '../engine/index.ts';
import { SUIT_SYMBOLS, contractValueLabel, isRed } from './labels.ts';
import type { SeatNames } from './labels.ts';

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
      <button type="button" className="btn btn--primary btn--wide" onClick={cont.onContinue} disabled={cont.acked} autoFocus>
        {cont.acked ? 'En attente des autres joueurs…' : cont.label}
      </button>
      {cont.waitingNames.length > 0 && <p className="dialog__note dialog__note--after">En attente de : {cont.waitingNames.join(', ')}</p>}
    </>
  );
}

interface HandResultDialogProps {
  readonly result: HandResult;
  /** Le carton de score (totaux cumulés), affiché sous le résumé de la donne. */
  readonly sheet: ReactNode;
  readonly myTeam: Team;
  readonly names: SeatNames;
  readonly cont: ContinueState;
  /** Spectateur : pas de « nous », pas de bouton pour continuer. */
  readonly teamLabels?: readonly [string, string];
  readonly spectator?: boolean;
}

export function HandResultDialog(props: HandResultDialogProps) {
  const { result, sheet, myTeam, names, cont, teamLabels = ['Nous', 'Eux'], spectator = false } = props;
  const { contract } = result;
  const them: Team = myTeam === 0 ? 1 : 0;
  const good = result.success === (result.takerTeam === myTeam);
  const doubled = contract.surcoinchedBy !== null ? ' · surcontré' : contract.coinchedBy !== null ? ' · contré' : '';
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="hand-result-title">
      <div className="dialog">
        <h2 id="hand-result-title" className={`dialog__title${spectator ? '' : good ? ' dialog__title--good' : ' dialog__title--bad'}`}>
          {result.success ? 'Contrat réussi' : 'Contrat chuté'}
        </h2>
        <p className="dialog__subtitle">
          {names[contract.bidder]} : {contractValueLabel(contract.value)}{' '}
          <span className={isRed(contract.suit) ? 'suit-red' : undefined}>{SUIT_SYMBOLS[contract.suit]}</span>
          {doubled}
        </p>
        {result.capot && <p className="dialog__badge">{result.capot === 'annonce' ? 'كبوط annoncé' : 'كبوط !'}</p>}
        {result.ending.type === 'claim' && (
          <p className="dialog__note">
            Cartes étalées par {names[result.ending.seat] === 'Vous' ? 'vous' : names[result.ending.seat]} : les plis restants sont allés à
            son équipe.
          </p>
        )}
        {result.ending.type === 'capotFailed' && <p className="dialog__note">كبوط chuté dès le premier pli perdu.</p>}
        <p className="hand-summary">
          Donne : {teamLabels[0]} +{result.handScore[myTeam]} · {teamLabels[1]} +{result.handScore[them]}
          {result.roundedPoints && result.success && !result.capot && result.contract.coinchedBy === null && (
            <>
              {' · '}
              {result.casse ? (
                'casse'
              ) : (
                <span lang="ar" dir="rtl">
                  صحيحة
                </span>
              )}
            </>
          )}
          {(result.belotePoints[0] > 0 || result.belotePoints[1] > 0) && ' · belote'}
        </p>
        {sheet}
        {spectator ? <p className="dialog__note">Les joueurs lisent le score…</p> : <ContinueButton cont={cont} />}
      </div>
    </div>
  );
}
