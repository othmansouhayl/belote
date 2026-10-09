import type { BidAction, Contract, Seat, Suit } from '../engine/index.ts';

export const HUMAN: Seat = 0;

/** Places numérotées dans le sens anti-horaire : 1 à droite, 2 en face, 3 à gauche. */
export const POSITIONS = ['bottom', 'right', 'top', 'left'] as const;

export const PLAYER_NAMES: Record<Seat, string> = { 0: 'Vous', 1: 'Karim', 2: 'Leïla', 3: 'Sami' };

export const SUIT_SYMBOLS: Record<Suit, string> = { pique: '♠', coeur: '♥', carreau: '♦', trefle: '♣' };

export const isRed = (suit: Suit) => suit === 'coeur' || suit === 'carreau';

export const teamName = (team: 0 | 1) => (team === 0 ? 'Nous' : 'Eux');

export function contractValueLabel(value: Contract['value']): string {
  return value === 'capot' ? 'Capot' : String(value);
}

export function bidShortLabel(action: BidAction): string {
  switch (action.type) {
    case 'pass':
      return 'Passe';
    case 'coinche':
      return 'Coinche !';
    case 'surcoinche':
      return 'Surcoinche !';
    case 'bid':
      return `${contractValueLabel(action.value)} ${SUIT_SYMBOLS[action.suit]}`;
  }
}
