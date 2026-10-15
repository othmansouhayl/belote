import { describe, expect, it } from 'vitest';
import {
  TOTAL_HAND_POINTS,
  applyAction,
  applyBid,
  createBiddingState,
  getLegalBids,
  trumpMinimumBid,
  validateBid,
  applyHandScore,
  contractLost,
  createDeck,
  createGame,
  legalCards,
  resolveContract,
  teamOf,
} from '../../src/engine/index.ts';
import type { BidAction, Card, CompletedTrick, FinalContract, GameState, Seat } from '../../src/engine/index.ts';
import { cards, contract, rules, tricksFrom } from './helpers.ts';

const ok = (r: ReturnType<typeof applyAction>) => {
  if (!r.ok) throw new Error(r.error);
  return r.state;
};

/** Joue des enchères dans l'ordre de parole, à partir du premier à parler. */
function bidAll(state: GameState, bids: BidAction[]): GameState {
  for (const bid of bids) state = ok(applyAction(state, state.currentPlayer!, { type: 'bid', bid }));
  return state;
}
const pass: BidAction = { type: 'pass' };
const bid = (value: number | 'capot', suit: Card['suit']): BidAction => ({ type: 'bid', value, suit });

/** Joue la donne jusqu'au bout (chacun joue sa première carte permise). */
function playOut(state: GameState): GameState {
  while (state.phase === 'playing') {
    const seat = state.currentPlayer!;
    state = ok(applyAction(state, seat, { type: 'play', cardId: legalCards(state, seat)[0]!.id }));
  }
  return state;
}

describe('« Couleur prise » [37] : sur « 90 » ou « 100 » adverse, la même couleur à 110 ou plus joue la manche', () => {
  // Donneur 0 : la parole commence au joueur 1, puis 2, 3, 0 (sens anti-horaire).
  // Les minimums d'annonce [39] dépendent des mains tirées : on les coupe ici pour ne tester que la règle [37].
  const start = () => createGame({ seed: 'couleur-prise', dealer: 0, rules: { trumpBidMinimums: false } });

  it('90 ♥ du joueur 1, puis 110 ♥ de son adversaire : les enchères s’arrêtent net, la manche est en jeu', () => {
    const state = bidAll(start(), [bid(90, 'coeur'), bid(110, 'coeur')]);
    expect(state.phase).toBe('playing');
    expect(state.contract).toMatchObject({ value: 110, suit: 'coeur', bidder: 2, winsGame: true, coinchedBy: null });
  });

  it('pareil sur un « 100 », et avec 120 ou un كبوط dans la même couleur', () => {
    expect(bidAll(start(), [bid(100, 'pique'), bid(110, 'pique')]).contract?.winsGame).toBe(true);
    expect(bidAll(start(), [bid(90, 'pique'), bid(120, 'pique')]).contract?.winsGame).toBe(true);
    expect(bidAll(start(), [bid(90, 'pique'), bid('capot', 'pique')]).contract?.winsGame).toBe(true);
  });

  it('pas de « couleur prise » : 100 seulement, une autre couleur, la couleur de son partenaire, ou sur un 110', () => {
    const keepsBidding = (bids: BidAction[]) => {
      const state = bidAll(start(), bids);
      expect(state.phase).toBe('bidding');
      return bidAll(state, [pass, pass, pass]).contract?.winsGame;
    };
    expect(keepsBidding([bid(90, 'coeur'), bid(100, 'coeur')])).toBeUndefined();
    expect(keepsBidding([bid(90, 'coeur'), bid(110, 'pique')])).toBeUndefined();
    // Joueur 3 = partenaire du joueur 1 : il reprend la couleur de son partenaire.
    expect(keepsBidding([bid(90, 'coeur'), pass, bid(110, 'coeur')])).toBeUndefined();
    // Le contrat en cours est un 110 : on peut le reprendre au-dessus, mais ce n'est pas une « couleur prise ».
    expect(keepsBidding([bid(110, 'coeur'), bid(120, 'coeur')])).toBeUndefined();
    // Le 90 n'est plus le contrat en cours (100 ♠ entre-temps) : la règle ne joue pas.
    expect(keepsBidding([bid(90, 'coeur'), bid(100, 'pique'), bid(110, 'coeur')])).toBeUndefined();
  });

  it('la règle se désactive', () => {
    const game = createGame({ seed: 'couleur-prise', dealer: 0, rules: { stolenSuitWinsGame: null, trumpBidMinimums: false } });
    const state = bidAll(game, [bid(90, 'coeur'), bid(110, 'coeur')]);
    expect(state.phase).toBe('bidding');
  });

  it('contrat réussi : la manche est gagnée tout de suite, même loin de 1500 ; chuté : chute normale', () => {
    const won: FinalContract = { ...contract(110, 'coeur', 2), winsGame: true };
    // L'équipe 0 (joueur 2) fait tous les plis sauf le dernier.
    const tricks = tricksFrom(
      ['VC 9C AC 10C', 'RC DC 8C 7C', 'AP 10P RP DP', 'AK 10K RK DK', 'AT 10T RT DT', 'VP 9P 8P 7P', 'VK 9K 8K 7K', 'VT 9T 8T 7T'],
      [2, 2, 2, 2, 2, 2, 2, 1] as Seat[],
    );
    const result = resolveContract(tricks, won, null, rules());
    expect(result.success).toBe(true);
    expect(result.winsGame).toBe(true);
    expect(applyHandScore([300, 900], result, rules())).toEqual({ scores: [300 + result.handScore[0], 900 + result.handScore[1]], winner: 0 });

    const lostTricks = tricks.map((t) => ({ ...t, winner: 1 as Seat }));
    const lost = resolveContract(lostTricks, won, null, rules());
    expect(lost.success).toBe(false);
    expect(lost.winsGame).toBeUndefined();
    expect(applyHandScore([300, 900], lost, rules()).winner).toBeNull();
  });

  it('en partie : quand la « couleur prise » réussit, la partie est finie et gagnée par le preneur', () => {
    let wins = 0;
    let failures = 0;
    for (let g = 0; g < 80 && (wins === 0 || failures === 0); g++) {
      let state = createGame({ seed: `couleur-prise-partie-${g}`, dealer: 0, rules: { trumpBidMinimums: false } });
      state = playOut(bidAll(state, [bid(90, 'trefle'), bid(110, 'trefle')]));
      const result = state.lastHandResult!;
      if (result.success) {
        wins++;
        expect(state.phase).toBe('gameOver');
        expect(state.winner).toBe(teamOf(2));
      } else {
        failures++;
        expect(state.phase).toBe('handOver');
        expect(state.winner).toBeNull();
      }
    }
    expect(wins).toBeGreaterThan(0);
    expect(failures).toBeGreaterThan(0);
  });
});

describe('Plus de fausse annonce [39] : un minimum selon ses atouts', () => {
  /** Main de 8 cartes : les atouts donnés en cœur, complétés par des cartes des autres couleurs listées. */
  const hand = (codes: string) => cards(codes);
  const firstToSpeak = createBiddingState();

  it('V + 9 + (D, 7 ou 8) : 90 ; V + 9 + (R, 10 ou As) : 100', () => {
    expect(trumpMinimumBid(hand('VC 9C DC 7P 8P 7K 8K 7T'), 'coeur')).toBe(90);
    expect(trumpMinimumBid(hand('VC 9C 8C 7P 8P 7K 8K 7T'), 'coeur')).toBe(90);
    expect(trumpMinimumBid(hand('VC 9C RC 7P 8P 7K 8K 7T'), 'coeur')).toBe(100);
    expect(trumpMinimumBid(hand('VC 9C AC DC 8P 7K 8K 7T'), 'coeur')).toBe(100);
  });

  it('V + 9 + As + 10 (tout l’atout) : 130 avec une autre couleur, 120 avec deux, 110 avec les trois', () => {
    expect(trumpMinimumBid(hand('VC 9C AC 10C 7C AP 10P RP'), 'coeur')).toBe(130);
    expect(trumpMinimumBid(hand('VC 9C AC 10C AP 10P AK 7K'), 'coeur')).toBe(120);
    expect(trumpMinimumBid(hand('VC 9C AC 10C AP AK AT 7T'), 'coeur')).toBe(110);
  });

  it('sans le Valet ou sans le 9, ou V + 9 tout seuls : pas de minimum', () => {
    expect(trumpMinimumBid(hand('VC AC 10C RC 7P 8P 7K 8K'), 'coeur')).toBeNull();
    expect(trumpMinimumBid(hand('9C AC 10C RC 7P 8P 7K 8K'), 'coeur')).toBeNull();
    expect(trumpMinimumBid(hand('VC 9C 7P 8P 9P 7K 8K 7T'), 'coeur')).toBeNull();
  });

  it('les enchères trop basses sont refusées, avec une explication ; plus haut, c’est libre', () => {
    const strong = hand('VC 9C AC 10C AP AK AT 7T');
    const refused = validateBid(firstToSpeak, 1, bid(100, 'coeur'), rules(), strong);
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.error).toContain('110');
    expect(validateBid(firstToSpeak, 1, bid(110, 'coeur'), rules(), strong).ok).toBe(true);
    expect(validateBid(firstToSpeak, 1, bid(150, 'coeur'), rules(), strong).ok).toBe(true);
    expect(validateBid(firstToSpeak, 1, bid('capot', 'coeur'), rules(), strong).ok).toBe(true);
    // Dans une autre couleur, le minimum ne joue pas.
    expect(validateBid(firstToSpeak, 1, bid(90, 'pique'), rules(), strong).ok).toBe(true);
    // Les enchères permises ne proposent pas les trop basses.
    const legal = getLegalBids(firstToSpeak, 1, rules(), strong).filter((a) => a.type === 'bid' && a.suit === 'coeur');
    expect(legal.every((a) => a.type === 'bid' && (a.value === 'capot' || a.value >= 110))).toBe(true);
  });

  it('monter sur la couleur de son partenaire reste libre', () => {
    const afterPartner = applyBid(firstToSpeak, 1, bid(90, 'coeur'), rules());
    if (afterPartner.status !== 'continue') throw new Error('enchères terminées trop tôt');
    const afterOpponent = applyBid(afterPartner.bidding, 2, pass, rules());
    if (afterOpponent.status !== 'continue') throw new Error('enchères terminées trop tôt');
    // Joueur 3 (partenaire du 1) a V + 9 + As + 10 de cœur : il peut dire 100 ♥.
    expect(validateBid(afterOpponent.bidding, 3, bid(100, 'coeur'), rules(), hand('VC 9C AC 10C AP AK AT 7T')).ok).toBe(true);
  });

  it('en partie, le serveur refuse l’enchère trop basse', () => {
    for (let g = 0; g < 200; g++) {
      const state = createGame({ seed: `minimum-${g}`, dealer: 0 });
      const seat = state.currentPlayer!;
      const suit = (['coeur', 'pique', 'carreau', 'trefle'] as const).find((s) => (trumpMinimumBid(state.hands[seat]!, s) ?? 0) >= 100);
      if (!suit) continue;
      const result = applyAction(state, seat, { type: 'bid', bid: bid(90, suit) });
      expect(result.ok).toBe(false);
      return;
    }
    throw new Error('aucune main avec un minimum de 100 trouvée');
  });

  it('la règle se désactive', () => {
    expect(validateBid(firstToSpeak, 1, bid(90, 'coeur'), rules({ trumpBidMinimums: false }), hand('VC 9C AC 10C AP AK AT 7T')).ok).toBe(true);
  });
});

describe('« دخلت كارطة .. طيش » [38] : on ramasse dès que le contrat ne peut plus être atteint', () => {
  /** Un état de jeu avec ce contrat et ce détenteur de belote. */
  const withContract = (c: FinalContract, beloteHolder: Seat | null): GameState => ({
    ...createGame({ seed: 'contrat-perdu', dealer: 0 }),
    contract: c,
    beloteHolder,
  });
  /** Un pli remporté par la défense (joueur 1), et les cartes qui restent. */
  const afterDefenseTrick = (codes: string): [CompletedTrick[], Card[]] => {
    const played = cards(codes);
    const tricks: CompletedTrick[] = [{ leader: 0, cards: played.map((card, i) => ({ seat: i as Seat, card })), winner: 1 }];
    return [tricks, createDeck().filter((card) => !played.some((p) => p.id === card.id))];
  };

  it('150 sans belote : un pli de 20 pour la défense suffit (142 au mieux, arrondi à 140)', () => {
    const [tricks, rest] = afterDefenseTrick('AP RP DP VP');
    expect(contractLost(withContract(contract(150, 'coeur', 0), null), tricks, rest)).toBe(true);
    // 10 seulement pour la défense : 152 au mieux, arrondi à 150, ça passe encore.
    const [small, rest2] = afterDefenseTrick('10P 9P 8P 7P');
    expect(contractLost(withContract(contract(150, 'coeur', 0), null), small, rest2)).toBe(false);
  });

  it('150 avec la belote du preneur : le même pli de 20 ne suffit pas, il en faut plus', () => {
    const [tricks, rest] = afterDefenseTrick('AP RP DP VP');
    expect(contractLost(withContract(contract(150, 'coeur', 0), 2), tricks, rest)).toBe(false);
    // 42 points pour la défense : 120 au mieux + 20 de belote = 140 < 150.
    const [big, rest2] = afterDefenseTrick('AP 10P AK 10K');
    expect(contractLost(withContract(contract(150, 'coeur', 0), 2), big, rest2)).toBe(true);
    // La belote de la défense n'aide pas le preneur.
    expect(contractLost(withContract(contract(150, 'coeur', 0), 1), tricks, rest)).toBe(true);
  });

  it('pas pour un كبوط (il a sa propre fin anticipée, « يروووووووح »)', () => {
    const [tricks, rest] = afterDefenseTrick('AP RP DP VP');
    expect(contractLost(withContract(contract('capot', 'coeur', 0), null), tricks, rest)).toBe(false);
  });

  it('sur de vraies donnes : la donne s’arrête au premier pli qui rend le contrat impossible, et compte comme chutée', () => {
    let early = 0;
    for (let g = 0; g < 60; g++) {
      let state = createGame({ seed: `contrat-perdu-${g}`, dealer: 0 });
      // Le joueur 1 prend à 150 ♥, les autres passent.
      state = playOut(bidAll(state, [bid(150, 'coeur'), pass, pass, pass]));
      const result = state.lastHandResult!;
      const tricks = state.completedTricks;
      const playedBefore = (n: number) => tricks.slice(0, n).flatMap((t) => t.cards.map((p) => p.card.id));
      const restAfter = (n: number) => createDeck().filter((card) => !playedBefore(n).includes(card.id));
      const lostAt = (n: number) => contractLost(state, tricks.slice(0, n), restAfter(n));
      expect(result.trickPoints[0] + result.trickPoints[1]).toBe(TOTAL_HAND_POINTS);
      if (result.ending.type === 'contractLost') {
        early++;
        expect(tricks.length).toBeLessThan(8);
        expect(result.success).toBe(false);
        expect(lostAt(tricks.length)).toBe(true);
        expect(lostAt(tricks.length - 1)).toBe(false);
        expect(result.ending.seat).toBe(tricks[tricks.length - 1]!.winner);
        // Chute normale : 160 pour la défense, + 20 si quelqu'un avait la belote.
        expect(result.handScore).toEqual([state.beloteHolder === null ? 160 : 180, 0]);
      } else {
        // Allée jusqu'au bout : le contrat était encore possible avant le dernier pli.
        expect(tricks).toHaveLength(8);
        expect(lostAt(7)).toBe(false);
      }
    }
    expect(early).toBeGreaterThan(0);
  });

  it('la règle se désactive', () => {
    for (let g = 0; g < 20; g++) {
      let state = createGame({ seed: `contrat-perdu-${g}`, dealer: 0, rules: { endHandWhenContractLost: false } });
      state = playOut(bidAll(state, [bid(150, 'coeur'), pass, pass, pass]));
      expect(state.completedTricks).toHaveLength(8);
    }
  });
});
