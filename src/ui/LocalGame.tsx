import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { applyAction, createGame, getPlayerView, startNextHand } from '../engine/index.ts';
import type { GameAction, GameState, Seat } from '../engine/index.ts';
import { botView, chooseBotAction } from '../bots/simpleBot.ts';
import { GameTable } from './GameTable.tsx';
import { HUMAN, PLAYER_NAMES } from './labels.ts';
import { useTableEffects } from './useTableEffects.ts';

const BOT_BID_DELAY = 750;
const BOT_PLAY_DELAY = 650;

const newSeed = () => Math.random().toString(36).slice(2, 10);

/** Graine lue dans l'adresse (?graine=abc) pour rejouer une donne précise. */
function initialSeed(): string {
  const fromUrl = new URLSearchParams(window.location.search).get('graine');
  return fromUrl && fromUrl.trim() ? fromUrl.trim() : newSeed();
}

/** Partie hors ligne contre 3 bots : tout se passe dans le navigateur. */
interface LocalGameProps {
  readonly targetScore: number;
  readonly onExit: () => void;
}

export function LocalGame({ targetScore, onExit }: LocalGameProps) {
  const [game, setGame] = useState<GameState>(() => createGame({ seed: initialSeed(), rules: { targetScore } }));
  const gameRef = useRef(game);
  gameRef.current = game;

  const view = useMemo(() => getPlayerView(game, HUMAN), [game]);
  const effects = useTableEffects(view, PLAYER_NAMES);
  const { showNotice } = effects;

  const perform = useCallback(
    (seat: Seat, action: GameAction) => {
      const before = gameRef.current;
      // Un double appui rapide arrive après que le tour est passé : on l'ignore.
      if (seat === HUMAN && before.currentPlayer !== HUMAN) return;
      const result = applyAction(before, seat, action);
      if (!result.ok) {
        showNotice(result.error);
        return;
      }
      gameRef.current = result.state;
      setGame(result.state);
    },
    [showNotice],
  );

  // Tour des bots : ils jouent après un court délai, jamais pendant l'affichage d'un pli terminé.
  useEffect(() => {
    const seat = game.currentPlayer;
    if (effects.pausedTrick || seat === null || seat === HUMAN) return;
    if (game.phase !== 'bidding' && game.phase !== 'playing') return;
    const timer = setTimeout(
      () => perform(seat, chooseBotAction(botView(game, seat))),
      game.phase === 'bidding' ? BOT_BID_DELAY : BOT_PLAY_DELAY,
    );
    return () => clearTimeout(timer);
  }, [game, effects.pausedTrick, perform]);

  const onContinue = useCallback(() => {
    const current = gameRef.current;
    if (current.phase === 'gameOver') {
      setGame(createGame({ seed: newSeed(), rules: { targetScore } }));
      return;
    }
    const next = startNextHand(current);
    if (next.ok) setGame(next.state);
  }, [targetScore]);

  return (
    <GameTable
      view={view}
      names={PLAYER_NAMES}
      effects={effects}
      onAction={(action) => perform(HUMAN, action)}
      cont={{
        label: game.phase === 'gameOver' ? 'Nouvelle partie' : 'Manche suivante',
        acked: false,
        waitingNames: [],
        onContinue,
      }}
      onHome={onExit}
      menuLabel="Retour à l'accueil"
      onMenu={() => {
        if (window.confirm('Quitter cette partie et revenir à l’accueil ?')) onExit();
      }}
    />
  );
}
