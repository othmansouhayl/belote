import type { DealPattern } from './types.ts';

/** Façons de compter un contrat réussi (cf. contractSuccessScoring). */
export const CONTRACT_SUCCESS_SCORINGS = ['realizedPoints', 'contractOnly', 'contractPlusPoints'] as const;
export type ContractSuccessScoring = (typeof CONTRACT_SUCCESS_SCORINGS)[number];

/**
 * Toutes les règles variables du jeu (section 13 de regles.md).
 * Chaque valeur marquée « À CONFIRMER » est suivie dans QUESTIONS.md (numéro entre crochets).
 */
export interface RulesConfig {
  // Enchères
  readonly minimumBid: number;
  readonly maximumBid: number;
  readonly bidStep: number;
  readonly allowCapot: boolean;
  readonly allowGenerale: false;
  readonly allowCoinche: boolean;
  readonly allowSurcoinche: boolean;
  /** VALIDÉ [2] : un joueur qui a passé peut encore enchérir plus tard (et toujours coincher). */
  readonly allowRebidAfterPass: boolean;
  /** VALIDÉ [4] : un joueur peut surenchérir sur son partenaire, dans la même couleur ou une autre. */
  readonly allowOverbidSameSuit: boolean;
  /** À CONFIRMER [3] : si tout le monde passe, la donne est annulée et le donneur suivant redistribue. */
  readonly noBidRedeal: true;

  // Distribution et rotation
  readonly dealPatterns: readonly DealPattern[];
  readonly defaultDealPattern: DealPattern;
  /**
   * À CONFIRMER [1] : sens de rotation de la parole, de la distribution et du jeu.
   * Les places sont numérotées dans le sens anti-horaire : en « counterclockwise »,
   * le joueur suivant le donneur est celui assis à sa droite (§4).
   */
  readonly playDirection: 'counterclockwise' | 'clockwise';

  // Jeu de la carte
  /** À CONFIRMER [5] : couper obligatoirement quand on ne peut pas fournir. */
  readonly requireTrumpWhenVoid: boolean;
  /** À CONFIRMER [6] : surcouper obligatoirement un atout adverse quand on le peut. */
  readonly requireOvertrump: boolean;
  /**
   * À CONFIRMER [19] : quand on doit surcouper mais qu'on ne le peut pas,
   * true = on doit quand même jouer un atout plus faible (« sous-couper ») ;
   * false = on peut se défausser.
   */
  readonly requireUndertrump: boolean;
  /** VALIDÉ [7] : false = si le partenaire est maître du pli, on joue la carte qu'on veut. */
  readonly requireTrumpWhenPartnerMaster: boolean;
  /** VALIDÉ [8] : quand l'atout est demandé, monter sur le meilleur atout du pli si possible. */
  readonly requireHigherTrumpWhenTrumpLed: boolean;

  // Annonces et bonus
  /** VALIDÉ [11] : pas de tierce, cinquante, cent ni carré. */
  readonly allowAnnonces: false;
  readonly belotePoints: number;
  /** À CONFIRMER [10] : la belote reste acquise au camp qui la détient, même en cas de chute. */
  readonly beloteAlwaysScored: boolean;
  /** À CONFIRMER [10] : les 20 points de belote comptent pour atteindre le contrat. */
  readonly beloteCountsForContract: boolean;
  readonly lastTrickBonus: number;

  // Score
  /** À CONFIRMER [9] */
  readonly coincheMultiplier: number;
  /** À CONFIRMER [9] */
  readonly surcoincheMultiplier: number;
  /**
   * VALIDÉ [12] : score du preneur quand le contrat est réussi.
   * 'realizedPoints' = points réalisés (plis + dix de der), par ex. 90 annoncé et 120 faits = 120
   *   (capot non annoncé : capotUnannouncedPoints) ;
   * 'contractOnly' = valeur du contrat (capot non annoncé : capotUnannouncedPoints) ;
   * 'contractPlusPoints' = points réalisés + valeur du contrat (capot non annoncé : capotUnannouncedPoints + contrat).
   * La défense marque toujours ses points réalisés.
   */
  readonly contractSuccessScoring: ContractSuccessScoring;
  /** À CONFIRMER [13] : en cas de chute, la défense marque ce nombre + la valeur du contrat. */
  readonly failedContractBasePoints: number;
  /** VALIDÉ [14] */
  readonly capotAnnouncedSuccessPoints: number;
  /** VALIDÉ [14] */
  readonly capotAnnouncedFailurePoints: number;
  /** VALIDÉ [14] : remplace les points de plis quand le preneur fait les 8 plis sans avoir annoncé capot. */
  readonly capotUnannouncedPoints: number;
  /** À CONFIRMER [17] : le capot est multiplié par la coinche / surcoinche. */
  readonly capotMultiplied: boolean;

  // Fin de partie
  /** VALIDÉ [15] : 1500 points (paramètre de salon). */
  readonly targetScore: number;
  /** À CONFIRMER [24] : en cas d'égalité au-delà de la cible, on joue une donne de plus. */
  readonly tieBreakRule: 'extraHand';
}

export const DEFAULT_RULES: RulesConfig = {
  minimumBid: 90,
  maximumBid: 160,
  bidStep: 10,
  allowCapot: true,
  allowGenerale: false,
  allowCoinche: true,
  allowSurcoinche: true,
  allowRebidAfterPass: true,
  allowOverbidSameSuit: true,
  noBidRedeal: true,

  dealPatterns: [
    [4, 4],
    [1, 7],
    [6, 2],
  ],
  defaultDealPattern: [4, 4],
  playDirection: 'counterclockwise',

  requireTrumpWhenVoid: true,
  requireOvertrump: true,
  requireUndertrump: true,
  requireTrumpWhenPartnerMaster: false,
  requireHigherTrumpWhenTrumpLed: true,

  allowAnnonces: false,
  belotePoints: 20,
  beloteAlwaysScored: true,
  beloteCountsForContract: true,
  lastTrickBonus: 10,

  coincheMultiplier: 2,
  surcoincheMultiplier: 4,
  contractSuccessScoring: 'realizedPoints',
  failedContractBasePoints: 160,
  capotAnnouncedSuccessPoints: 500,
  capotAnnouncedFailurePoints: 500,
  capotUnannouncedPoints: 250,
  capotMultiplied: true,

  targetScore: 1500,
  tieBreakRule: 'extraHand',
};

export function makeRules(overrides: Partial<RulesConfig> = {}): RulesConfig {
  return { ...DEFAULT_RULES, ...overrides };
}
