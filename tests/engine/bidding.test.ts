import { describe, expect, it } from 'vitest';
import { applyBid, createBiddingState, getLegalBids, makeRules, validateBid, validateCoinche } from '../../src/engine/index.ts';
import type { BidAction, BiddingState, RulesConfig, Seat } from '../../src/engine/index.ts';

const pass: BidAction = { type: 'pass' };
const bid = (value: number | 'capot', suit: 'pique' | 'coeur' | 'carreau' | 'trefle' = 'coeur'): BidAction => ({ type: 'bid', value, suit });

/** Joue une suite d'enchères en partant du joueur 1 et renvoie l'état et le dernier statut. */
function run(actions: BidAction[], rules: RulesConfig = makeRules(), first: Seat = 1) {
  let bidding: BiddingState = createBiddingState();
  let seat = first;
  let status = 'continue';
  for (const action of actions) {
    const check = validateBid(bidding, seat, action, rules);
    if (!check.ok) throw new Error(check.error);
    const step = applyBid(bidding, seat, action, rules);
    bidding = step.bidding;
    status = step.status;
    if (step.status === 'continue') seat = step.nextPlayer;
  }
  return { bidding, seat, status };
}

describe('Test 4 — valeurs d’enchères autorisées', () => {
  const rules = makeRules();
  const empty = createBiddingState();

  it('accepte 90 à 160 par paliers de 10 et le capot', () => {
    for (const v of [90, 100, 110, 120, 130, 140, 150, 160]) expect(validateBid(empty, 0, bid(v), rules).ok).toBe(true);
    expect(validateBid(empty, 0, bid('capot'), rules).ok).toBe(true);
  });

  it('refuse les valeurs hors barème', () => {
    for (const v of [80, 95, 170, 0, -10, 100.5]) expect(validateBid(empty, 0, bid(v), rules).ok).toBe(false);
  });

  it("n'autorise pas la générale ni le capot si désactivé", () => {
    expect(rules.allowGenerale).toBe(false);
    expect(validateBid(empty, 0, bid('capot'), makeRules({ allowCapot: false })).ok).toBe(false);
  });

  it('propose 36 enchères (9 valeurs × 4 couleurs) + passe au premier joueur', () => {
    const legal = getLegalBids(empty, 1, rules);
    expect(legal.filter((a) => a.type === 'bid')).toHaveLength(9 * 4);
    expect(legal).toContainEqual(pass);
    expect(legal.some((a) => a.type === 'coinche' || a.type === 'surcoinche')).toBe(false);
  });
});

describe('Test 5 — une enchère doit dépasser la meilleure enchère actuelle', () => {
  const rules = makeRules();

  it('refuse une enchère inférieure ou égale', () => {
    const { bidding, seat } = run([bid(110)]);
    expect(validateBid(bidding, seat, bid(100, 'pique'), rules).ok).toBe(false);
    expect(validateBid(bidding, seat, bid(110, 'pique'), rules).ok).toBe(false);
    expect(validateBid(bidding, seat, bid(120, 'pique'), rules).ok).toBe(true);
  });

  it('rien ne dépasse le capot', () => {
    const { bidding, seat } = run([bid('capot', 'pique')]);
    const legal = getLegalBids(bidding, seat, rules);
    expect(legal.some((a) => a.type === 'bid')).toBe(false);
    expect(legal).toContainEqual({ type: 'coinche' });
  });

  it('fin des enchères après trois passes', () => {
    expect(run([bid(90), pass, pass]).status).toBe('continue');
    expect(run([bid(90), pass, pass, pass]).status).toBe('done');
  });

  it('donne annulée si les quatre joueurs passent', () => {
    expect(run([pass, pass, pass, pass]).status).toBe('allPassed');
  });

  it('un joueur qui a passé peut encore enchérir (validé ; paramètre allowRebidAfterPass)', () => {
    const { bidding } = run([pass, bid(90), pass, pass]);
    expect(validateBid(bidding, 1, bid(100), rules).ok).toBe(true);
    expect(validateBid(bidding, 1, bid(100), makeRules({ allowRebidAfterPass: false })).ok).toBe(false);
  });

  it('après avoir passé, le joueur se voit encore proposer des enchères (pas seulement Passer / Coinche)', () => {
    const { bidding } = run([pass, bid(90), pass, pass]);
    const legal = getLegalBids(bidding, 1, rules);
    expect(legal.some((a) => a.type === 'bid' && a.value === 100)).toBe(true);
    expect(legal.some((a) => a.type === 'coinche')).toBe(true);
  });

  it('le partenaire peut monter sur son partenaire, dans la même couleur ou une autre', () => {
    const { bidding, seat } = run([bid(90, 'coeur'), pass]);
    expect(seat).toBe(3);
    expect(validateBid(bidding, 3, bid(100, 'coeur'), rules).ok).toBe(true);
    expect(validateBid(bidding, 3, bid(100, 'trefle'), rules).ok).toBe(true);
  });

  it('surenchère dans la couleur du partenaire selon allowOverbidSameSuit', () => {
    const { bidding, seat } = run([bid(90, 'coeur'), pass]);
    expect(seat).toBe(3);
    expect(validateBid(bidding, 3, bid(100, 'coeur'), rules).ok).toBe(true);
    const strict = makeRules({ allowOverbidSameSuit: false });
    expect(validateBid(bidding, 3, bid(100, 'coeur'), strict).ok).toBe(false);
    expect(validateBid(bidding, 3, bid(100, 'pique'), strict).ok).toBe(true);
  });
});

describe('Test 12 (enchères) — coinche et surcoinche', () => {
  const rules = makeRules();

  it('seule la défense peut coincher, et seulement un contrat existant', () => {
    expect(validateCoinche(createBiddingState(), 1, rules).ok).toBe(false);
    const { bidding } = run([bid(90)]); // le joueur 1 a pris
    expect(validateCoinche(bidding, 2, rules).ok).toBe(true);
    expect(validateCoinche(bidding, 3, rules).ok).toBe(false);
  });

  it('un joueur qui a passé peut quand même coincher', () => {
    const { bidding, seat } = run([pass, bid(90), pass, pass]);
    expect(seat).toBe(1);
    expect(validateCoinche(bidding, 1, rules).ok).toBe(true);
  });

  it('la coinche arrête les surenchères ; seule l’équipe preneuse peut surcoincher', () => {
    const { bidding, seat, status } = run([bid(90), { type: 'coinche' }]);
    expect(status).toBe('continue');
    expect(seat).toBe(3); // partenaire du preneur
    const legal = getLegalBids(bidding, seat, rules);
    expect(legal).toEqual([pass, { type: 'surcoinche' }]);
    expect(validateBid(bidding, seat, bid(100), rules).ok).toBe(false);
  });

  it('la surcoinche clôt les enchères', () => {
    const r = run([bid(90), { type: 'coinche' }, { type: 'surcoinche' }]);
    expect(r.status).toBe('done');
    expect(r.bidding.coinchedBy).toBe(2);
    expect(r.bidding.surcoinchedBy).toBe(3);
  });

  it('si les deux joueurs preneurs passent après la coinche, le contrat reste coinché', () => {
    const r = run([bid(90), { type: 'coinche' }, pass, pass]);
    expect(r.status).toBe('done');
    expect(r.bidding.coinchedBy).toBe(2);
    expect(r.bidding.surcoinchedBy).toBeNull();
  });

  it('le preneur lui-même peut surcoincher après le refus de son partenaire', () => {
    const r = run([bid(90), { type: 'coinche' }, pass, { type: 'surcoinche' }]);
    expect(r.status).toBe('done');
    expect(r.bidding.surcoinchedBy).toBe(1);
  });

  it('sans surcoinche autorisée, la coinche termine les enchères', () => {
    const r = run([bid(90), { type: 'coinche' }], makeRules({ allowSurcoinche: false }));
    expect(r.status).toBe('done');
  });
});
