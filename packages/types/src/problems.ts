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
  | 'duplicate-card';

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
  | 'wrong-battlefield-count';

/** Why a game cannot be created from a setup. */
export type SetupProblem = {
  readonly code: SetupProblemCode;
  /** The player whose deck is at fault, or null for a problem with the whole setup. */
  readonly player: PlayerId | null;
  readonly message: string;
  readonly rule: RuleNumber | null;
};
