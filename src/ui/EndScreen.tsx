import type { HandResult, Seat, Team } from '../engine/index.ts';
import type { ContinueState } from './ResultDialogs.tsx';
import { SUIT_SYMBOLS, contractValueLabel, isRed } from './labels.ts';
import type { SeatNames } from './labels.ts';
import { matchSheet, teamStats } from './gameStats.ts';

interface EndScreenProps {
  readonly winner: Team;
  readonly history: readonly HandResult[];
  readonly scores: readonly [number, number];
  readonly target: number;
  readonly myTeam: Team;
  readonly mySeat: Seat;
  readonly names: SeatNames;
  readonly cont: ContinueState;
  readonly onHome?: () => void;
  readonly teamLabels?: readonly [string, string];
  readonly spectator?: boolean;
}

const CONFETTI_COLORS = ['#f0c35a', '#7cc4ff', '#ff9f80', '#8fe3a8', '#ffffff'];

/** Écran de fin de partie : vainqueur, score final, statistiques et feuille de match. */
export function EndScreen(props: EndScreenProps) {
  const { winner, history, scores, target, myTeam, mySeat, names, cont, onHome, teamLabels = ['Nous', 'Eux'], spectator = false } = props;
  const them: Team = myTeam === 0 ? 1 : 0;
  const victory = !spectator && winner === myTeam;
  const winners = ([0, 1, 2, 3] as Seat[]).filter((s) => s % 2 === winner);
  const partner = winners.find((s) => s !== mySeat);
  const subtitle = spectator
    ? `${names[winners[0]!]} et ${names[winners[1]!]} remportent la partie`
    : victory
    ? `${partner !== undefined ? names[partner] : 'Votre partenaire'} et vous remportez la partie`
    : `${names[winners[0]!]} et ${names[winners[1]!]} remportent la partie`;
  const ours = teamStats(history, myTeam);
  const theirs = teamStats(history, them);
  const rows = matchSheet(history, myTeam);

  const statRows: readonly [string, string, string][] = [
    ['Contrats réussis', `${ours.contractsMade} / ${ours.contractsTaken}`, `${theirs.contractsMade} / ${theirs.contractsTaken}`],
    ['Capots', String(ours.capots), String(theirs.capots)],
    ['Belotes', String(ours.belotes), String(theirs.belotes)],
    ['Coinches', String(ours.coinches), String(theirs.coinches)],
  ];

  return (
    <div className="end" role="dialog" aria-modal="true" aria-labelledby="game-over-title">
      {victory && (
        <div className="confetti" aria-hidden="true">
          {Array.from({ length: 36 }, (_, i) => (
            <span
              key={i}
              className="confetti__piece"
              style={{
                ['--x' as string]: `${(i * 37) % 100}%`,
                ['--d' as string]: `${(i % 9) * 0.18}s`,
                ['--r' as string]: `${(i * 53) % 360}deg`,
                background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
              }}
            />
          ))}
        </div>
      )}

      <div className="end__panel">
        <p className="end__eyebrow">Fin de la partie · objectif {target} points</p>
        <h2 id="game-over-title" className={`end__title ${victory ? 'end__title--win' : 'end__title--lose'}`}>
          {spectator ? 'Fin de la partie' : victory ? 'Victoire !' : 'Défaite'}
        </h2>
        <p className="end__subtitle">
          {subtitle} en {history.length} manche{history.length > 1 ? 's' : ''}.
        </p>

        <div className="end__score">
          <div className={`end__team${winner === myTeam ? ' end__team--winner' : ''}`}>
            <span className="end__team-label">{teamLabels[0]}</span>
            <span className="end__team-value">{scores[myTeam]}</span>
          </div>
          <span className="end__dash" aria-hidden="true">
            –
          </span>
          <div className={`end__team${winner !== myTeam ? ' end__team--winner' : ''}`}>
            <span className="end__team-label">{teamLabels[1]}</span>
            <span className="end__team-value">{scores[them]}</span>
          </div>
        </div>

        <table className="end__stats">
          <thead>
            <tr>
              <th scope="col" />
              <th scope="col">{teamLabels[0]}</th>
              <th scope="col">{teamLabels[1]}</th>
            </tr>
          </thead>
          <tbody>
            {statRows.map(([label, a, b]) => (
              <tr key={label}>
                <th scope="row">{label}</th>
                <td>{a}</td>
                <td>{b}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <details className="end__sheet">
          <summary>Feuille de match ({rows.length} manches)</summary>
          <table className="sheet">
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">Contrat</th>
                <th scope="col">{teamLabels[0]}</th>
                <th scope="col">{teamLabels[1]}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ index, result, us, them: t, totalUs, totalThem }) => {
                const c = result.contract;
                const doubled = c.surcoinchedBy !== null ? ' ×4' : c.coinchedBy !== null ? ' ×2' : '';
                return (
                  <tr key={index} className={result.success ? '' : 'sheet__row--fail'}>
                    <td>{index}</td>
                    <td>
                      <span className="sheet__who">{names[c.bidder]}</span>{' '}
                      {contractValueLabel(c.value)}{' '}
                      <span className={isRed(c.suit) ? 'sheet__suit--red' : ''}>{SUIT_SYMBOLS[c.suit]}</span>
                      {doubled}
                      <span className="sheet__result">{result.success ? ' réussi' : ' chuté'}</span>
                    </td>
                    <td>
                      +{us}
                      <span className="sheet__total">{totalUs}</span>
                    </td>
                    <td>
                      +{t}
                      <span className="sheet__total">{totalThem}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </details>

        {!spectator && (
          <button type="button" className="btn btn--primary btn--wide" onClick={cont.onContinue} disabled={cont.acked} autoFocus>
            {cont.acked ? 'En attente des autres joueurs…' : cont.label}
          </button>
        )}
        {!spectator && cont.waitingNames.length > 0 && (
          <p className="dialog__note dialog__note--after">En attente de : {cont.waitingNames.join(', ')}</p>
        )}
        {onHome && (
          <button type="button" className="btn btn--link btn--wide" onClick={onHome}>
            Retour à l'accueil
          </button>
        )}
      </div>
    </div>
  );
}
