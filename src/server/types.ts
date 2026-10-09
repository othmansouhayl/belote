import type { GameAction, GameState, PlayerView, RulesConfig, Seat } from '../engine/index.ts';

export interface RoomPlayer {
  /** Identifiant d'authentification Supabase (anonyme) : jamais envoyé aux autres joueurs. */
  readonly playerId: string;
  readonly nickname: string;
  readonly seat: Seat;
  readonly ready: boolean;
}

export interface RoomSettings {
  readonly rules: Partial<RulesConfig>;
  /** Délai (secondes) avant d'afficher un joueur déconnecté comme absent (§11.5). */
  readonly absenceDelaySeconds: number;
}

/** État complet d'un salon, conservé uniquement côté serveur. */
export interface RoomAggregate {
  readonly id: string;
  readonly code: string;
  readonly version: number;
  readonly status: 'lobby' | 'playing';
  readonly settings: RoomSettings;
  readonly players: readonly RoomPlayer[];
  readonly game: GameState | null;
  /** Joueurs ayant demandé à continuer (manche suivante ou revanche). */
  readonly acks: readonly string[];
}

/** Ce que chaque joueur reçoit : informations du salon + sa vue filtrée de la partie. */
export interface RoomView {
  readonly roomId: string;
  readonly code: string;
  readonly status: RoomAggregate['status'];
  readonly mySeat: Seat;
  readonly players: readonly { readonly seat: Seat; readonly nickname: string; readonly ready: boolean }[];
  readonly settings: RoomSettings;
  readonly ackSeats: readonly Seat[];
  readonly game: PlayerView | null;
}

export type RoomRequest =
  | { readonly type: 'create'; readonly nickname: string }
  | { readonly type: 'join'; readonly code: string; readonly nickname: string }
  | { readonly type: 'seat'; readonly roomId: string; readonly seat: Seat }
  | { readonly type: 'ready'; readonly roomId: string; readonly ready: boolean }
  | { readonly type: 'leave'; readonly roomId: string }
  | { readonly type: 'game'; readonly roomId: string; readonly action: GameAction }
  | { readonly type: 'continue'; readonly roomId: string };

export type RoomResponse =
  | { readonly ok: true; readonly roomId: string; readonly code: string }
  | { readonly ok: false; readonly error: string };

/** Sources de hasard et d'identifiants fournies par l'environnement (crypto sur le serveur). */
export interface ServerDeps {
  readonly newRoomId: () => string;
  readonly newRoomCode: () => string;
  /** Graine secrète d'au moins 128 bits pour le mélange. */
  readonly newSecureSeed: () => string;
}

export interface StoredView {
  readonly playerId: string;
  readonly seat: Seat;
  readonly view: RoomView;
}

/** Accès au stockage ; l'implémentation Supabase écrit tout en une seule transaction. */
export interface RoomStore {
  loadById(roomId: string): Promise<RoomAggregate | null>;
  loadByCode(code: string): Promise<RoomAggregate | null>;
  /** Crée le salon ; false si le code est déjà pris. */
  insert(room: RoomAggregate, views: readonly StoredView[]): Promise<boolean>;
  /** Enregistre si la version n'a pas changé entre-temps ; false en cas de conflit. */
  save(room: RoomAggregate, expectedVersion: number, views: readonly StoredView[]): Promise<boolean>;
}
