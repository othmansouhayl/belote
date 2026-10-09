import type { CompletedTrick, FinalContract, HandResult, Seat, Team } from './types.ts';
import type { RulesConfig } from './rulesConfig.ts';
import { cardPoints } from './deck.ts';
import { teamOf } from './seats.ts';

export const TOTAL_HAND_POINTS = 162;

/** Points des cartes + dix de der, et nombre de plis, par équipe (§2.1, §7.6). */
export function calculateHandPoints(
  tricks: readonly CompletedTrick[],
  contract: Pick<FinalContract, 'suit'>,
  config: RulesConfig,
): { trickPoints: [number, number]; tricksWon: [number, number] } {
  const trickPoints: [number, number] = [0, 0];
  const tricksWon: [number, number] = [0, 0];
  tricks.forEach((trick, index) => {
    const team = teamOf(trick.winner);
    tricksWon[team] += 1;
    for (const { card } of trick.cards) trickPoints[team] += cardPoints(card, contract.suit);
    if (index === tricks.length - 1) trickPoints[team] += config.lastTrickBonus;
  });
  return { trickPoints, tricksWon };
}

/**
 * Juge le contrat et calcule le score de la manche (§9).
 * Les points de plis, les bonus, le seuil contractuel et le score de manche restent séparés.
 */
export function resolveContract(
  tricks: readonly CompletedTrick[],
  contract: FinalContract,
  beloteHolder: Seat | null,
  config: RulesConfig,
): HandResult {
  if (tricks.length !== 8) throw new Error('Une manche comprend 8 plis.');
  const { trickPoints, tricksWon } = calculateHandPoints(tricks, contract, config);
  const taker = teamOf(contract.bidder);
  const defense = (1 - taker) as Team;
  const mult = contract.multiplier;
  const beloteTeam = beloteHolder === null ? null : teamOf(beloteHolder);

  const belotePoints: [number, number] = [0, 0];
  if (beloteTeam !== null) belotePoints[beloteTeam] = config.belotePoints;

  const contractPoints: [number, number] = config.beloteCountsForContract
    ? [trickPoints[0] + belotePoints[0], trickPoints[1] + belotePoints[1]]
    : [trickPoints[0], trickPoints[1]];

  const handScore: [number, number] = [0, 0];
  let success: boolean;
  let capot: HandResult['capot'] = null;

  if (contract.value === 'capot') {
    capot = 'annonce';
    success = tricksWon[taker] === 8;
    const capotMult = config.capotMultiplied ? mult : 1;
    if (success) handScore[taker] = config.capotAnnouncedSuccessPoints * capotMult;
    else handScore[defense] = config.capotAnnouncedFailurePoints * capotMult;
  } else {
    const value = contract.value;
    success = contractPoints[taker] >= value && contractPoints[taker] > contractPoints[defense];
    if (success) {
      const unannouncedCapot = tricksWon[taker] === 8;
      if (unannouncedCapot) capot = 'non-annonce';
      let takerBase: number;
      if (config.contractSuccessScoring === 'contractPlusPoints') {
        takerBase = (unannouncedCapot ? config.capotUnannouncedPoints : trickPoints[taker]) + value;
      } else {
        takerBase = unannouncedCapot ? config.capotUnannouncedPoints : value;
      }
      const capotMult = unannouncedCapot && !config.capotMultiplied ? 1 : mult;
      handScore[taker] = takerBase * capotMult;
      handScore[defense] = trickPoints[defense];
    } else {
      handScore[defense] = (config.failedContractBasePoints + value) * mult;
    }
  }

  if (beloteTeam !== null) {
    const handWinner = success ? taker : defense;
    if (config.beloteAlwaysScored || beloteTeam === handWinner) handScore[beloteTeam] += config.belotePoints;
  }

  return {
    contract,
    takerTeam: taker,
    trickPoints,
    tricksWon,
    belotePoints,
    contractPoints,
    success,
    capot,
    handScore,
  };
}

/** Ajoute le score de manche au score général et détermine un éventuel vainqueur (§10). */
export function applyHandScore(
  scores: readonly [number, number],
  result: HandResult,
  config: RulesConfig,
): { scores: [number, number]; winner: Team | null } {
  const next: [number, number] = [scores[0] + result.handScore[0], scores[1] + result.handScore[1]];
  const reached = next[0] >= config.targetScore || next[1] >= config.targetScore;
  // Égalité au-delà de la cible : une donne de plus (tieBreakRule 'extraHand').
  if (!reached || next[0] === next[1]) return { scores: next, winner: null };
  return { scores: next, winner: next[0] > next[1] ? 0 : 1 };
}
