// Expected errors are values (docs/13-conventions.md): why an action is refused,
// or why a game cannot be created from a setup. Sent to clients as they are.

import type { PlayerId, RuleNumber } from './ids.ts';

export type IllegalCode =
  /** No decision is pending: nothing can be done right now. */
  | 'no-pending-decision'
  /** Another player must decide first. */
  | 'not-your-decision'
  /** The action does not answer the pending decision. */
  | 'wrong-action'
  /** More cards than the decision allows. */
  | 'too-many-cards'
  /** A chosen card is not where it must be. */
  | 'card-not-in-hand'
  /** The same card was chosen twice. */
  | 'duplicate-card'
  /** The card cannot be played from where it is, or is not a kind of card that can be played yet. */
  | 'card-not-playable'
  /** The location is not a valid one for this card (355.2). */
  | 'invalid-location'
  /** The targets are missing, or one is not a valid choice (355.8, 355.9). */
  | 'invalid-target'
  /** The card cannot be played in the current state of the turn (358.4, 309, 308). */
  | 'wrong-timing'
  /** The ability's source is not a permanent the player controls, or has no such ability (378, 380). */
  | 'invalid-source'
  /** The order of triggered abilities is not an order of all of them (383.3.d). */
  | 'invalid-order'
  /** A rune of the payment cannot be used as requested. */
  | 'invalid-payment'
  /** The resources in the Rune Pool do not cover the cost (358.2). */
  | 'cannot-pay'
  /** A unit of the move cannot make it: not yours, not ready, or not at a valid origin (144). */
  | 'invalid-move'
  /** The rules allow it, but the engine does not implement it yet (the reason names what is missing). */
  | 'not-implemented'
  /** The combat damage assignment breaks 467.2.c. */
  | 'invalid-assignment';

/** Why an action is illegal, with the rule that forbids it when there is one. */
export type IllegalReason = {
  readonly code: IllegalCode;
  readonly message: string;
  readonly rule: RuleNumber | null;
};

export type SetupProblemCode =
  | 'rules-version-mismatch'
  | 'unsupported-mode'
  | 'wrong-player-count'
  | 'duplicate-player'
  | 'unknown-card'
  | 'wrong-category'
  | 'not-a-champion'
  | 'champion-not-in-main-deck'
  | 'main-deck-too-small'
  | 'wrong-rune-count'
  | 'wrong-battlefield-count'
  /** A card lacks what the engine needs to play it: a cost (131.1), a might (143), a single domain for a rune. */
  | 'incomplete-card'
  /** A deck holds a token, or an effect plays a token with no token definition (185, 185.1.b). */
  | 'invalid-token';

/** Why a game cannot be created from a setup. */
export type SetupProblem = {
  readonly code: SetupProblemCode;
  /** The player whose deck is at fault, or null for a problem with the whole setup. */
  readonly player: PlayerId | null;
  readonly message: string;
  readonly rule: RuleNumber | null;
};
