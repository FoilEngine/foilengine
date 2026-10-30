// The full game state. Only the server and the engine see it; players get a PlayerView.
// Pure JSON (ADR 0004). Any change to its shape increments STATE_VERSION.

import type { CardDefinition } from './cards.ts';
import type { CardId, ObjectId, PlayerId, RulesVersion } from './ids.ts';
import type { ModeId } from './setup.ts';
import type { PlayerZoneId } from './zones.ts';

export const STATE_VERSION = 1;

/** State of the seeded PRNG (ADR 0003): `xoshiro128**` and its four uint32 words. Read and advanced by `rules` only. */
export type RngState = {
  readonly algorithm: string;
  readonly state: readonly number[];
};

/** A card or token in the game (119). */
export type GameObject = {
  readonly id: ObjectId;
  readonly card: CardId;
  /** The player who brought it into the game (127.1). */
  readonly owner: PlayerId;
  /** The object it was before its last change to or from a Non-Board Zone (124), if any. */
  readonly previousObjectId: ObjectId | null;
};

export type PlayerZones = { readonly [Z in PlayerZoneId]: readonly ObjectId[] };

export type PlayerState = {
  readonly id: PlayerId;
  /** Never below 0 (194.4). */
  readonly points: number;
  /** Ordered zones list the top of the deck first. */
  readonly zones: PlayerZones;
};

/** A battlefield in the Battlefield Zone (107.2). Control, units and facedown cards arrive with M2. */
export type BattlefieldState = {
  readonly object: ObjectId;
};

/** Where the game stands. M2 replaces `started` with the turn structure (300–317). */
export type GameStage =
  /** Mulligans in turn order (117): `pending` lists the players who still have to decide. */
  | { readonly kind: 'mulligan'; readonly pending: readonly PlayerId[] }
  /** Setup is complete and the first player takes their turn (118). */
  | { readonly kind: 'started'; readonly turnPlayer: PlayerId };

export type GameState = {
  readonly version: typeof STATE_VERSION;
  readonly rulesVersion: RulesVersion;
  readonly mode: ModeId;
  readonly rng: RngState;
  /** Counter used to create ObjectIds deterministically. */
  readonly nextObjectId: number;
  /** Sequence number of the last event emitted. */
  readonly eventSeq: number;
  /** Definitions of the cards in this game, so that a state is self-contained. */
  readonly cards: Readonly<Record<CardId, CardDefinition>>;
  readonly objects: Readonly<Record<ObjectId, GameObject>>;
  /** In seating order. */
  readonly players: readonly PlayerState[];
  /** Looping queue of turns, starting with the First Player (115.1.c). */
  readonly turnOrder: readonly PlayerId[];
  readonly battlefields: readonly BattlefieldState[];
  readonly stage: GameStage;
  readonly winner: PlayerId | null;
};
