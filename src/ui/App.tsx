import { useMemo } from 'react';
import { SEATS, legalBids, legalCards, winningCard } from '../engine/index.ts';
import type { Seat } from '../engine/index.ts';
import { BiddingPanel } from './BiddingPanel.tsx';
import { Hand } from './Hand.tsx';
import { PlayerSeat } from './PlayerSeat.tsx';
import { GameOverDialog, HandResultDialog } from './ResultDialogs.tsx';
import { TopBar } from './TopBar.tsx';
import { TrickArea } from './TrickArea.tsx';
import { HUMAN, PLAYER_NAMES, bidShortLabel } from './labels.ts';
import { useLocalGame } from './useLocalGame.ts';

export function App() {
  const { game, pausedTrick, notice, beloteBubble, waitingFor, perform, nextHand, newGame } = useLocalGame();
  const humanTurn = game.currentPlayer === HUMAN && !pausedTrick;
  const trump = game.contract?.suit ?? null;

  const bids = useMemo(() => (humanTurn && game.phase === 'bidding' ? legalBids(game, HUMAN) : []), [game, humanTurn]);
  const playable = useMemo(
    () => (humanTurn && game.phase === 'playing' ? legalCards(game, HUMAN) : null),
    [game, humanTurn],
  );

  const bidBubbles = useMemo(() => {
    const bubbles = new Map<Seat, { text: string; strong: boolean }>();
    if (game.phase !== 'bidding') return bubbles;
    for (const { seat, action } of game.bidding.history) {
      bubbles.set(seat, { text: bidShortLabel(action), strong: action.type === 'coinche' || action.type === 'surcoinche' });
    }
    return bubbles;
  }, [game]);

  const shownTrick = pausedTrick ?? game.trick;
  const trickWinner = pausedTrick ? pausedTrick.winner : null;

  let status: string;
  if (pausedTrick) {
    status = pausedTrick.winner === HUMAN ? 'Vous remportez le pli' : `${PLAYER_NAMES[pausedTrick.winner]} remporte le pli`;
  } else if (humanTurn && game.phase === 'bidding') {
    status = 'À vous de parler';
  } else if (humanTurn && game.phase === 'playing') {
    status = 'À vous de jouer : touchez une carte, puis confirmez';
  } else if (waitingFor) {
    status = `${waitingFor} réfléchit…`;
  } else {
    status = '';
  }

  const masterSeat = game.trick && game.trick.cards.length > 0 && trump ? winningCard(game.trick.cards, trump).seat : null;

  return (
    <div className="app">
      <TopBar scores={game.scores} target={game.config.targetScore} contract={game.contract} onNewGame={newGame} />

      <main className="table">
        {SEATS.map((seat) => {
          const bubble = beloteBubble?.seat === seat ? beloteBubble.text : (bidBubbles.get(seat)?.text ?? null);
          return (
            <PlayerSeat
              key={seat}
              seat={seat}
              isDealer={game.dealer === seat}
              isActive={game.currentPlayer === seat && !pausedTrick}
              isTaker={game.contract?.bidder === seat}
              cardsLeft={game.hands[seat]?.length ?? 0}
              bubble={bubble}
              highlightBubble={beloteBubble?.seat === seat || (bidBubbles.get(seat)?.strong ?? false)}
            />
          );
        })}
        {shownTrick && <TrickArea cards={shownTrick.cards} winner={trickWinner} />}
        {masterSeat !== null && !pausedTrick && (
          <p className="table__hint">{masterSeat === HUMAN ? 'Vous êtes maître' : `${PLAYER_NAMES[masterSeat]} est maître`}</p>
        )}
        {notice && (
          <div className="toast" role="status">
            {notice}
          </div>
        )}
      </main>

      <footer className="dock">
        <p className={`dock__status${humanTurn ? ' dock__status--turn' : ''}`} aria-live="polite">
          {status}
        </p>
        {humanTurn && game.phase === 'bidding' && (
          <BiddingPanel
            key={`${game.handNumber}-${game.redeals}-${game.bidding.history.length}`}
            legal={bids}
            onBid={(bid) => perform(HUMAN, { type: 'bid', bid })}
          />
        )}
        <Hand
          cards={game.hands[HUMAN] ?? []}
          trump={trump}
          playable={playable}
          onPlay={(card) => perform(HUMAN, { type: 'play', cardId: card.id })}
        />
      </footer>

      {game.phase === 'handOver' && !pausedTrick && game.lastHandResult && (
        <HandResultDialog
          result={game.lastHandResult}
          scores={game.scores}
          target={game.config.targetScore}
          onNext={nextHand}
        />
      )}
      {game.phase === 'gameOver' && !pausedTrick && game.winner !== null && (
        <GameOverDialog winner={game.winner} lastHand={game.lastHandResult} scores={game.scores} hands={game.handHistory.length} onNewGame={newGame} />
      )}
    </div>
  );
}
