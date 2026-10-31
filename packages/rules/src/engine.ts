// The public engine API (docs/03-rules-engine.md).

import {
  type Action,
  assertNever,
  type Decision,
  type GameEvent,
  type GameState,
  type IllegalReason,
  type ObjectId,
  type PlayCard,
  type PlayerId,
  type PlayLocation,
  type TargetSpec,
} from '@foilengine/types';
import { passPriority } from './chain/chain.ts';
import {
  assignDamage,
  assignmentOptions,
  checkAssignment,
  damageDecision,
} from './combat/combat.ts';
import { checkConcede, concede } from './concede.ts';
import { draftOf, stateOf } from './draft.ts';
import { validTargets } from './effects/targets.ts';
import { IllegalActionError } from './errors.ts';
import { applyStandardMove, checkStandardMove, movableUnits } from './movement/standard-move.ts';
import { applyPlayCard, checkPlayCard, timingProblem } from './play/play-card.ts';
import { autoPayment } from './resources/payment.ts';
import {
  applyMulligan,
  checkMulligan,
  mulliganActions,
  mulliganDecision,
} from './setup/mulligan.ts';
import { passFocus } from './showdown/showdown.ts';
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
      if (stage.phase !== 'main') return null;
      // 312.2.c, 312.2.d: on a Chain, the player it gave Priority to acts, Showdown or not.
      if (state.chain !== null) {
        return {
          kind: 'Priority',
          player: state.chain.priority,
          rule: state.chain.passes === 0 ? '312.2.c' : '312.2.d',
        };
      }
      // 467.2.c: in the Combat Damage Step, the Attacker then the Defender assign damage.
      if (state.combat?.step === 'damage') return damageDecision(state);
      // 313.2, 347: in a Showdown, the player with Focus acts, and has Priority.
      if (state.showdown !== null) {
        return {
          kind: 'Focus',
          player: state.showdown.focus,
          battlefield: state.showdown.battlefield,
          rule: '347',
        };
      }
      // 312.2.a: the Turn Player has Priority in their Main Phase, in a Neutral Open State.
      return { kind: 'Priority', player: stage.turnPlayer, rule: '312.2.a' };
    case 'ended':
      return null;
    default:
      return assertNever(stage);
  }
}

export function outcome(state: GameState): Outcome {
  return state.winner === null ? { kind: 'ongoing' } : { kind: 'won', winner: state.winner };
}

/** The action must answer the pending decision, and be made by the player it waits for. */
function checkDecision(decision: Decision, kind: Decision['kind'], player: PlayerId): Legality {
  if (decision.kind !== kind) {
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
    const rule = kind === 'Focus' ? '313.4' : '312.1';
    return {
      ok: false,
      reason: { code: 'not-your-decision', message: `${decision.player} must act`, rule },
    };
  }
  return { ok: true };
}

const noDecision = (): Legality => ({
  ok: false,
  reason: { code: 'no-pending-decision', message: 'Nothing can be done right now', rule: null },
});

/**
 * A card is played by the player with Priority: in their Main Phase (310.1.a), on a Chain
 * (338.1.a), or in a Showdown, where the player with Focus has it (313.2, 347.1).
 */
function checkPlayDecision(decision: Decision, player: PlayerId): Legality {
  return decision.kind === 'Focus'
    ? checkDecision(decision, 'Focus', player)
    : checkDecision(decision, 'Priority', player);
}

/** On a Chain, the turn is Closed (309.1): the turn cannot end, units cannot move. */
function closedProblem(state: GameState, rule: IllegalReason['rule'], message: string): Legality {
  return state.chain === null
    ? { ok: true }
    : { ok: false, reason: { code: 'wrong-timing', message, rule } };
}

const both = (first: Legality, second: () => Legality): Legality => (first.ok ? second() : first);

const fromReason = (reason: IllegalReason | null): Legality =>
  reason === null ? { ok: true } : { ok: false, reason };

export function isLegal(state: GameState, action: Action): Legality {
  // 650: conceding needs no decision: a player may concede at any time.
  if (action.type === 'Concede') return fromReason(checkConcede(state, action));
  const decision = pendingDecision(state);
  if (decision === null) return noDecision();
  switch (action.type) {
    case 'Mulligan':
      return fromReason(checkMulligan(state, action));
    case 'EndTurn':
      // 305: the turn moves on only when the Chain is empty.
      return both(checkDecision(decision, 'Priority', action.player), () =>
        closedProblem(state, '305', 'Resolve the Chain first: pass Priority or play a Reaction'),
      );
    case 'PlayCard':
      return both(checkPlayDecision(decision, action.player), () =>
        fromReason(checkPlayCard(state, action)),
      );
    case 'StandardMove':
      // 144.1: during the Main Phase (144.1.a), not in a Closed State (144.1.b), nor during a
      // Showdown or Combat (144.1.c): the Priority decision of a Neutral Open Main Phase.
      return both(checkDecision(decision, 'Priority', action.player), () =>
        both(closedProblem(state, '144.1.b', 'No Standard Move during a Closed State'), () =>
          fromReason(checkStandardMove(state, action)),
        ),
      );
    case 'PassFocus':
      return checkDecision(decision, 'Focus', action.player);
    case 'PassPriority':
      return both(checkDecision(decision, 'Priority', action.player), () =>
        state.chain === null
          ? {
              ok: false,
              reason: { code: 'wrong-action', message: 'There is no Chain', rule: '338.1' },
            }
          : { ok: true },
      );
    case 'AssignCombatDamage': {
      const turn = checkDecision(decision, 'AssignDamage', action.player);
      return turn.ok ? fromReason(checkAssignment(state, action)) : turn;
    }
    default:
      return assertNever(action);
  }
}

/**
 * Every legal action for `player` right now. Conceding is always among them while the game goes
 * on (650), last, even for a player who has no decision to make.
 */
export function legalActions(state: GameState, player: PlayerId): Action[] {
  if (!state.players.some((p) => p.id === player) || state.stage.kind === 'ended') return [];
  const concede: Action = { type: 'Concede', player };
  const decision = pendingDecision(state);
  if (decision === null || decision.player !== player) return [concede];
  return [...decisionActions(state, decision, player), concede];
}

function decisionActions(state: GameState, decision: Decision, player: PlayerId): Action[] {
  switch (decision.kind) {
    case 'Mulligan':
      return mulliganActions(state);
    case 'Priority':
      // 338.1: on a Chain, play a Reaction or pass.
      if (state.chain !== null) {
        return [...playableCards(state, player), { type: 'PassPriority', player }];
      }
      return [
        ...playableCards(state, player),
        ...standardMoves(state, player),
        { type: 'EndTurn', player },
      ];
    case 'Focus':
      // 347: play a legally timed card (347.1), or pass (347.2).
      return [...playableCards(state, player), { type: 'PassFocus', player }];
    case 'AssignDamage':
      return assignmentOptions(state);
    default:
      return assertNever(decision);
  }
}

/**
 * Applies a legal action and returns the new state with the events it produced.
 * The given state is never modified. An illegal action throws `IllegalActionError` and changes nothing.
 */
export function apply(state: GameState, action: Action): { state: GameState; events: GameEvent[] } {
  // Playing a card and moving are checked while they are applied: checking them first with
  // isLegal would play them twice. Only the decision is checked beforehand.
  if (action.type === 'PlayCard' || action.type === 'StandardMove') {
    const decision = pendingDecision(state);
    const turn =
      decision === null
        ? noDecision()
        : action.type === 'PlayCard'
          ? checkPlayDecision(decision, action.player)
          : both(checkDecision(decision, 'Priority', action.player), () =>
              closedProblem(state, '144.1.b', 'No Standard Move during a Closed State'),
            );
    if (!turn.ok) throw new IllegalActionError(turn.reason);
    return action.type === 'PlayCard'
      ? applyPlayCard(state, action)
      : applyStandardMove(state, action);
  }
  const legality = isLegal(state, action);
  if (!legality.ok) throw new IllegalActionError(legality.reason);
  switch (action.type) {
    case 'Mulligan':
      return applyMulligan(state, action);
    case 'EndTurn':
    case 'PassFocus':
    case 'PassPriority':
    case 'AssignCombatDamage':
    case 'Concede': {
      const draft = draftOf(state);
      if (action.type === 'EndTurn') endTurn(draft);
      else if (action.type === 'PassFocus') passFocus(draft);
      else if (action.type === 'PassPriority') passPriority(draft);
      else if (action.type === 'Concede') concede(draft, action);
      else assignDamage(draft, action);
      return { state: stateOf(state, draft), events: draft.events };
    }
    default:
      return assertNever(action);
  }
}

/**
 * One PlayCard per card the player can afford, timed for the current state, and each valid
 * location (units) or choice of targets (spells), paid with `autoPayment`. Other payments of the
 * same card are legal too (`isLegal` accepts any valid payment); listing them all would explode,
 * so legalActions offers one per card and choice.
 */
function playableCards(state: GameState, player: PlayerId): Action[] {
  const zones = state.players.find((p) => p.id === player)?.zones;
  if (zones === undefined) return [];
  const locations: PlayLocation[] = [
    { kind: 'base' },
    ...state.battlefields
      .filter((b) => b.controller === player)
      .map((b): PlayLocation => ({ kind: 'battlefield', battlefield: b.object })),
  ];
  // A draft to look for targets, built only if a card has some.
  let draft: ReturnType<typeof draftOf> | null = null;
  const lookup = () => {
    draft ??= draftOf(state);
    return draft;
  };
  const actions: Action[] = [];
  for (const card of [...zones.hand, ...zones.championZone]) {
    const object = state.objects[card];
    const definition = object === undefined ? undefined : state.cards[object.card];
    if (definition?.cost === undefined) continue;
    if (definition.category !== 'unit' && definition.category !== 'spell') continue;
    if (timingProblem(state, definition) !== null) continue;
    const payment = autoPayment(state, player, definition.cost);
    if (payment === null) continue;
    const candidates: PlayCard[] =
      definition.category === 'unit'
        ? locations.map((location) => ({ type: 'PlayCard', player, card, location, payment }))
        : targetChoices(lookup(), definition.targets ?? [], player).map((targets) => ({
            type: 'PlayCard',
            player,
            card,
            payment,
            ...(targets.length === 0 ? {} : { targets }),
          }));
    for (const action of candidates) {
      if (checkPlayCard(state, action) === null) actions.push(action);
    }
  }
  return actions;
}

/** Every combination of valid targets, one per target of the card (355.5). */
function targetChoices(
  draft: ReturnType<typeof draftOf>,
  specs: readonly TargetSpec[],
  player: PlayerId,
): ObjectId[][] {
  let choices: ObjectId[][] = [[]];
  for (const spec of specs) {
    const valid = validTargets(draft, spec, player);
    choices = choices.flatMap((chosen) => valid.map((target) => [...chosen, target]));
  }
  return choices;
}

/**
 * Standard Moves offered by legalActions: each ready unit alone, and all of them together, to each
 * destination they can reach. Any other legal group of units is accepted by `isLegal` too.
 */
function standardMoves(state: GameState, player: PlayerId): Action[] {
  const { base, battlefields } = movableUnits(state, player);
  const groups = (units: ObjectId[]) =>
    units.length > 1 ? [...units.map((u) => [u]), units] : units.map((u) => [u]);
  const candidates: Action[] = [
    ...state.battlefields.flatMap((b) =>
      groups(base).map(
        (units): Action => ({
          type: 'StandardMove',
          player,
          units,
          destination: { kind: 'battlefield', battlefield: b.object },
        }),
      ),
    ),
    ...groups(battlefields).map(
      (units): Action => ({ type: 'StandardMove', player, units, destination: { kind: 'base' } }),
    ),
  ];
  return candidates.filter(
    (action) => action.type === 'StandardMove' && checkStandardMove(state, action) === null,
  );
}
