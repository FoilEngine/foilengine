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
import { applyPlayCard, checkPlayCard } from './play/play-card.ts';
import { autoPayment } from './resources/payment.ts';
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

type Legality = { ok: true } | { ok: false; reason: IllegalReason };

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

/** Discretionary Actions need Priority (312.1): the decision must be this player's Priority. */
function checkPriority(decision: Decision, player: PlayerId): Legality {
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
  if (player !== decision.player) {
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

export function isLegal(state: GameState, action: Action): Legality {
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
    case 'EndTurn':
      return checkPriority(decision, action.player);
    case 'PlayCard': {
      const priority = checkPriority(decision, action.player);
      if (!priority.ok) return priority;
      const reason = checkPlayCard(state, action);
      return reason === null ? { ok: true } : { ok: false, reason };
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
      return [...playableUnits(state, player), { type: 'EndTurn', player }];
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
    case 'PlayCard':
      return applyPlayCard(state, action);
    case 'EndTurn': {
      const draft = draftOf(state);
      endTurn(draft);
      return { state: stateOf(state, draft), events: draft.events };
    }
    default:
      return assertNever(action);
  }
}

/**
 * One PlayCard per unit the player can afford, paid with `autoPayment` and played to their base.
 * Other payments of the same card are legal too (`isLegal` accepts any valid payment);
 * listing them all would explode, so legalActions offers one per card.
 */
function playableUnits(state: GameState, player: PlayerId): Action[] {
  const zones = state.players.find((p) => p.id === player)?.zones;
  if (zones === undefined) return [];
  const actions: Action[] = [];
  for (const card of [...zones.hand, ...zones.championZone]) {
    const object = state.objects[card];
    const definition = object === undefined ? undefined : state.cards[object.card];
    if (definition?.category !== 'unit' || definition.cost === undefined) continue;
    const payment = autoPayment(state, player, definition.cost);
    if (payment === null) continue;
    const action: Action = { type: 'PlayCard', player, card, location: { kind: 'base' }, payment };
    if (checkPlayCard(state, action) === null) actions.push(action);
  }
  return actions;
}
