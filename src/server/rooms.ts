import {
  CONTRACT_SUCCESS_SCORINGS,
  NEW_MATCH,
  SEATS,
  SUITS,
  applyAction,
  bidTurnKey,
  createGame,
  getPlayerView,
  endMatch,
  getSpectatorView,
  isMatchOver,
  isThoughtBid,
  makeRules,
  recordGame,
  startNextHand,
} from '../engine/index.ts';
import type { BidAction, GameAction, RulesConfig, Seat } from '../engine/index.ts';
import { DEFAULT_SPECTATOR_MODE, DRINKS, SPECTATOR_MODES } from './types.ts';
import type {
  Drink,
  PublicTableData,
  RoomAggregate,
  RoomPlayer,
  RoomRequest,
  RoomSettings,
  RoomView,
  ServerDeps,
  SpectatorMode,
  StoredView,
} from './types.ts';

export const DEFAULT_ABSENCE_DELAY_SECONDS = 30;
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_LENGTH = 6;
/** Tables de belote du Café Tarek (la salle du fond, près de la télé). */
export const CAFE_TABLE_COUNT = 6;
/** Une table sans aucune action depuis ce délai est considérée comme libre. */
export const CAFE_TABLE_STALE_MINUTES = 10;

/** Au plus 30 spectateurs inscrits par table ; une inscription de plus de 6 heures est oubliée. */
export const MAX_SPECTATORS = 30;
export const SPECTATOR_STALE_HOURS = 6;

/** Temps laissé à chacun pour commander sa boisson au début du match. */
export const ORDER_SECONDS = 30;

/** Valeurs proposées dans les réglages du salon (le serveur refuse toute autre valeur). */
export const TARGET_SCORES = [500, 1000, 1500, 2000] as const;
export const ABSENCE_DELAYS = [15, 30, 60, 120] as const;
const BOOLEAN_RULES = [
  'allowRebidAfterPass',
  'allowOverbidSameSuit',
  'requireUndertrump',
  'beloteAlwaysScored',
  'capotMultiplied',
] as const satisfies readonly (keyof RulesConfig)[];

/** Valide les réglages envoyés par l'hôte : seules les règles prévues, avec des valeurs prévues. */
export function parseSettings(raw: unknown): RoomSettings | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as { rules?: unknown; absenceDelaySeconds?: unknown; spectators?: unknown };
  if (typeof r.rules !== 'object' || r.rules === null) return null;
  const rules = r.rules as Record<string, unknown>;
  const target = TARGET_SCORES.find((t) => t === rules.targetScore);
  const delay = ABSENCE_DELAYS.find((d) => d === r.absenceDelaySeconds);
  const scoring = CONTRACT_SUCCESS_SCORINGS.find((s) => s === rules.contractSuccessScoring);
  if (target === undefined || delay === undefined || scoring === undefined) return null;
  const parsed: Record<string, unknown> = { targetScore: target, contractSuccessScoring: scoring };
  for (const key of BOOLEAN_RULES) {
    if (typeof rules[key] !== 'boolean') return null;
    parsed[key] = rules[key];
  }
  // Spectateurs : facultatif (un ancien écran ne l'envoie pas, le réglage actuel est alors gardé).
  if (r.spectators === undefined) return { rules: parsed as Partial<RulesConfig>, absenceDelaySeconds: delay };
  const spectators = SPECTATOR_MODES.find((m) => m === r.spectators);
  if (spectators === undefined) return null;
  return { rules: parsed as Partial<RulesConfig>, absenceDelaySeconds: delay, spectators };
}

/** Ce que les joueurs permettent aux spectateurs. */
export function spectatorMode(room: RoomAggregate): SpectatorMode {
  return room.settings.spectators ?? DEFAULT_SPECTATOR_MODE;
}

/** Hôte actuel : le créateur, ou à défaut le joueur à la plus petite place. */
export function hostOf(room: RoomAggregate): RoomPlayer | undefined {
  const sorted = [...room.players].sort((a, b) => a.seat - b.seat);
  return sorted.find((p) => p.playerId === room.hostId) ?? sorted[0];
}

export type RoomResult = { readonly ok: true; readonly room: RoomAggregate } | { readonly ok: false; readonly error: string };

const fail = (error: string): RoomResult => ({ ok: false, error });

/** Nettoie le pseudo saisi : 1 à 20 caractères visibles. */
export function cleanNickname(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const cleaned = raw.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim();
  if (cleaned.length === 0) return null;
  return [...cleaned].slice(0, 20).join('');
}

/** Deux pseudos identiques à une même table ? (sans tenir compte des majuscules ni des accents de forme) */
export function sameNickname(a: string, b: string): boolean {
  const key = (n: string) => n.normalize('NFKC').toLocaleLowerCase('fr').trim();
  return key(a) === key(b);
}

const NICKNAME_TAKEN = 'Ce nom est déjà pris à cette table : choisissez-en un autre.';

export function normalizeCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const code = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return code.length === ROOM_CODE_LENGTH ? code : null;
}

const isUuid = (v: unknown): v is string =>
  typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

function parseBid(raw: unknown): BidAction | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const bid = raw as Record<string, unknown>;
  if (bid.type === 'pass' || bid.type === 'coinche' || bid.type === 'surcoinche') return { type: bid.type };
  if (bid.type !== 'bid') return null;
  const suit = SUITS.find((s) => s === bid.suit);
  const value = bid.value === 'capot' ? 'capot' : typeof bid.value === 'number' && Number.isInteger(bid.value) ? bid.value : null;
  return suit && value !== null ? { type: 'bid', value, suit } : null;
}

function parseAction(raw: unknown): GameAction | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const action = raw as Record<string, unknown>;
  if (action.type === 'bid') {
    const bid = parseBid(action.bid);
    return bid ? { type: 'bid', bid } : null;
  }
  if (action.type === 'play' && typeof action.cardId === 'string' && action.cardId.length <= 16) {
    return { type: 'play', cardId: action.cardId };
  }
  if (action.type === 'claim') return { type: 'claim' };
  return null;
}

/** Valide la forme d'une requête venant du navigateur (donnée non fiable). */
export function parseRequest(raw: unknown): RoomRequest | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  switch (r.type) {
    case 'create': {
      const nickname = cleanNickname(r.nickname);
      if (!nickname) return null;
      if (r.table === undefined || r.table === null) return { type: 'create', nickname };
      const table = typeof r.table === 'number' && Number.isInteger(r.table) && r.table >= 1 && r.table <= CAFE_TABLE_COUNT ? r.table : null;
      return table === null ? null : { type: 'create', nickname, table };
    }
    case 'join': {
      const nickname = cleanNickname(r.nickname);
      const code = normalizeCode(r.code);
      return nickname && code ? { type: 'join', code, nickname } : null;
    }
  }
  if (!isUuid(r.roomId)) return null;
  const roomId = r.roomId;
  switch (r.type) {
    case 'seat':
      return typeof r.seat === 'number' && SEATS.includes(r.seat as Seat) ? { type: 'seat', roomId, seat: r.seat as Seat } : null;
    case 'ready':
      return typeof r.ready === 'boolean' ? { type: 'ready', roomId, ready: r.ready } : null;
    case 'settings': {
      const settings = parseSettings(r.settings);
      return settings ? { type: 'settings', roomId, settings } : null;
    }
    case 'leave':
    case 'quit':
    case 'continue':
    case 'endMatch':
    case 'unwatch':
      return { type: r.type, roomId };
    case 'watch': {
      const nickname = cleanNickname(r.nickname);
      return nickname ? { type: 'watch', roomId, nickname } : null;
    }
    case 'drink': {
      if (r.drink === undefined || r.drink === null) return { type: 'drink', roomId };
      const drink = DRINKS.find((d) => d === r.drink);
      return drink ? { type: 'drink', roomId, drink } : null;
    }
    case 'game': {
      const action = parseAction(r.action);
      if (!action) return null;
      // Ce que montrait le chrono de réflexion du joueur (vérifié ensuite par le serveur).
      return typeof r.thought === 'boolean' ? { type: 'game', roomId, action, thought: r.thought } : { type: 'game', roomId, action };
    }
    default:
      return null;
  }
}

export function createRoom(playerId: string, nickname: string, deps: ServerDeps, table?: number): RoomAggregate {
  return {
    ...(table === undefined ? {} : { tableNumber: table }),
    id: deps.newRoomId(),
    code: deps.newRoomCode(),
    version: 1,
    status: 'lobby',
    settings: { rules: {}, absenceDelaySeconds: DEFAULT_ABSENCE_DELAY_SECONDS },
    players: [{ playerId, nickname, seat: 0, ready: false }],
    hostId: playerId,
    game: null,
    acks: [],
  };
}

/** Rejoindre, ou revenir dans son salon après une coupure (même identité anonyme). */
export function joinRoom(room: RoomAggregate, playerId: string, nickname: string): RoomResult {
  const existing = room.players.find((p) => p.playerId === playerId);
  const taken = room.players.some((p) => p.playerId !== playerId && sameNickname(p.nickname, nickname));
  if (existing) {
    // Revenir n'est jamais refusé : si le nouveau nom est déjà pris par un autre joueur, on garde l'ancien.
    const players = room.players.map((p) => (p.playerId === playerId && !taken ? { ...p, nickname } : p));
    // Un joueur qui avait quitté la table et revient avec le code reprend sa place.
    return { ok: true, room: { ...room, players, left: (room.left ?? []).filter((id) => id !== playerId) } };
  }
  if (room.status !== 'lobby') return fail('La partie a déjà commencé dans ce salon.');
  const seat = SEATS.find((s) => !room.players.some((p) => p.seat === s));
  if (seat === undefined) return fail('Le salon est complet.');
  if (taken) return fail(NICKNAME_TAKEN);
  return { ok: true, room: { ...room, players: [...room.players, { playerId, nickname, seat, ready: false }] } };
}

const nowOf = (deps: ServerDeps) => (deps.now ?? Date.now)();

/** Début de match : Mohamed Naceur prend la commande ; la première manche commence ensuite. */
function startOrder(room: RoomAggregate, deps: ServerDeps): RoomAggregate {
  return { ...room, status: 'playing', acks: [], game: null, match: NEW_MATCH, order: { deadline: nowOf(deps) + ORDER_SECONDS * 1000, drinks: {} } };
}

/** Tout le monde a commandé : on note les boissons par place et la première manche commence. */
function finishOrderIfComplete(room: RoomAggregate, drinksById: Readonly<Record<string, Drink>>, deps: ServerDeps): RoomAggregate {
  if (!room.players.every((p) => drinksById[p.playerId])) return { ...room, order: { ...room.order!, drinks: drinksById } };
  const drinks: Partial<Record<Seat, Drink>> = {};
  for (const p of room.players) drinks[p.seat] = drinksById[p.playerId]!;
  return { ...room, order: null, drinks, game: createGame({ rules: room.settings.rules, seed: deps.newSecureSeed() }) };
}

function member(room: RoomAggregate, playerId: string): RoomPlayer | undefined {
  return room.players.find((p) => p.playerId === playerId);
}

export function applyRoomRequest(
  room: RoomAggregate,
  playerId: string,
  request: Exclude<RoomRequest, { type: 'create' } | { type: 'join' } | { type: 'watch' } | { type: 'unwatch' }>,
  deps: ServerDeps,
): RoomResult {
  const me = member(room, playerId);
  if (!me) return fail('Vous ne faites pas partie de ce salon.');

  switch (request.type) {
    case 'seat': {
      if (room.status !== 'lobby') return fail('Les places ne peuvent plus changer une fois la partie lancée.');
      if (room.players.some((p) => p.seat === request.seat && p.playerId !== playerId)) return fail('Cette place est prise.');
      const players = room.players.map((p) => (p.playerId === playerId ? { ...p, seat: request.seat, ready: false } : p));
      return { ok: true, room: { ...room, players } };
    }
    case 'ready': {
      if (room.status !== 'lobby') return fail('La partie est déjà lancée.');
      const players = room.players.map((p) => (p.playerId === playerId ? { ...p, ready: request.ready } : p));
      const updated = { ...room, players };
      if (players.length === 4 && players.every((p) => p.ready)) {
        // §11.1 : 4 joueurs présents et prêts. D'abord la commande des boissons, puis la partie.
        return { ok: true, room: startOrder(updated, deps) };
      }
      return { ok: true, room: updated };
    }
    case 'settings': {
      if (room.status !== 'lobby') return fail('Les réglages ne peuvent plus changer une fois la partie lancée.');
      if (hostOf(room)?.playerId !== playerId) return fail("Seul l'hôte du salon peut modifier les réglages.");
      // Chacun doit revoir les réglages avant de se déclarer prêt.
      const players = room.players.map((p) => ({ ...p, ready: false }));
      const settings = { ...request.settings, spectators: request.settings.spectators ?? spectatorMode(room) };
      // Spectateurs refusés : ceux qui étaient inscrits ne voient plus rien.
      const spectators = settings.spectators === 'none' ? [] : (room.spectators ?? []);
      return { ok: true, room: { ...room, settings, players, spectators } };
    }
    case 'quit':
    case 'leave': {
      if (room.status !== 'lobby') {
        if (request.type === 'leave') return fail('Impossible de quitter pendant une partie : votre place vous attend.');
        // Partie lancée : la place reste (la partie est figée), mais le joueur a quitté la table.
        const left = room.left?.includes(playerId) ? room.left : [...(room.left ?? []), playerId];
        return { ok: true, room: { ...room, left } };
      }
      const remaining = { ...room, players: room.players.filter((p) => p.playerId !== playerId) };
      // Si l'hôte part, le joueur restant à la plus petite place le remplace.
      return { ok: true, room: { ...remaining, hostId: hostOf(remaining)?.playerId } };
    }
    case 'drink': {
      const order = room.order;
      if (!order) return fail('La commande est déjà prise.');
      if (request.drink) return { ok: true, room: finishOrderIfComplete(room, { ...order.drinks, [playerId]: request.drink }, deps) };
      // Échéance passée : Naceur choisit pour ceux qui n'ont rien dit.
      if (nowOf(deps) < order.deadline) return fail('Chacun a encore le temps de choisir.');
      const seed = deps.newSecureSeed();
      const filled: Record<string, Drink> = { ...order.drinks };
      room.players.forEach((p, i) => {
        filled[p.playerId] ??= DRINKS[(seed.charCodeAt(i % seed.length) + i) % DRINKS.length]!;
      });
      return { ok: true, room: finishOrderIfComplete(room, filled, deps) };
    }
    case 'game': {
      if (!room.game) return fail("La partie n'a pas commencé.");
      // Le chrono de réflexion : le temps mesuré par le serveur depuis le début de ce tour d'enchère.
      const turn = room.bidTurn && room.bidTurn.key === bidTurnKey(room.game) ? room.bidTurn : undefined;
      const thought = isThoughtBid(
        room.game.config.bidReflectionSeconds ?? 0,
        turn ? nowOf(deps) - turn.since : undefined,
        request.thought,
      );
      const result = applyAction(room.game, me.seat, request.action, { thought });
      if (!result.ok) return fail(result.error);
      const state = result.state;
      // Fin de manche : on la note dans le match.
      const match =
        state.phase === 'gameOver' && room.game.phase !== 'gameOver' && state.winner !== null
          ? recordGame(room.match ?? NEW_MATCH, state.scores, state.winner)
          : room.match;
      return { ok: true, room: { ...room, game: state, acks: [], ...(match ? { match } : {}) } };
    }
    case 'endMatch': {
      if (room.game?.phase !== 'gameOver') return fail('On ne peut arrêter le match qu’à la fin d’une manche.');
      const match = room.match ?? NEW_MATCH;
      if (isMatchOver(match)) return fail('Le match est déjà terminé.');
      return { ok: true, room: { ...room, match: endMatch(match), acks: [] } };
    }
    case 'continue': {
      const game = room.game;
      if (!game || (game.phase !== 'handOver' && game.phase !== 'gameOver')) return fail('Rien à continuer pour le moment.');
      const acks = room.acks.includes(playerId) ? room.acks : [...room.acks, playerId];
      if (acks.length < 4) return { ok: true, room: { ...room, acks } };
      // Nouvelle graine secrète pour chaque manche : rien ne relie deux donnes entre elles.
      if (game.phase === 'gameOver') {
        // Match fini : un nouveau match commence par une nouvelle commande ; sinon, manche suivante.
        if (isMatchOver(room.match ?? NEW_MATCH)) return { ok: true, room: startOrder(room, deps) };
        return { ok: true, room: { ...room, acks: [], game: createGame({ rules: room.settings.rules, seed: deps.newSecureSeed() }) } };
      }
      const next = startNextHand({ ...game, seed: deps.newSecureSeed() });
      if (!next.ok) return fail(next.error);
      return { ok: true, room: { ...room, acks: [], game: next.state } };
    }
  }
}

/** Note l'heure où commence chaque tour d'enchère (à chaque enregistrement du salon). */
export function trackBidTurn(room: RoomAggregate, now: number): RoomAggregate {
  const key = room.game ? bidTurnKey(room.game) : null;
  if (key === null) {
    if (room.bidTurn === undefined) return room;
    const { bidTurn: _done, ...rest } = room;
    return rest;
  }
  return room.bidTurn?.key === key ? room : { ...room, bidTurn: { key, since: now } };
}

/**
 * Un spectateur s'inscrit avec son nom, si les joueurs acceptent les spectateurs. On garde au plus
 * MAX_SPECTATORS inscriptions récentes ; s'inscrire à nouveau met juste son nom à jour.
 */
export function watchRoom(room: RoomAggregate, userId: string, name: string, now: number): RoomResult {
  if (room.tableNumber === undefined) return fail('Cette partie ne se regarde pas.');
  if (spectatorMode(room) === 'none') return fail('Les joueurs de cette table ne veulent pas de spectateurs.');
  if (room.players.some((p) => p.playerId === userId)) return fail('Vous jouez à cette table : reprenez votre place.');
  const fresh = (room.spectators ?? []).filter(
    (s) => s.userId !== userId && now - s.since < SPECTATOR_STALE_HOURS * 3_600_000,
  );
  if (room.players.some((p) => sameNickname(p.nickname, name)) || fresh.some((s) => sameNickname(s.name, name))) {
    return fail(NICKNAME_TAKEN);
  }
  const spectators = [...fresh, { userId, name, since: now }].slice(-MAX_SPECTATORS);
  return { ok: true, room: { ...room, spectators } };
}

/** Le spectateur s'en va. */
export function unwatchRoom(room: RoomAggregate, userId: string): RoomResult {
  return { ok: true, room: { ...room, spectators: (room.spectators ?? []).filter((s) => s.userId !== userId) } };
}

/**
 * Informations d'un salon installé à une table du café : pseudos, état, scores (publics), la vue des
 * spectateurs (sans aucune main, lisible seulement par les spectateurs inscrits) et la liste des
 * spectateurs pour les droits de la base. Jamais le code du salon.
 */

/** Tous les joueurs ont quitté la table (bouton « Quitter la table ») : elle est libre. */
export function everyoneLeft(room: RoomAggregate): boolean {
  return room.players.length > 0 && room.players.every((p) => room.left?.includes(p.playerId));
}

export function buildPublicTable(room: RoomAggregate): PublicTableData | null {
  if (room.tableNumber === undefined) return null;
  // Plus personne à la table : aucun pseudo, la base libère la table et la vue des spectateurs.
  const players = everyoneLeft(room)
    ? []
    : [...room.players].sort((a, b) => a.seat - b.seat).map(({ seat, nickname, ready }) => ({ seat, nickname, ready }));
  const game = room.game;
  const mode = spectatorMode(room);
  const spectators = mode === 'none' ? [] : (room.spectators ?? []);
  return {
    tableNumber: room.tableNumber,
    info: {
      // La table se libère à la fin du match (pas entre deux manches).
      status: game?.phase === 'gameOver' && isMatchOver(room.match ?? NEW_MATCH) ? 'finished' : room.status,
      players: players.map(({ seat, nickname }) => ({ seat, nickname })),
      scores: game ? [game.scores[0], game.scores[1]] : null,
      targetScore: makeRules(room.settings.rules).targetScore,
      spectators: mode,
    },
    // Spectateurs refusés : aucune vue de la partie n'est publiée.
    watch:
      mode === 'none'
        ? null
        : {
            roomId: room.id,
            tableNumber: room.tableNumber,
            status: room.status,
            players,
            game: game ? getSpectatorView(game) : null,
            match: room.match ?? NEW_MATCH,
            spectatorMode: mode,
            spectators: spectators.map((s) => s.name),
          },
    spectators: spectators.map((s) => ({ userId: s.userId, name: s.name, canListen: mode === 'listen' })),
  };
}

/** Ce que chacun a déjà commandé (visible de tous, comme sur le papier de Naceur). */
function chosenBySeat(room: RoomAggregate): Partial<Record<Seat, Drink>> {
  const chosen: Partial<Record<Seat, Drink>> = {};
  for (const p of room.players) {
    const drink = room.order?.drinks[p.playerId];
    if (drink) chosen[p.seat] = drink;
  }
  return chosen;
}

/** Vue de chaque joueur : uniquement ce qu'il a le droit de voir (§11.4). */
export function buildViews(room: RoomAggregate): StoredView[] {
  const players = [...room.players]
    .sort((a, b) => a.seat - b.seat)
    .map(({ playerId, seat, nickname, ready }) => ({ seat, nickname, ready, ...(room.left?.includes(playerId) ? { left: true } : {}) }));
  const ackSeats = room.players.filter((p) => room.acks.includes(p.playerId)).map((p) => p.seat);
  const hostSeat = hostOf(room)?.seat ?? null;
  return room.players.map((p) => {
    const view: RoomView = {
      roomId: room.id,
      code: room.code,
      status: room.status,
      tableNumber: room.tableNumber ?? null,
      mySeat: p.seat,
      players,
      settings: room.settings,
      hostSeat,
      ackSeats,
      game: room.game ? getPlayerView(room.game, p.seat) : null,
      match: room.match ?? NEW_MATCH,
      order: room.order ? { deadline: room.order.deadline, chosen: chosenBySeat(room) } : null,
      drinks: room.drinks ?? {},
      spectators: spectatorMode(room) === 'none' ? [] : (room.spectators ?? []).map((s) => s.name),
    };
    return { playerId: p.playerId, seat: p.seat, view };
  });
}
