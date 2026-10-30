// Actions are player intents (docs/02-game-model.md). Named in the imperative.
// M1 only has the mulligan; the union grows with each milestone.

import type { ObjectId, PlayerId } from './ids.ts';

/** Mulligan (117): set aside up to two cards of the hand (117.1). An empty list keeps the hand. */
export type Mulligan = {
  readonly type: 'Mulligan';
  readonly player: PlayerId;
  readonly setAside: readonly ObjectId[];
};

export type Action = Mulligan;

export type ActionType = Action['type'];
