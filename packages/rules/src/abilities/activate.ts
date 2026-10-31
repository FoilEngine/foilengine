// Activated abilities (376–381): "[cost]: [effect]" (377.1). Activating one follows the steps of
// playing a card (399–407): it goes on the Chain (402, 377.3), makes its choices (403), pays its
// cost (404, 405), checks legality (406), and is finalized (407). It then waits on the Chain.

import type {
  ActivateAbility,
  CardDefinition,
  GameState,
  IllegalReason,
  ObjectId,
} from '@foilengine/types';
import { addAbility, finalize, givePriorityToNewest } from '../chain/chain.ts';
import { cleanup } from '../cleanup/cleanup.ts';
import {
  controllerOf,
  type Draft,
  draftOf,
  emit,
  findObject,
  locationOf,
  updateObject,
} from '../draft.ts';
import { isValidTarget } from '../effects/targets.ts';
import { payCost, useRunes } from '../resources/payment.ts';

const illegal = (
  code: IllegalReason['code'],
  message: string,
  rule: IllegalReason['rule'],
): IllegalReason => ({ code, message, rule });

/**
 * 381, 806.1.c.2, 813.1.c.2: when the ability may be activated. On its controller's turn in an
 * Open State (381.1, the decision checks whose turn it is); in a Showdown State only with Action
 * or Reaction (308.1.a); in a Closed State only with Reaction (309.1.a).
 */
function timingProblem(state: GameState, keywords: readonly string[]): IllegalReason | null {
  if (state.chain !== null && !keywords.includes('reaction')) {
    return illegal('wrong-timing', 'Only abilities with Reaction on a Chain', '309.1.a');
  }
  if (state.showdown !== null && !keywords.includes('action') && !keywords.includes('reaction')) {
    return illegal(
      'wrong-timing',
      'Only abilities with Action or Reaction in a Showdown',
      '308.1.a',
    );
  }
  return null;
}

/**
 * Activates the ability on the draft. Returns why it is illegal, if it is; the draft is then to
 * be dropped. With `checkOnly`, stops once legality is decided (406).
 */
export function activate(
  draft: Draft,
  state: GameState,
  action: ActivateAbility,
  checkOnly = false,
): IllegalReason | null {
  // 378, 380: the controller of a permanent on the board activates its abilities.
  const source = findObject(draft, action.source);
  if (source === undefined || locationOf(draft, action.source) === null) {
    return illegal('invalid-source', `${action.source} is not a permanent on the board`, '380');
  }
  if (controllerOf(draft, action.source) !== action.player) {
    return illegal('invalid-source', `${action.player} does not control ${action.source}`, '378');
  }
  const definition = state.cards[source.card] as CardDefinition;
  const ability = definition.abilities?.[action.ability];
  if (ability?.kind !== 'activated') {
    return illegal(
      'invalid-source',
      `${definition.name} has no activated ability ${action.ability}`,
      '377',
    );
  }

  // 402, 377.3.a: the ability goes on the Chain, Pending.
  const targets = action.targets ?? [];
  const item = addAbility(
    draft,
    action.player,
    { source: action.source, card: source.card, index: action.ability, triggered: false },
    targets,
  );

  // 403: choices: one target per target of the ability (355.5, 355.8).
  const specs = ability.targets ?? [];
  if (targets.length !== specs.length) {
    return illegal(
      'invalid-target',
      `The ability needs ${specs.length} target(s), ${targets.length} given`,
      '355.8',
    );
  }

  // 404, 405: pay the cost: exhaust the source for [E] (415), then Energy and Power, with runes
  // adding resources first (357.1.a).
  if (ability.cost.exhaustSelf === true) {
    if (source.exhausted) {
      return illegal('cannot-pay', `${definition.name} is already exhausted`, '415.4');
    }
    updateObject(draft, action.source, { exhausted: true });
    emit(draft, {
      type: 'ObjectExhausted',
      rule: '405',
      visibility: { kind: 'public' },
      player: action.player,
      object: action.source,
    });
  }
  const runes = useRunes(draft, state, action.player, action.payment);
  if (runes !== null) return runes;
  const paid = payCost(draft, action.player, {
    energy: ability.cost.energy ?? 0,
    power: ability.cost.power ?? [],
  });
  if (paid !== null) return paid;

  // 406: check legality: targets (358.1, 355.9), timing (358.4, 381).
  for (const [index, spec] of specs.entries()) {
    const target = targets[index] as ObjectId;
    if (!isValidTarget(draft, spec, target, action.player)) {
      return illegal('invalid-target', `${target} is not a valid target`, '355.9');
    }
  }
  const timing = timingProblem(state, ability.keywords ?? []);
  if (timing !== null) return timing;
  if (checkOnly) return null;

  // 407: finalized, it waits on the Chain; its controller gains Priority (337.4).
  finalize(draft, item);
  givePriorityToNewest(draft);
  cleanup(draft); // 319.4
  return null;
}

export function checkActivate(state: GameState, action: ActivateAbility): IllegalReason | null {
  return activate(draftOf(state), state, action, true);
}
