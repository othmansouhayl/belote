import { useCallback, useEffect, useRef, useState } from 'react';
import { applyAction, createGame, startNextHand } from '../engine/index.ts';
import type { CompletedTrick, GameAction, GameState, Seat } from '../engine/index.ts';
import { botView, chooseBotAction } from '../bots/simpleBot.ts';
import { HUMAN, PLAYER_NAMES, SUIT_SYMBOLS, contractValueLabel } from './labels.ts';

const BOT_BID_DELAY = 750;
const BOT_PLAY_DELAY = 650;
const TRICK_PAUSE = 1300;
const NOTICE_DURATION = 2600;

function newSeed(): string {
  return Math.random().toString(36).slice(2, 10);
}

/** Graine lue dans l'adresse (?graine=abc) pour rejouer une donne précise. */
function initialSeed(): string {
  const fromUrl = new URLSearchParams(window.location.search).get('graine');
  return fromUrl && fromUrl.trim() ? fromUrl.trim() : newSeed();
}

export interface Bubble {
  readonly seat: Seat;
  readonly text: string;
}

export function useLocalGame() {
  const [game, setGame] = useState<GameState>(() => createGame({ seed: initialSeed() }));
  const [pausedTrick, setPausedTrick] = useState<CompletedTrick | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [beloteBubble, setBeloteBubble] = useState<Bubble | null>(null);
  const gameRef = useRef(game);
  gameRef.current = game;

  const perform = useCallback((seat: Seat, action: GameAction) => {
    const before = gameRef.current;
    const result = applyAction(before, seat, action);
    if (!result.ok) {
      setNotice(result.error);
      return;
    }
    const next = result.state;
    if (next.redeals > before.redeals) setNotice('Tout le monde a passé : nouvelle donne.');
    if (before.phase === 'bidding' && next.phase === 'playing' && next.contract) {
      const c = next.contract;
      const doubled = c.surcoinchedBy !== null ? ', surcoinché' : c.coinchedBy !== null ? ', coinché' : '';
      const who = c.bidder === HUMAN ? 'Vous prenez' : `${PLAYER_NAMES[c.bidder]} prend`;
      setNotice(`${who} à ${contractValueLabel(c.value)} ${SUIT_SYMBOLS[c.suit]}${doubled}`);
    }
    if (next.completedTricks.length > before.completedTricks.length) {
      setPausedTrick(next.completedTricks[next.completedTricks.length - 1]!);
    }
    const belote = next.beloteEvents[before.beloteEvents.length];
    if (belote) setBeloteBubble({ seat: belote.seat, text: belote.announce === 'belote' ? 'Belote !' : 'Rebelote !' });
    gameRef.current = next;
    setGame(next);
  }, []);

  useEffect(() => {
    if (!pausedTrick) return;
    const timer = setTimeout(() => setPausedTrick(null), TRICK_PAUSE);
    return () => clearTimeout(timer);
  }, [pausedTrick]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), NOTICE_DURATION);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!beloteBubble) return;
    const timer = setTimeout(() => setBeloteBubble(null), NOTICE_DURATION);
    return () => clearTimeout(timer);
  }, [beloteBubble]);

  // Tour des bots : ils jouent après un court délai, jamais pendant l'affichage d'un pli terminé.
  useEffect(() => {
    const seat = game.currentPlayer;
    if (pausedTrick || seat === null || seat === HUMAN) return;
    if (game.phase !== 'bidding' && game.phase !== 'playing') return;
    const delay = game.phase === 'bidding' ? BOT_BID_DELAY : BOT_PLAY_DELAY;
    const timer = setTimeout(() => perform(seat, chooseBotAction(botView(game, seat))), delay);
    return () => clearTimeout(timer);
  }, [game, pausedTrick, perform]);

  const nextHand = useCallback(() => {
    const result = startNextHand(gameRef.current);
    if (result.ok) setGame(result.state);
  }, []);

  const newGame = useCallback(() => {
    setPausedTrick(null);
    setNotice(null);
    setBeloteBubble(null);
    setGame(createGame({ seed: newSeed() }));
  }, []);

  const waitingFor =
    game.currentPlayer !== null && game.currentPlayer !== HUMAN && !pausedTrick
      ? PLAYER_NAMES[game.currentPlayer]
      : null;

  return { game, pausedTrick, notice, beloteBubble, waitingFor, perform, nextHand, newGame };
}
