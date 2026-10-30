// Actions are player intents (docs/02-game-model.md). Named in the imperative.
// M1 only has the mulligan; the union grows with each milestone.

import type { ObjectId, PlayerId } from './ids.ts';

/** Mulligan (117): set aside up to two cards of the hand (117.1). An empty list keeps the hand. */
export type Mulligan = {
  readonly type: 'Mulligan';
  readonly player: PlayerId;
  readonly setAside: readonly ObjectId[];
};

/** The Turn Player ends their turn: they have no more Discretionary Actions to take (316.9). */
export type EndTurn = {
  readonly type: 'EndTurn';
  readonly player: PlayerId;
};

export type Action = Mulligan | EndTurn;

export type ActionType = Action['type'];
