// The public engine API (docs/03-rules-engine.md).

import {
  type Action,
  assertNever,
  type Decision,
  type GameEvent,
  type GameState,
  type IllegalReason,
  type PlayerId,
} from '@foilengine/types';
import { draftOf, stateOf } from './draft.ts';
import { IllegalActionError } from './errors.ts';
import {
  applyMulligan,
  checkMulligan,
  mulliganActions,
  mulliganDecision,
} from './setup/mulligan.ts';
import { endTurn } from './turn/turn.ts';

export type Outcome =
  | { readonly kind: 'ongoing' }
  | { readonly kind: 'won'; readonly winner: PlayerId };

/** What the engine waits for now, if anything. */
export function pendingDecision(state: GameState): Decision | null {
  const stage = state.stage;
  switch (stage.kind) {
    case 'mulligan':
      return mulliganDecision(state);
    case 'turn':
      // 312.2.a: the Turn Player has Priority in their Main Phase, in a Neutral Open State.
      return stage.phase === 'main'
        ? { kind: 'Priority', player: stage.turnPlayer, rule: '312.2.a' }
        : null;
    case 'ended':
      return null;
    default:
      return assertNever(stage);
  }
}

export function outcome(state: GameState): Outcome {
  return state.winner === null ? { kind: 'ongoing' } : { kind: 'won', winner: state.winner };
}

export function isLegal(
  state: GameState,
  action: Action,
): { ok: true } | { ok: false; reason: IllegalReason } {
  const decision = pendingDecision(state);
  if (decision === null) {
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
    case 'EndTurn': {
      if (decision.kind !== 'Priority') {
        return {
          ok: false,
          reason: {
            code: 'wrong-action',
            message: `Waiting for a ${decision.kind} decision`,
            rule: null,
          },
        };
      }
      if (action.player !== decision.player) {
        return {
          ok: false,
          reason: {
            code: 'not-your-decision',
            message: `${decision.player} has Priority`,
            rule: '312.1',
          },
        };
      }
      return { ok: true };
    }
    default:
      return assertNever(action);
  }
}

/** Every legal action for `player` right now. */
export function legalActions(state: GameState, player: PlayerId): Action[] {
  const decision = pendingDecision(state);
  if (decision === null || decision.player !== player) return [];
  switch (decision.kind) {
    case 'Mulligan':
      return mulliganActions(state);
    case 'Priority':
      // Discretionary Actions arrive with M2 (play a unit, move); ending the turn is always possible (316.9).
      return [{ type: 'EndTurn', player }];
    default:
      return assertNever(decision);
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
    case 'EndTurn': {
      const draft = draftOf(state);
      endTurn(draft);
      return { state: stateOf(state, draft), events: draft.events };
    }
    default:
      return assertNever(action);
  }
}
