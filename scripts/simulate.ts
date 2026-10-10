/**
 * Simulation : 4 bots jouent des parties complètes en choisissant au hasard parmi les coups légaux.
 * Vérifie à chaque manche le total de 162 points et la cohérence de l'état.
 *
 * Utilisation : npm run simulate -- [nombre de parties] [graine]
 */
import {
  canClaim,
  TOTAL_HAND_POINTS,
  applyAction,
  createGame,
  createRng,
  legalBids,
  legalCards,
  randomInt,
  startNextHand,
  validatePlay,
} from '../src/engine/index.ts';
import type { BidAction, GameAction, GameState, Rng } from '../src/engine/index.ts';

const games = Number(process.argv[2] ?? 500);
const seed = process.argv[3] ?? 'simulation';
const MAX_ACTIONS_PER_GAME = 20_000;

function fail(message: string, state: GameState): never {
  console.error(`ÉCHEC : ${message}`);
  console.error(`Graine ${state.seed}, manche ${state.handNumber}`);
  process.exit(1);
}

const pickOne = <T>(list: T[], rng: Rng): T => list[randomInt(rng, list.length)]!;

/** Bot simple : passe souvent, monte d'un palier, coinche et annonce capot rarement. */
function pickBid(options: BidAction[], rng: Rng): BidAction {
  const roll = rng();
  const doubles = options.filter((a) => a.type === 'coinche' || a.type === 'surcoinche');
  if (doubles.length > 0 && roll < 0.15) return pickOne(doubles, rng);
  const numeric = options.filter((a) => a.type === 'bid' && a.value !== 'capot');
  const capots = options.filter((a) => a.type === 'bid' && a.value === 'capot');
  if (capots.length > 0 && roll > 0.98) return pickOne(capots, rng);
  if (numeric.length === 0 || roll < 0.55) return { type: 'pass' };
  const lowest = Math.min(...numeric.map((a) => (a.type === 'bid' ? Number(a.value) : Infinity)));
  return pickOne(numeric.filter((a) => a.type === 'bid' && a.value === lowest), rng);
}

function checkHand(state: GameState) {
  const result = state.lastHandResult;
  if (!result) fail('manche terminée sans résultat', state);
  const total = result.trickPoints[0] + result.trickPoints[1];
  if (total !== TOTAL_HAND_POINTS) fail(`la manche totalise ${total} points au lieu de 162`, state);
  if (result.tricksWon[0] + result.tricksWon[1] !== 8) fail('une manche doit compter 8 plis', state);
  const played = state.completedTricks.flatMap((t) => t.cards.map((p) => p.card.id));
  // Cartes étalées ou capot chuté : la manche s'arrête avant le 8e pli.
  const expected = result.ending.type === 'normal' ? 32 : played.length;
  if (played.length !== expected || new Set(played).size !== played.length) {
    fail('les cartes doivent être jouées une seule fois', state);
  }
  if (result.ending.type !== 'normal') stats.early[result.ending.type] += 1;
}

function checkDeal(state: GameState) {
  const ids = state.hands.flat().map((c) => c.id);
  if (state.hands.some((h) => h.length !== 8)) fail('chaque joueur doit recevoir 8 cartes', state);
  if (new Set(ids).size !== 32) fail('une carte a été distribuée deux fois', state);
}

const stats = { hands: 0, redeals: 0, success: 0, failed: 0, coinche: 0, surcoinche: 0, capotAnnonce: 0, capotNonAnnonce: 0, belote: 0, early: { claim: 0, capotFailed: 0 } };
const rng = createRng(seed);

for (let g = 0; g < games; g++) {
  let state = createGame({ seed: `${seed}-${g}` });
  checkDeal(state);
  let lastDeal = `${state.handNumber}:${state.redeals}`;
  let actions = 0;

  while (state.phase !== 'gameOver') {
    if (++actions > MAX_ACTIONS_PER_GAME) fail('la partie ne se termine pas', state);

    if (state.phase === 'handOver') {
      const next = startNextHand(state);
      if (!next.ok) fail(next.error, state);
      state = next.state;
    } else {
      const seat = state.currentPlayer;
      if (seat === null) fail('aucun joueur attendu', state);

      if (state.phase === 'bidding') {
        const options = legalBids(state, seat);
        if (options.length === 0) fail('aucune enchère possible', state);
        const result = applyAction(state, seat, { type: 'bid', bid: pickBid(options, rng) });
        if (!result.ok) fail(`enchère légale refusée : ${result.error}`, state);
        state = result.state;
      } else {
        const options = legalCards(state, seat);
        if (options.length === 0) fail('aucune carte jouable', state);
        // Toute carte hors de la liste légale doit être refusée.
        for (const card of state.hands[seat]!) {
          const legal = options.some((c) => c.id === card.id);
          const check = validatePlay(state.hands[seat]!, state.trick!, seat, card.id, state.contract!.suit, state.config);
          if (check.ok !== legal) fail(`incohérence sur la carte ${card.id}`, state);
        }
        const card = options[randomInt(rng, options.length)]!;
        // Cartes toutes maîtresses : on les étale une fois sur deux.
        const action: GameAction = canClaim(state, seat) && rng() < 0.5 ? { type: 'claim' } : { type: 'play', cardId: card.id };
        const result = applyAction(state, seat, action);
        if (!result.ok) fail(`carte légale refusée : ${result.error}`, state);
        state = result.state;

        if (state.phase === 'handOver' || state.phase === 'gameOver') {
          checkHand(state);
          const r = state.lastHandResult!;
          stats.hands++;
          if (r.success) stats.success++;
          else stats.failed++;
          if (r.contract.coinchedBy !== null) stats.coinche++;
          if (r.contract.surcoinchedBy !== null) stats.surcoinche++;
          if (r.capot === 'annonce') stats.capotAnnonce++;
          if (r.capot === 'non-annonce') stats.capotNonAnnonce++;
          if (r.belotePoints[0] + r.belotePoints[1] > 0) stats.belote++;
        }
      }
    }

    const deal = `${state.handNumber}:${state.redeals}`;
    if (deal !== lastDeal) {
      checkDeal(state);
      lastDeal = deal;
    }
  }

  stats.redeals += state.redeals;
  if (state.winner === null || state.scores[state.winner] < state.config.targetScore) {
    fail('partie terminée sans vainqueur valide', state);
  }
}

console.log(`${games} parties simulées sans erreur.`);
console.log(`Manches jouées : ${stats.hands} (toutes à 162 points)`);
console.log(`Cartes étalées : ${stats.early.claim} — capots chutés arrêtés : ${stats.early.capotFailed}`);
console.log(`Donnes annulées (4 passes) : ${stats.redeals}`);
console.log(`Contrats réussis : ${stats.success} — chutés : ${stats.failed}`);
console.log(`Coinches : ${stats.coinche} — surcoinches : ${stats.surcoinche}`);
console.log(`Capots annoncés : ${stats.capotAnnonce} — capots non annoncés : ${stats.capotNonAnnonce}`);
console.log(`Manches avec belote : ${stats.belote}`);
