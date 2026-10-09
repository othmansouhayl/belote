import type { Seat, Team } from './types.ts';
import type { RulesConfig } from './rulesConfig.ts';

export const SEATS: readonly Seat[] = [0, 1, 2, 3];

export function nextSeat(seat: Seat, direction: RulesConfig['playDirection']): Seat {
  return ((direction === 'counterclockwise' ? seat + 1 : seat + 3) % 4) as Seat;
}

export function teamOf(seat: Seat): Team {
  return (seat % 2) as Team;
}

export function partnerOf(seat: Seat): Seat {
  return ((seat + 2) % 4) as Seat;
}
