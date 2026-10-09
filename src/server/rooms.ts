import { SEATS, SUITS, applyAction, createGame, getPlayerView, startNextHand } from '../engine/index.ts';
import type { BidAction, GameAction, Seat } from '../engine/index.ts';
import type { RoomAggregate, RoomPlayer, RoomRequest, RoomView, ServerDeps, StoredView } from './types.ts';

export const DEFAULT_ABSENCE_DELAY_SECONDS = 30;
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_LENGTH = 6;

export type RoomResult = { readonly ok: true; readonly room: RoomAggregate } | { readonly ok: false; readonly error: string };

const fail = (error: string): RoomResult => ({ ok: false, error });

/** Nettoie le pseudo saisi : 1 à 20 caractères visibles. */
export function cleanNickname(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const cleaned = raw.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim();
  if (cleaned.length === 0) return null;
  return [...cleaned].slice(0, 20).join('');
}

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
  return null;
}

/** Valide la forme d'une requête venant du navigateur (donnée non fiable). */
export function parseRequest(raw: unknown): RoomRequest | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  switch (r.type) {
    case 'create': {
      const nickname = cleanNickname(r.nickname);
      return nickname ? { type: 'create', nickname } : null;
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
    case 'leave':
    case 'continue':
      return { type: r.type, roomId };
    case 'game': {
      const action = parseAction(r.action);
      return action ? { type: 'game', roomId, action } : null;
    }
    default:
      return null;
  }
}

export function createRoom(playerId: string, nickname: string, deps: ServerDeps): RoomAggregate {
  return {
    id: deps.newRoomId(),
    code: deps.newRoomCode(),
    version: 1,
    status: 'lobby',
    settings: { rules: {}, absenceDelaySeconds: DEFAULT_ABSENCE_DELAY_SECONDS },
    players: [{ playerId, nickname, seat: 0, ready: false }],
    game: null,
    acks: [],
  };
}

/** Rejoindre, ou revenir dans son salon après une coupure (même identité anonyme). */
export function joinRoom(room: RoomAggregate, playerId: string, nickname: string): RoomResult {
  const existing = room.players.find((p) => p.playerId === playerId);
  if (existing) {
    const players = room.players.map((p) => (p.playerId === playerId ? { ...p, nickname } : p));
    return { ok: true, room: { ...room, players } };
  }
  if (room.status !== 'lobby') return fail('La partie a déjà commencé dans ce salon.');
  const seat = SEATS.find((s) => !room.players.some((p) => p.seat === s));
  if (seat === undefined) return fail('Le salon est complet.');
  return { ok: true, room: { ...room, players: [...room.players, { playerId, nickname, seat, ready: false }] } };
}

function member(room: RoomAggregate, playerId: string): RoomPlayer | undefined {
  return room.players.find((p) => p.playerId === playerId);
}

export function applyRoomRequest(
  room: RoomAggregate,
  playerId: string,
  request: Exclude<RoomRequest, { type: 'create' } | { type: 'join' }>,
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
        // §11.1 : la partie commence quand 4 joueurs sont présents et prêts.
        return {
          ok: true,
          room: { ...updated, status: 'playing', acks: [], game: createGame({ rules: room.settings.rules, seed: deps.newSecureSeed() }) },
        };
      }
      return { ok: true, room: updated };
    }
    case 'leave': {
      if (room.status !== 'lobby') return fail('Impossible de quitter pendant une partie : votre place vous attend.');
      return { ok: true, room: { ...room, players: room.players.filter((p) => p.playerId !== playerId) } };
    }
    case 'game': {
      if (!room.game) return fail("La partie n'a pas commencé.");
      const result = applyAction(room.game, me.seat, request.action);
      if (!result.ok) return fail(result.error);
      return { ok: true, room: { ...room, game: result.state, acks: [] } };
    }
    case 'continue': {
      const game = room.game;
      if (!game || (game.phase !== 'handOver' && game.phase !== 'gameOver')) return fail('Rien à continuer pour le moment.');
      const acks = room.acks.includes(playerId) ? room.acks : [...room.acks, playerId];
      if (acks.length < 4) return { ok: true, room: { ...room, acks } };
      // Nouvelle graine secrète pour chaque manche : rien ne relie deux donnes entre elles.
      if (game.phase === 'gameOver') {
        return { ok: true, room: { ...room, acks: [], game: createGame({ rules: room.settings.rules, seed: deps.newSecureSeed() }) } };
      }
      const next = startNextHand({ ...game, seed: deps.newSecureSeed() });
      if (!next.ok) return fail(next.error);
      return { ok: true, room: { ...room, acks: [], game: next.state } };
    }
  }
}

/** Vue de chaque joueur : uniquement ce qu'il a le droit de voir (§11.4). */
export function buildViews(room: RoomAggregate): StoredView[] {
  const players = [...room.players]
    .sort((a, b) => a.seat - b.seat)
    .map(({ seat, nickname, ready }) => ({ seat, nickname, ready }));
  const ackSeats = room.players.filter((p) => room.acks.includes(p.playerId)).map((p) => p.seat);
  return room.players.map((p) => {
    const view: RoomView = {
      roomId: room.id,
      code: room.code,
      status: room.status,
      mySeat: p.seat,
      players,
      settings: room.settings,
      ackSeats,
      game: room.game ? getPlayerView(room.game, p.seat) : null,
    };
    return { playerId: p.playerId, seat: p.seat, view };
  });
}
