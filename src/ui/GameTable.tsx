import { useMemo } from 'react';
import { SEATS, winningCard } from '../engine/index.ts';
import type { GameAction, PlayerView, Seat, Team } from '../engine/index.ts';
import { BiddingPanel } from './BiddingPanel.tsx';
import { Hand } from './Hand.tsx';
import { PlayerSeat } from './PlayerSeat.tsx';
import { GameOverDialog, HandResultDialog } from './ResultDialogs.tsx';
import type { ContinueState } from './ResultDialogs.tsx';
import { TopBar } from './TopBar.tsx';
import { TrickArea } from './TrickArea.tsx';
import { bidShortLabel } from './labels.ts';
import type { SeatNames } from './labels.ts';
import type { TableEffects } from './useTableEffects.ts';

interface GameTableProps {
  readonly view: PlayerView;
  readonly names: SeatNames;
  readonly effects: TableEffects;
  readonly onAction: (action: GameAction) => void;
  readonly cont: ContinueState;
  readonly menuLabel: string;
  readonly onMenu: () => void;
  readonly absentSeats?: ReadonlySet<Seat>;
  /** Vrai pendant l'envoi d'une action au serveur : on évite les doubles envois. */
  readonly busy?: boolean;
  readonly banner?: string | null;
}

export function GameTable(props: GameTableProps) {
  const { view, names, effects, onAction, cont, menuLabel, onMenu, absentSeats, busy = false, banner } = props;
  const { pausedTrick, notice, beloteBubble } = effects;
  const mySeat = view.seat;
  const myTeam = (mySeat % 2) as Team;
  const myTurn = view.currentPlayer === mySeat && !pausedTrick && !busy;
  const trump = view.contract?.suit ?? null;

  const playable = useMemo(() => {
    if (!myTurn || view.phase !== 'playing') return null;
    const ids = new Set(view.legalCardIds);
    return view.hand.filter((c) => ids.has(c.id));
  }, [view, myTurn]);

  const bidBubbles = useMemo(() => {
    const bubbles = new Map<Seat, { text: string; strong: boolean }>();
    if (view.phase !== 'bidding') return bubbles;
    for (const { seat, action } of view.bidding.history) {
      bubbles.set(seat, { text: bidShortLabel(action), strong: action.type === 'coinche' || action.type === 'surcoinche' });
    }
    return bubbles;
  }, [view]);

  const shownTrick = pausedTrick ?? view.trick;
  const masterSeat =
    view.trick && view.trick.cards.length > 0 && trump && !pausedTrick ? winningCard(view.trick.cards, trump).seat : null;
  const waiting = view.currentPlayer !== null && view.currentPlayer !== mySeat && !pausedTrick ? view.currentPlayer : null;

  let status = '';
  if (busy) {
    status = 'Envoi en cours…';
  } else if (pausedTrick) {
    status = pausedTrick.winner === mySeat ? 'Vous remportez le pli' : `${names[pausedTrick.winner]} remporte le pli`;
  } else if (view.currentPlayer === mySeat && view.phase === 'bidding') {
    status = 'À vous de parler';
  } else if (view.currentPlayer === mySeat && view.phase === 'playing') {
    status = 'À vous de jouer : touchez une carte, puis confirmez';
  } else if (waiting !== null) {
    status = absentSeats?.has(waiting) ? `Attente du retour de ${names[waiting]}…` : `${names[waiting]} réfléchit…`;
  }

  return (
    <div className="app">
      <TopBar
        scores={view.scores}
        myTeam={myTeam}
        target={view.config.targetScore}
        contract={view.contract}
        names={names}
        menuLabel={menuLabel}
        onMenu={onMenu}
      />

      <main className="table">
        {banner && <div className="banner" role="status">{banner}</div>}
        {SEATS.map((seat) => {
          const bidBubble = bidBubbles.get(seat);
          return (
            <PlayerSeat
              key={seat}
              seat={seat}
              mySeat={mySeat}
              name={names[seat]}
              isDealer={view.dealer === seat}
              isActive={view.currentPlayer === seat && !pausedTrick}
              isTaker={view.contract?.bidder === seat}
              isAbsent={absentSeats?.has(seat) ?? false}
              cardsLeft={view.handCounts[seat] ?? 0}
              bubble={beloteBubble?.seat === seat ? beloteBubble.text : (bidBubble?.text ?? null)}
              highlightBubble={beloteBubble?.seat === seat || (bidBubble?.strong ?? false)}
            />
          );
        })}
        {shownTrick && <TrickArea cards={shownTrick.cards} winner={pausedTrick ? pausedTrick.winner : null} mySeat={mySeat} />}
        {masterSeat !== null && (
          <p className="table__hint">{masterSeat === mySeat ? 'Vous êtes maître' : `${names[masterSeat]} est maître`}</p>
        )}
        {notice && (
          <div className="toast" role="status">
            {notice}
          </div>
        )}
      </main>

      <footer className="dock">
        <p className={`dock__status${myTurn ? ' dock__status--turn' : ''}`} aria-live="polite">
          {status}
        </p>
        {myTurn && view.phase === 'bidding' && (
          <BiddingPanel
            key={`${view.handNumber}-${view.redeals}-${view.bidding.history.length}`}
            legal={view.legalBids}
            onBid={(bid) => onAction({ type: 'bid', bid })}
          />
        )}
        <Hand
          cards={view.hand}
          trump={trump}
          playable={playable}
          onPlay={(card) => onAction({ type: 'play', cardId: card.id })}
        />
      </footer>

      {view.phase === 'handOver' && !pausedTrick && view.lastHandResult && (
        <HandResultDialog
          result={view.lastHandResult}
          scores={view.scores}
          target={view.config.targetScore}
          myTeam={myTeam}
          names={names}
          cont={cont}
        />
      )}
      {view.phase === 'gameOver' && !pausedTrick && view.winner !== null && (
        <GameOverDialog
          winner={view.winner}
          lastHand={view.lastHandResult}
          scores={view.scores}
          hands={view.handHistory.length}
          myTeam={myTeam}
          mySeat={mySeat}
          names={names}
          cont={cont}
        />
      )}
    </div>
  );
}
