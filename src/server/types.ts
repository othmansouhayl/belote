import type { GameAction, GameState, MatchState, PlayerView, RulesConfig, Seat } from '../engine/index.ts';

/** Ce qu'on commande à Mohamed Naceur au début du match. */
export const DRINKS = ['express', 'tey', 'capucin', 'allonge', 'chicha', 'filtre'] as const;
export type Drink = (typeof DRINKS)[number];

/** Commande en cours : la partie démarre quand les 4 ont choisi (ou à l'échéance, Naceur choisit). */
export interface DrinkOrder {
  /** Échéance (millisecondes, horloge du serveur). */
  readonly deadline: number;
  readonly drinks: Readonly<Record<string, Drink>>;
}

export interface RoomPlayer {
  /** Identifiant d'authentification Supabase (anonyme) : jamais envoyé aux autres joueurs. */
  readonly playerId: string;
  readonly nickname: string;
  readonly seat: Seat;
  readonly ready: boolean;
}

/**
 * Spectateurs, choisis par le créateur du salon : refusés, autorisés à regarder la partie, ou à la
 * regarder et à écouter le vocal (en écoute seule : ils ne parlent jamais).
 */
export const SPECTATOR_MODES = ['none', 'watch', 'listen'] as const;
export type SpectatorMode = (typeof SPECTATOR_MODES)[number];
/** Salons créés avant ce réglage : on peut regarder, sans écouter. */
export const DEFAULT_SPECTATOR_MODE: SpectatorMode = 'watch';

export interface RoomSettings {
  readonly rules: Partial<RulesConfig>;
  /** Délai (secondes) avant d'afficher un joueur déconnecté comme absent (§11.5). */
  readonly absenceDelaySeconds: number;
  /** Spectateurs : refusés, regarder, ou regarder et écouter (absent des anciens salons : 'watch'). */
  readonly spectators?: SpectatorMode;
}

/** Un spectateur inscrit (avec son nom) : son identifiant anonyme n'est jamais montré aux autres. */
export interface RoomSpectator {
  readonly userId: string;
  readonly name: string;
  /** Arrivée (millisecondes, horloge du serveur). */
  readonly since: number;
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
  /** Joueurs ayant quitté la table pendant ou après la partie : quand tous sont partis, la table se libère. */
  readonly left?: readonly string[];
  /** Le match en cours (manches gagnées) ; absent pour les anciens salons. */
  readonly match?: MatchState;
  /** Commande des boissons au début du match ; la première manche commence ensuite. */
  readonly order?: DrinkOrder | null;
  /** Boissons commandées, par place (pour tout le match). */
  readonly drinks?: Partial<Record<Seat, Drink>>;
  /** Spectateurs inscrits (avec leur nom). */
  readonly spectators?: readonly RoomSpectator[];
  /** Tour d'enchère en cours et l'heure où il a commencé : le chrono de réflexion (règle [41]). */
  readonly bidTurn?: { readonly key: string; readonly since: number };
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
  /** Ce que les joueurs permettent aux spectateurs (absent des anciennes tables : 'watch'). */
  readonly spectators?: SpectatorMode;
}

/** Ce que reçoit un spectateur : uniquement les informations publiques de la partie. */
export interface WatchView {
  readonly roomId: string;
  readonly tableNumber: number;
  readonly status: RoomAggregate['status'];
  readonly players: RoomView['players'];
  readonly game: PlayerView | null;
  readonly match: MatchState;
  /** Regarder seulement, ou regarder et écouter le vocal. */
  readonly spectatorMode?: SpectatorMode;
  /** Les noms des spectateurs (eux aussi se voient). */
  readonly spectators?: readonly string[];
}

/** Données d'un salon installé à une table du café, pour la base. */
export interface PublicTableData {
  readonly tableNumber: number;
  /** Lisible par tous (la maquette 3D de l'accueil). */
  readonly info: CafeTableInfo;
  /** Lisible uniquement par les spectateurs inscrits ; null si les joueurs refusent les spectateurs. */
  readonly watch: WatchView | null;
  /**
   * Spectateurs inscrits, pour les droits de la base (lire la partie, écouter le vocal) :
   * jamais publiés tels quels.
   */
  readonly spectators: readonly { readonly userId: string; readonly name: string; readonly canListen: boolean }[];
}

/** Ce que chaque joueur reçoit : informations du salon + sa vue filtrée de la partie. */
export interface RoomView {
  readonly roomId: string;
  readonly code: string;
  readonly status: RoomAggregate['status'];
  /** Table du café (1 à 6), ou null pour un salon sans table. */
  readonly tableNumber?: number | null;
  readonly mySeat: Seat;
  readonly players: readonly {
    readonly seat: Seat;
    readonly nickname: string;
    readonly ready: boolean;
    /** A quitté la table (bouton « Quitter la table »). */
    readonly left?: boolean;
  }[];
  readonly settings: RoomSettings;
  readonly hostSeat: Seat | null;
  readonly ackSeats: readonly Seat[];
  readonly game: PlayerView | null;
  /** Manches gagnées dans le match en cours. */
  readonly match: MatchState;
  /** Commande en cours : échéance et ce que chacun a déjà choisi. */
  readonly order: { readonly deadline: number; readonly chosen: Partial<Record<Seat, Drink>> } | null;
  readonly drinks: Partial<Record<Seat, Drink>>;
  /** Qui regarde la partie (les joueurs savent toujours qui les regarde ou les écoute). */
  readonly spectators?: readonly string[];
}

export type RoomRequest =
  | { readonly type: 'create'; readonly nickname: string; readonly table?: number }
  | { readonly type: 'join'; readonly code: string; readonly nickname: string }
  | { readonly type: 'seat'; readonly roomId: string; readonly seat: Seat }
  | { readonly type: 'ready'; readonly roomId: string; readonly ready: boolean }
  | { readonly type: 'settings'; readonly roomId: string; readonly settings: RoomSettings }
  | { readonly type: 'leave'; readonly roomId: string }
  /** Quitter la table pendant ou après une partie : la table se libère quand les 4 sont partis. */
  | { readonly type: 'quit'; readonly roomId: string }
  /** Choisir sa boisson ; sans boisson et après l'échéance, Naceur choisit pour les retardataires. */
  | { readonly type: 'drink'; readonly roomId: string; readonly drink?: Drink }
  /** Arrêter le match après une manche (au lieu de jouer la suivante). */
  | { readonly type: 'endMatch'; readonly roomId: string }
  | { readonly type: 'game'; readonly roomId: string; readonly action: GameAction; readonly thought?: boolean }
  | { readonly type: 'continue'; readonly roomId: string }
  /** S'inscrire comme spectateur d'une table, avec son nom (si les joueurs l'acceptent). */
  | { readonly type: 'watch'; readonly roomId: string; readonly nickname: string }
  /** Ne plus regarder. */
  | { readonly type: 'unwatch'; readonly roomId: string };

export type RoomResponse =
  /** Pour un spectateur, `code` est vide (le code du salon reste aux joueurs) et `listen` dit s'il peut écouter. */
  | { readonly ok: true; readonly roomId: string; readonly code: string; readonly listen?: boolean }
  | { readonly ok: false; readonly error: string };

/** Sources de hasard et d'identifiants fournies par l'environnement (crypto sur le serveur). */
export interface ServerDeps {
  readonly newRoomId: () => string;
  readonly newRoomCode: () => string;
  /** Graine secrète d'au moins 128 bits pour le mélange. */
  readonly newSecureSeed: () => string;
  /** Heure actuelle (millisecondes) ; Date.now par défaut. */
  readonly now?: () => number;
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
