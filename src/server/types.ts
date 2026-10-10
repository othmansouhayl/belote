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
  /** Créateur du salon : seul à pouvoir modifier les réglages (absent des anciens salons). */
  readonly hostId?: string;
  readonly game: GameState | null;
  /** Joueurs ayant demandé à continuer (manche suivante ou revanche). */
  readonly acks: readonly string[];
  /** Table du Café Tarek (1 à 6) choisie à la création ; absente pour les anciens salons. */
  readonly tableNumber?: number;
}

/**
 * Ce que tout le monde voit d'une table du café (la maquette 3D de l'accueil) :
 * jamais le code du salon, jamais une carte.
 */
export interface CafeTableInfo {
  readonly status: 'lobby' | 'playing' | 'finished';
  readonly players: readonly { readonly seat: Seat; readonly nickname: string }[];
  readonly scores: readonly [number, number] | null;
  readonly targetScore: number;
}

/** Ce que reçoit un spectateur : uniquement les informations publiques de la partie. */
export interface WatchView {
  readonly roomId: string;
  readonly tableNumber: number;
  readonly status: RoomAggregate['status'];
  readonly players: RoomView['players'];
  readonly game: PlayerView | null;
}

/** Données publiques d'un salon installé à une table du café. */
export interface PublicTableData {
  readonly tableNumber: number;
  readonly info: CafeTableInfo;
  readonly watch: WatchView;
}

/** Ce que chaque joueur reçoit : informations du salon + sa vue filtrée de la partie. */
export interface RoomView {
  readonly roomId: string;
  readonly code: string;
  readonly status: RoomAggregate['status'];
  /** Table du café (1 à 6), ou null pour un salon sans table. */
  readonly tableNumber?: number | null;
  readonly mySeat: Seat;
  readonly players: readonly { readonly seat: Seat; readonly nickname: string; readonly ready: boolean }[];
  readonly settings: RoomSettings;
  readonly hostSeat: Seat | null;
  readonly ackSeats: readonly Seat[];
  readonly game: PlayerView | null;
}

export type RoomRequest =
  | { readonly type: 'create'; readonly nickname: string; readonly table?: number }
  | { readonly type: 'join'; readonly code: string; readonly nickname: string }
  | { readonly type: 'seat'; readonly roomId: string; readonly seat: Seat }
  | { readonly type: 'ready'; readonly roomId: string; readonly ready: boolean }
  | { readonly type: 'settings'; readonly roomId: string; readonly settings: RoomSettings }
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
  /**
   * Crée le salon (et réserve sa table du café) : 'conflict' si le code est déjà pris,
   * 'tableTaken' si la table est occupée par une partie active.
   */
  insert(room: RoomAggregate, views: readonly StoredView[], table: PublicTableData | null): Promise<'ok' | 'conflict' | 'tableTaken'>;
  /** Enregistre si la version n'a pas changé entre-temps ; false en cas de conflit. */
  save(
    room: RoomAggregate,
    expectedVersion: number,
    views: readonly StoredView[],
    table: PublicTableData | null,
  ): Promise<boolean>;
}
