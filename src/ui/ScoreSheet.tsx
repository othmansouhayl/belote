import { useEffect, useRef } from 'react';
import type { MatchGame, Team } from '../engine/index.ts';
import { sheetValue, winsLabel } from './scoreSheet.ts';
import type { SheetRow } from './scoreSheet.ts';

interface ScoreSheetProps {
  /** Manches déjà terminées avant la manche en cours (leur dernière ligne suffit). */
  readonly previous: readonly MatchGame[];
  /** Lignes de la manche en cours : totaux cumulés après chaque donne. */
  readonly rows: readonly SheetRow[];
  /** Compteur de manches gagnées à écrire sous la manche en cours (quand elle est finie). */
  readonly counterAfter?: readonly [number, number] | null;
  /** Match terminé : le compteur final est entouré. */
  readonly final?: boolean;
  /** Équipe gagnante du match (sa lettre est soulignée). */
  readonly matchWinner?: Team | null;
  readonly myTeam: Team;
}

/** Le signe ≠ (« mille »), tracé au stylo comme sur la feuille. */
function Thousand() {
  return (
    <svg className="sheet__neq" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M3 8.5c4.5-.6 9.5-.8 14-.3M3.5 13c4.5-.5 9-.6 13.5-.2M13.5 3.5 7 17" />
    </svg>
  );
}

/** Un nombre écrit au stylo : les ≠ en tête sont dessinés, le reste en écriture manuscrite. */
function Pen({ value }: { readonly value: string }) {
  const marks = value.length - value.replace(/^≠+/, '').length;
  const digits = value.slice(marks);
  const thousands = marks > 0 ? ` (plus ${marks * 1000})` : '';
  return (
    <span className="sheet__pen" aria-label={`${digits}${thousands}`}>
      {Array.from({ length: marks }, (_, i) => (
        <Thousand key={i} />
      ))}
      {digits}
    </span>
  );
}

function Counter({ wins, myTeam, circled }: { readonly wins: readonly [number, number]; readonly myTeam: Team; readonly circled?: boolean }) {
  return (
    <div className="sheet__counter" role="note" aria-label={`Manches gagnées : ${winsLabel(wins, myTeam)}`}>
      <span className="sheet__rule" aria-hidden="true" />
      <span className={`sheet__wins${circled ? ' sheet__wins--final' : ''}`}>{winsLabel(wins, myTeam)}</span>
      <span className="sheet__rule" aria-hidden="true" />
    </div>
  );
}

/**
 * Le carton de score : un vrai bout de paquet de Mars légères (image de fond, jamais modifiée)
 * sur lequel les points sont « écrits au stylo bleu » par le code.
 */
export function ScoreSheet({ previous, rows, counterAfter = null, final = false, matchWinner = null, myTeam }: ScoreSheetProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const them: Team = myTeam === 0 ? 1 : 0;
  // On voit toujours la dernière ligne écrite.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [rows.length, previous.length, counterAfter]);

  const wins: [number, number] = [0, 0];
  return (
    <div className="sheet-card">
      <div className="sheet-card__paper">
        <div className="sheet__head" aria-hidden="true">
          <span className={matchWinner === myTeam ? 'sheet__letter sheet__letter--won' : 'sheet__letter'}>N</span>
          <span className={matchWinner === them ? 'sheet__letter sheet__letter--won' : 'sheet__letter'}>V</span>
        </div>
        <div className="sheet__body" ref={scrollRef}>
          <table className="sheet__table">
            <caption className="visually-hidden">Score : Nous à gauche, Vous à droite</caption>
            <tbody>
              {previous.map((game, i) => {
                wins[game.winner] += 1;
                return (
                  <tr key={`m${i}`} className="sheet__manche">
                    <td colSpan={2}>
                      <div className="sheet__line">
                        <Pen value={sheetValue(game.scores[myTeam])} />
                        <Pen value={sheetValue(game.scores[them])} />
                      </div>
                      <Counter wins={[...wins] as [number, number]} myTeam={myTeam} />
                    </td>
                  </tr>
                );
              })}
              {rows.map((row, i) => (
                <tr key={i}>
                  <td>
                    <Pen value={row.n} />
                  </td>
                  <td>
                    <Pen value={row.v} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {counterAfter && <Counter wins={counterAfter} myTeam={myTeam} circled={final} />}
        </div>
      </div>
    </div>
  );
}
