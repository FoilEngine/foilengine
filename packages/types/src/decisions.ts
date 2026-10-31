// A Decision is what the engine waits for: who must act, and on what (03-rules-engine.md).
// It is answered by an Action, never by a callback.

import type { TargetSpec } from './effects.ts';
import type { ObjectId, PlayerId, RuleNumber } from './ids.ts';
import type { ChainAbility, TriggeredAbility } from './state.ts';

/** The player must choose which cards, if any, to set aside (117.1). */
export type MulliganDecision = {
  readonly kind: 'Mulligan';
  readonly player: PlayerId;
  /** Maximum number of cards that can be set aside. */
  readonly max: number;
  readonly rule: RuleNumber;
};

/**
 * The player has Priority (312): they may take Discretionary Actions (411.1). In their Main Phase
 * in a Neutral Open State (312.2.a): play cards, move, end the turn. On a Chain (312.2.c,
 * 312.2.d): play a card with Reaction (309.1.a), or pass Priority (338.1).
 */
export type PriorityDecision = {
  readonly kind: 'Priority';
  readonly player: PlayerId;
  readonly rule: RuleNumber;
};

/** The player has Focus in a Showdown (313, 347): play a legally timed card, or pass. */
export type FocusDecision = {
  readonly kind: 'Focus';
  readonly player: PlayerId;
  readonly battlefield: ObjectId;
  readonly rule: RuleNumber;
};

/** The player must assign `amount` combat damage among the `targets` (467.2.c). */
export type AssignDamageDecision = {
  readonly kind: 'AssignDamage';
  readonly player: PlayerId;
  readonly battlefield: ObjectId;
  readonly amount: number;
  readonly targets: readonly ObjectId[];
  readonly rule: RuleNumber;
};

/**
 * The player controls several triggered abilities that triggered at the same time: they choose
 * the order in which they go on the Chain (383.3.d).
 */
export type OrderTriggersDecision = {
  readonly kind: 'OrderTriggers';
  readonly player: PlayerId;
  readonly abilities: readonly TriggeredAbility[];
  readonly rule: RuleNumber;
};

/**
 * The controller of the oldest Pending triggered ability makes its choices to finalize it (337.1):
 * whether to perform it if it is `optional` (383.3.a), and its `targets` (355.5).
 */
export type FinalizeAbilityDecision = {
  readonly kind: 'FinalizeAbility';
  readonly player: PlayerId;
  readonly item: ObjectId;
  readonly ability: ChainAbility;
  readonly optional: boolean;
  readonly targets: readonly TargetSpec[];
  readonly rule: RuleNumber;
};

export type Decision =
  | MulliganDecision
  | PriorityDecision
  | FocusDecision
  | AssignDamageDecision
  | OrderTriggersDecision
  | FinalizeAbilityDecision;
