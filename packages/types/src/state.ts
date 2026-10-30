// The full game state. Only the server and the engine see it; players get a PlayerView.
// Pure JSON (ADR 0004). Any change to its shape increments STATE_VERSION.

import type { CardDefinition, Domain } from './cards.ts';
import type { CardId, ObjectId, PlayerId, RulesVersion } from './ids.ts';
import type { ModeId } from './setup.ts';
import type { PlayerZoneId } from './zones.ts';

export const STATE_VERSION = 3;

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
  /** Exhausted (415) or ready (416). Only meaningful on the board; a new object starts ready. */
  readonly exhausted: boolean;
};

export type PlayerZones = { readonly [Z in PlayerZoneId]: readonly ObjectId[] };

/**
 * Energy and Power available to pay costs (165–166). `power.any` is Power of any domain
 * ([A], 135.2.e.5.b), the Universal Power of 163.2.b. Empties at the start of each Main Phase
 * and at the end of each turn (167).
 */
export type RunePool = {
  readonly energy: number;
  readonly power: { readonly [D in Domain | 'any']: number };
};

export type PlayerState = {
  readonly id: PlayerId;
  /** Never below 0 (194.4). */
  readonly points: number;
  /** Turns this player has started; the First Turn Process of the mode depends on it (485.7). */
  readonly turnsTaken: number;
  readonly runePool: RunePool;
  /** Ordered zones list the top of the deck first. */
  readonly zones: PlayerZones;
};

/** A battlefield in the Battlefield Zone (107.2). Control, units and facedown cards arrive with M2. */
export type BattlefieldState = {
  readonly object: ObjectId;
};

/** Phases of the turn (314–317). Start of Turn is split into its four phases (315.1–315.4). */
export type TurnPhase = 'awaken' | 'beginning' | 'channel' | 'draw' | 'main' | 'ending';

/** Where the game stands. */
export type GameStage =
  /** Mulligans in turn order (117): `pending` lists the players who still have to decide. */
  | { readonly kind: 'mulligan'; readonly pending: readonly PlayerId[] }
  /** A turn is in progress (301). `turnNumber` counts the turns of the game, from 1. */
  | {
      readonly kind: 'turn';
      readonly turnPlayer: PlayerId;
      readonly turnNumber: number;
      readonly phase: TurnPhase;
    }
  /** The game is over (196); `winner` says who won. */
  | { readonly kind: 'ended' };

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
