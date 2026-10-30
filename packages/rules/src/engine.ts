// The public engine API (docs/03-rules-engine.md). M1: setup and mulligan only.

import {
  type Action,
  assertNever,
  type Decision,
  type GameEvent,
  type GameState,
  type IllegalReason,
  type PlayerId,
} from '@foilengine/types';
import { IllegalActionError } from './errors.ts';
import {
  applyMulligan,
  checkMulligan,
  mulliganActions,
  mulliganDecision,
} from './setup/mulligan.ts';

/** What the engine waits for now, if anything. */
export function pendingDecision(state: GameState): Decision | null {
  return mulliganDecision(state);
}

export function isLegal(
  state: GameState,
  action: Action,
): { ok: true } | { ok: false; reason: IllegalReason } {
  if (pendingDecision(state) === null) {
    return {
      ok: false,
      reason: { code: 'no-pending-decision', message: 'Nothing can be done right now', rule: null },
    };
  }
  switch (action.type) {
    case 'Mulligan': {
      const reason = checkMulligan(state, action);
      return reason === null ? { ok: true } : { ok: false, reason };
    }
    default:
      return assertNever(action.type);
  }
}

/** Every legal action for `player` right now. */
export function legalActions(state: GameState, player: PlayerId): Action[] {
  const decision = pendingDecision(state);
  if (decision === null || decision.player !== player) return [];
  switch (decision.kind) {
    case 'Mulligan':
      return mulliganActions(state);
    default:
      return assertNever(decision.kind);
  }
}

/**
 * Applies a legal action and returns the new state with the events it produced.
 * The given state is never modified. An illegal action throws `IllegalActionError` and changes nothing.
 */
export function apply(state: GameState, action: Action): { state: GameState; events: GameEvent[] } {
  const legality = isLegal(state, action);
  if (!legality.ok) throw new IllegalActionError(legality.reason);
  switch (action.type) {
    case 'Mulligan':
      return applyMulligan(state, action);
    default:
      return assertNever(action.type);
  }
}
