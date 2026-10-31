// The public engine API (docs/03-rules-engine.md).

import {
  type Action,
  type ActivateAbility,
  assertNever,
  type Decision,
  type GameEvent,
  type GameState,
  type IllegalReason,
  type ObjectId,
  type OrderTriggers,
  type PlayCard,
  type PlayerId,
  type PlayLocation,
  type TargetSpec,
} from '@foilengine/types';
import { activate, checkActivate } from './abilities/activate.ts';
import {
  costOf,
  finalizeChosen,
  pendingChoice,
  placeInOrder,
  playerToOrder,
} from './abilities/triggers.ts';
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
import { settle } from './tasks/tasks.ts';
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
    case 'turn': {
      // 383.3.d: a player orders the triggered abilities they control that triggered together.
      const orderer = playerToOrder(state);
      if (orderer !== null) {
        return {
          kind: 'OrderTriggers',
          player: orderer,
          abilities: state.triggered.filter((t) => t.controller === orderer),
          rule: '383.3.d',
        };
      }
      // 337.1: the controller of the oldest Pending triggered ability makes its choices.
      const choice = pendingChoice(state);
      if (choice !== null && choice.item.ability !== null) {
        return {
          kind: 'FinalizeAbility',
          player: choice.item.controller,
          item: choice.item.object,
          ability: choice.item.ability,
          optional: choice.ability.optional === true,
          targets: choice.ability.targets ?? [],
          cost: costOf(choice.ability),
          rule: '337.1',
        };
      }
      // 312.2.c, 312.2.d: on a Chain, the player it gave Priority to acts, in any phase.
      if (state.chain !== null) {
        return {
          kind: 'Priority',
          player: state.chain.priority,
          rule: state.chain.passes === 0 ? '312.2.c' : '312.2.d',
        };
      }
      if (stage.phase !== 'main') return null;
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
    }
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
    case 'ActivateAbility':
      return both(checkPlayDecision(decision, action.player), () =>
        fromReason(checkActivate(state, action)),
      );
    case 'OrderTriggers':
      return both(checkDecision(decision, 'OrderTriggers', action.player), () =>
        fromReason(checkOrder(state, action)),
      );
    case 'FinalizeAbility':
      return both(checkDecision(decision, 'FinalizeAbility', action.player), () =>
        fromReason(finalizeChosen(draftOf(state), action)),
      );
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
        return [
          ...playableCards(state, player),
          ...activatableAbilities(state, player),
          { type: 'PassPriority', player },
        ];
      }
      return [
        ...playableCards(state, player),
        ...activatableAbilities(state, player),
        ...standardMoves(state, player),
        { type: 'EndTurn', player },
      ];
    case 'Focus':
      // 347: play a legally timed card or activated ability (347.1), or pass (347.2).
      return [
        ...playableCards(state, player),
        ...activatableAbilities(state, player),
        { type: 'PassFocus', player },
      ];
    case 'FinalizeAbility': {
      // 383.3.a: decline a "you may" ability; or choose valid targets (355.5, 355.9).
      const decline: Action[] = decision.optional
        ? [{ type: 'FinalizeAbility', player, perform: false }]
        : [];
      // 383.3.b: performing it means paying its cost, if it has one.
      const payment = decision.cost === null ? [] : autoPayment(state, player, decision.cost);
      if (payment === null) return decline;
      return [
        ...targetChoices(draftOf(state), decision.targets, player).map(
          (targets): Action => ({
            type: 'FinalizeAbility',
            player,
            perform: true,
            ...(targets.length === 0 ? {} : { targets }),
            ...(payment.length === 0 ? {} : { payment }),
          }),
        ),
        ...decline,
      ];
    }
    case 'OrderTriggers':
      return orderings(decision.abilities.length).map((order) => ({
        type: 'OrderTriggers',
        player,
        order,
      }));
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
  if (action.type === 'ActivateAbility') {
    const decision = pendingDecision(state);
    const turn = decision === null ? noDecision() : checkPlayDecision(decision, action.player);
    if (!turn.ok) throw new IllegalActionError(turn.reason);
    const draft = draftOf(state);
    const reason = activate(draft, state, action);
    if (reason !== null) throw new IllegalActionError(reason);
    settle(draft);
    return { state: stateOf(state, draft), events: draft.events };
  }
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
    case 'OrderTriggers':
    case 'FinalizeAbility':
    case 'AssignCombatDamage':
    case 'Concede': {
      const draft = draftOf(state);
      if (action.type === 'FinalizeAbility') {
        const reason = finalizeChosen(draft, action);
        if (reason !== null) throw new IllegalActionError(reason);
      } else if (action.type === 'EndTurn') endTurn(draft);
      else if (action.type === 'PassFocus') passFocus(draft);
      else if (action.type === 'PassPriority') passPriority(draft);
      else if (action.type === 'OrderTriggers') placeInOrder(draft, action.player, action.order);
      else if (action.type === 'Concede') concede(draft, action);
      else assignDamage(draft, action);
      settle(draft);
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
    // 805: a unit with Accelerate may also be played paying [1][C] more, to enter ready.
    const domains = definition.domains;
    if (
      definition.category === 'unit' &&
      (definition.keywords ?? []).includes('accelerate') &&
      domains.length <= 1
    ) {
      const total = {
        energy: definition.cost.energy + 1,
        power: [...definition.cost.power, domains[0] ?? ('any' as const)],
      };
      const accelerated = autoPayment(state, player, total);
      if (accelerated !== null) {
        for (const location of locations) {
          candidates.push({
            type: 'PlayCard',
            player,
            card,
            location,
            accelerate: true,
            payment: accelerated,
          });
        }
      }
    }
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

/** 383.3.d: the order must list each of the player's waiting triggered abilities once. */
function checkOrder(state: GameState, action: OrderTriggers): IllegalReason | null {
  const count = state.triggered.filter((t) => t.controller === action.player).length;
  const sorted = [...action.order].sort((a, b) => a - b);
  return sorted.length === count && sorted.every((index, i) => index === i)
    ? null
    : {
        code: 'invalid-order',
        message: `Order all ${count} triggered abilities, each once`,
        rule: '383.3.d',
      };
}

/** Every order of `count` items, for legalActions (capped: the decision accepts any order). */
function orderings(count: number, cap = 120): number[][] {
  const result: number[][] = [];
  const build = (prefix: number[], rest: number[]) => {
    if (result.length >= cap) return;
    if (rest.length === 0) {
      result.push(prefix);
      return;
    }
    for (const [i, next] of rest.entries()) {
      build([...prefix, next], [...rest.slice(0, i), ...rest.slice(i + 1)]);
    }
  };
  build(
    [],
    Array.from({ length: count }, (_, i) => i),
  );
  return result;
}

/**
 * One ActivateAbility per activated ability of the permanents the player controls, timed for the
 * current state, and each choice of targets, paid with `autoPayment`.
 */
function activatableAbilities(state: GameState, player: PlayerId): Action[] {
  const owned = state.players.find((p) => p.id === player)?.zones.base ?? [];
  const permanents = [
    ...owned,
    ...state.battlefields.flatMap((b) => b.units.filter((u) => state.objects[u]?.owner === player)),
  ];
  const actions: Action[] = [];
  let draft: ReturnType<typeof draftOf> | null = null;
  const lookup = () => {
    draft ??= draftOf(state);
    return draft;
  };
  for (const source of permanents) {
    const object = state.objects[source];
    const abilities = object === undefined ? [] : (state.cards[object.card]?.abilities ?? []);
    for (const [index, ability] of abilities.entries()) {
      if (ability.kind !== 'activated') continue;
      const payment = autoPayment(state, player, {
        energy: ability.cost.energy ?? 0,
        power: ability.cost.power ?? [],
      });
      if (payment === null) continue;
      for (const targets of targetChoices(lookup(), ability.targets ?? [], player)) {
        const action: ActivateAbility = {
          type: 'ActivateAbility',
          player,
          source,
          ability: index,
          payment,
          ...(targets.length === 0 ? {} : { targets }),
        };
        if (checkActivate(state, action) === null) actions.push(action);
      }
    }
  }
  return actions;
}
