import type { Card, CompletedTrick, FinalContract, HandEnding, HandResult, Seat, Team } from './types.ts';
import type { RulesConfig } from './rulesConfig.ts';
import { cardPoints } from './deck.ts';
import { teamOf } from './seats.ts';

export const TOTAL_HAND_POINTS = 162;

/**
 * Cartes encore en main quand la manche s'arrête avant le 8e pli (cartes étalées, capot chuté) :
 * elles reviennent à `team`, avec le dix de der.
 */
export interface HandRemainder {
  readonly team: Team;
  readonly cards: readonly Card[];
}

/** Points des cartes + dix de der, et nombre de plis, par équipe (§2.1, §7.6). */
export function calculateHandPoints(
  tricks: readonly CompletedTrick[],
  contract: Pick<FinalContract, 'suit'>,
  config: RulesConfig,
  remainder: HandRemainder | null = null,
): { trickPoints: [number, number]; tricksWon: [number, number] } {
  const trickPoints: [number, number] = [0, 0];
  const tricksWon: [number, number] = [0, 0];
  tricks.forEach((trick, index) => {
    const team = teamOf(trick.winner);
    tricksWon[team] += 1;
    for (const { card } of trick.cards) trickPoints[team] += cardPoints(card, contract.suit);
    if (index === tricks.length - 1 && !remainder) trickPoints[team] += config.lastTrickBonus;
  });
  if (remainder) {
    tricksWon[remainder.team] += 8 - tricks.length;
    for (const card of remainder.cards) trickPoints[remainder.team] += cardPoints(card, contract.suit);
    trickPoints[remainder.team] += config.lastTrickBonus;
  }
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
  remainder: HandRemainder | null = null,
  ending: HandEnding = { type: 'normal' },
): HandResult {
  if (remainder ? tricks.length > 8 : tricks.length !== 8) throw new Error('Une manche comprend 8 plis.');
  const { trickPoints, tricksWon } = calculateHandPoints(tricks, contract, config, remainder);
  const taker = teamOf(contract.bidder);
  const defense = (1 - taker) as Team;
  const mult = contract.multiplier;
  const doubled = contract.coinchedBy !== null || contract.surcoinchedBy !== null;
  const beloteTeam = beloteHolder === null ? null : teamOf(beloteHolder);

  const heldBelote: [number, number] = [0, 0];
  if (beloteTeam !== null) heldBelote[beloteTeam] = config.belotePoints;

  const contractPoints: [number, number] = config.beloteCountsForContract
    ? [trickPoints[0] + heldBelote[0], trickPoints[1] + heldBelote[1]]
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
      const capotScore = config.capotUnannouncedPoints * (config.capotMultiplied ? mult : 1);
      if (doubled && config.coinchedSuccessScoring === 'fixed') {
        // Contrat coinché réussi : « chute à l'envers », la défense ne marque rien.
        const fixed = config.failedContractBasePoints * mult;
        handScore[taker] = unannouncedCapot ? Math.max(fixed, capotScore) : fixed;
      } else {
        const realized = unannouncedCapot ? config.capotUnannouncedPoints : trickPoints[taker];
        let takerBase: number;
        switch (config.contractSuccessScoring) {
          case 'realizedPoints':
            takerBase = realized;
            break;
          case 'contractPlusPoints':
            takerBase = realized + value;
            break;
          case 'contractOnly':
            takerBase = unannouncedCapot ? config.capotUnannouncedPoints : value;
            break;
        }
        const capotMult = unannouncedCapot && !config.capotMultiplied ? 1 : mult;
        handScore[taker] = takerBase * capotMult;
        handScore[defense] = trickPoints[defense];
      }
    } else {
      const base = config.failedContractBasePoints + (config.failedContractScoring === 'fixedPlusContract' ? value : 0);
      handScore[defense] = base * mult;
    }
  }

  // La belote (jamais multipliée) : qui la marque dépend de l'issue de la manche.
  const belotePoints: [number, number] = [0, 0];
  if (beloteTeam !== null) {
    let receiver: Team | null;
    if (!success) {
      receiver =
        config.beloteOnFailure === 'defense' ? defense : config.beloteAlwaysScored || beloteTeam === defense ? beloteTeam : null;
    } else if (doubled && config.beloteOnCoinchedSuccess === 'taker') {
      receiver = taker;
    } else {
      receiver = config.beloteAlwaysScored || beloteTeam === taker ? beloteTeam : null;
    }
    if (receiver !== null) {
      belotePoints[receiver] = config.belotePoints;
      handScore[receiver] += config.belotePoints;
    }
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
    ending,
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
