// A Decision is what the engine waits for: who must act, and on what (03-rules-engine.md).
// It is answered by an Action, never by a callback.

import type { PlayerId, RuleNumber } from './ids.ts';

/** The player must choose which cards, if any, to set aside (117.1). */
export type MulliganDecision = {
  readonly kind: 'Mulligan';
  readonly player: PlayerId;
  /** Maximum number of cards that can be set aside. */
  readonly max: number;
  readonly rule: RuleNumber;
};

/**
 * The player has Priority (312): they may take Discretionary Actions (411.1).
 * In M2's first step, the only one is ending the turn (316.9).
 */
export type PriorityDecision = {
  readonly kind: 'Priority';
  readonly player: PlayerId;
  readonly rule: RuleNumber;
};

export type Decision = MulliganDecision | PriorityDecision;
