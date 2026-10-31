// Triggered abilities (382–386): when their Condition is met, they wait to be put on the Chain
// (383.3), which happens once the current task is complete (334.1, 334.2).

import type {
  Ability,
  CardDefinition,
  ChainItem,
  Cost,
  FinalizeAbility,
  GameState,
  IllegalReason,
  ObjectId,
  PlayerId,
  Trigger,
} from '@foilengine/types';
import { addAbility, finalize, givePriorityToNewest, removeFromChain } from '../chain/chain.ts';
import { controllerOf, type Draft, emit, findObject } from '../draft.ts';
import { deflectCost, withDeflect } from '../effects/deflect.ts';
import { isValidTarget, validTargets } from '../effects/targets.ts';
import { EngineInvariantError } from '../errors.ts';
import { autoPaymentOnDraft, payCost, useRunes } from '../resources/payment.ts';

/**
 * The Condition `kind` is met for these permanents: each of their triggered abilities with that
 * Condition triggers (383.2, 384.2: those of permanents, on the board).
 */
export function trigger(draft: Draft, kind: Trigger['kind'], sources: readonly ObjectId[]): void {
  for (const source of sources) {
    const object = findObject(draft, source);
    if (object === undefined) continue;
    const abilities = (draft.cards[object.card] as CardDefinition | undefined)?.abilities ?? [];
    for (const [index, ability] of abilities.entries()) {
      if (ability.kind !== 'triggered' || ability.trigger.kind !== kind) continue;
      draft.triggered = [
        ...draft.triggered,
        { source, card: object.card, index, controller: controllerOf(draft, source) },
      ];
    }
  }
}

/**
 * The order in which players put their triggered abilities on the Chain: turn order, starting
 * with the Turn Player (303.2.a, 383.3.d.1); on the Combat Chain, the Attacker first, then the
 * other players in turn order, then the Defender (466.2.d.1).
 */
function placingOrder(draft: Pick<Draft, 'stage' | 'turnOrder' | 'combat'>): PlayerId[] {
  const stage = draft.stage;
  const first = stage.kind === 'turn' ? draft.turnOrder.indexOf(stage.turnPlayer) : 0;
  const order = draft.turnOrder.map(
    (_, i) => draft.turnOrder[(first + i) % draft.turnOrder.length] as PlayerId,
  );
  const combat = draft.combat;
  if (combat === null || combat.step !== 'showdown') return order;
  const others = order.filter((p) => p !== combat.attacker && p !== combat.defender);
  return [combat.attacker, ...others, combat.defender];
}

/** The player who must order several simultaneous triggered abilities now (383.3.d), if any. */
export function playerToOrder(
  draft: Pick<Draft, 'triggered' | 'stage' | 'turnOrder' | 'combat'>,
): PlayerId | null {
  for (const player of placingOrder(draft)) {
    const mine = draft.triggered.filter((t) => t.controller === player);
    if (mine.length > 1) return player;
    if (mine.length === 1) return null;
  }
  return null;
}

/**
 * 383.3.d.1, 466.2.d.1: each player in turn puts their triggered abilities on the Chain, Pending.
 * A player with several chooses their order (383.3.d): this stops at them and returns false.
 */
export function placeTriggered(draft: Draft): boolean {
  for (const player of placingOrder(draft)) {
    const mine = draft.triggered.filter((t) => t.controller === player);
    if (mine.length > 1) return false;
    for (const ability of mine) putOnChain(draft, ability);
  }
  return true;
}

/** Puts the player's waiting triggered abilities on the Chain in the chosen order (383.3.d). */
export function placeInOrder(draft: Draft, player: PlayerId, order: readonly number[]): void {
  const mine = draft.triggered.filter((t) => t.controller === player);
  for (const index of order) {
    const ability = mine[index];
    if (ability === undefined) throw new EngineInvariantError(`No triggered ability ${index}`);
    putOnChain(draft, ability);
  }
}

function putOnChain(draft: Draft, ability: Draft['triggered'][number]): void {
  draft.triggered = draft.triggered.filter((t) => t !== ability);
  addAbility(
    draft,
    ability.controller,
    {
      source: ability.source,
      card: ability.card,
      index: ability.index,
      triggered: true,
    },
    [],
  );
}

/** The triggered ability of a Pending item, with the choices it needs at finalization. */
function triggeredAbilityOf(
  state: Pick<GameState, 'cards'>,
  item: ChainItem,
): Extract<Ability, { kind: 'triggered' }> | null {
  if (item.ability === null || !item.ability.triggered) return null;
  const ability = (state.cards[item.ability.card] as CardDefinition).abilities?.[
    item.ability.index
  ];
  return ability?.kind === 'triggered' ? ability : null;
}

const needsChoices = (ability: Extract<Ability, { kind: 'triggered' }> | null) =>
  ability !== null &&
  (ability.optional === true || (ability.targets ?? []).length > 0 || ability.cost !== undefined);

const NO_COST: Cost = { energy: 0, power: [] };

/** For each target of the ability, a valid one with the least Deflect for `controller`. */
function cheapestTargets(
  draft: Draft,
  ability: Extract<Ability, { kind: 'triggered' }>,
  controller: PlayerId,
): ObjectId[] {
  return (ability.targets ?? []).flatMap((spec) => {
    let best: { target: ObjectId; extra: number } | null = null;
    for (const target of validTargets(draft, spec, controller)) {
      const extra = deflectCost(draft, controller, [target]).length;
      if (best === null || extra < best.extra) best = { target, extra };
      if (extra === 0) break;
    }
    return best === null ? [] : [best.target];
  });
}

/** The cost of a triggered ability, as a card cost (383.3.b). */
export const costOf = (ability: Extract<Ability, { kind: 'triggered' }>): Cost | null =>
  ability.cost === undefined
    ? null
    : { energy: ability.cost.energy ?? 0, power: ability.cost.power ?? [] };

/**
 * The oldest Pending item, if its controller must make choices to finalize it (337.1): a
 * triggered ability that says "you may" first (383.3.a) or chooses targets (355.5).
 */
export function pendingChoice(
  state: Pick<GameState, 'cards' | 'chain'>,
): { item: ChainItem; ability: Extract<Ability, { kind: 'triggered' }> } | null {
  const item = state.chain?.items.find((i) => i.status === 'pending');
  if (item === undefined) return null;
  const ability = triggeredAbilityOf(state, item);
  return ability !== null && needsChoices(ability) ? { item, ability } : null;
}

/** A Pending item leaves the Chain without being finalized (383.3.a.2, 358.5). */
function removePending(
  draft: Draft,
  item: ChainItem,
  rule: '383.3.a.2' | '355.8' | '383.3.b.1',
): void {
  removeFromChain(draft, item.object);
  emit(draft, {
    type: 'ChainItemRemoved',
    rule,
    visibility: { kind: 'public' },
    player: item.controller,
    object: item.object,
  });
}

/**
 * 337.1: Pending items are finalized in the order they were added. One whose controller must make
 * choices stops this until they have made them (a decision); one that has no valid choice for a
 * target cannot be put on the Chain (355.8): its play is cancelled (358.5). Once none is Pending,
 * the controller of the newest item gains Priority (337.4).
 */
export function finalizePending(draft: Draft): void {
  for (const item of draft.chain?.items ?? []) {
    if (item.status !== 'pending') continue;
    const ability = triggeredAbilityOf(draft, item);
    if (!needsChoices(ability) || ability === null) {
      finalize(draft, item.object);
      continue;
    }
    // Choices that cannot be made: no valid target (355.8, 358.5), or a cost that must be paid
    // but cannot be (383.3.b.1). A "you may" ability can still be declined.
    if (
      (ability.targets ?? []).some(
        (spec) => validTargets(draft, spec, item.controller).length === 0,
      )
    ) {
      removePending(draft, item, '355.8');
      continue;
    }
    // Its cost includes the Deflect of its targets (809.1.d, 401): payable with the cheapest ones?
    const cost = withDeflect(
      draft,
      item.controller,
      costOf(ability) ?? NO_COST,
      cheapestTargets(draft, ability, item.controller),
    );
    if (
      (cost.energy > 0 || cost.power.length > 0) &&
      ability.optional !== true &&
      autoPaymentOnDraft(draft, item.controller, cost) === null
    ) {
      removePending(draft, item, '383.3.b.1');
      continue;
    }
    return;
  }
  givePriorityToNewest(draft);
}

/**
 * The controller of the oldest Pending triggered ability makes its choices (337.1): declining a
 * "you may" ability removes it (383.3.a.2); otherwise its targets are chosen (355.5) and must be
 * valid (355.9), and it is finalized. Returns why the choices are illegal, if they are.
 */
export function finalizeChosen(draft: Draft, action: FinalizeAbility): IllegalReason | null {
  const choice = pendingChoice(draft);
  if (choice === null) {
    return { code: 'wrong-action', message: 'No ability waits for choices', rule: '337.1' };
  }
  const { item, ability } = choice;
  if (!action.perform) {
    if (ability.optional !== true) {
      return { code: 'wrong-action', message: 'This ability is not optional', rule: '383.3.a' };
    }
    removePending(draft, item, '383.3.a.2');
    return null;
  }
  const specs = ability.targets ?? [];
  const targets = action.targets ?? [];
  if (targets.length !== specs.length) {
    return {
      code: 'invalid-target',
      message: `The ability needs ${specs.length} target(s), ${targets.length} given`,
      rule: '355.8',
    };
  }
  for (const [index, spec] of specs.entries()) {
    if (!isValidTarget(draft, spec, targets[index] as ObjectId, item.controller)) {
      return {
        code: 'invalid-target',
        message: `${targets[index]} is not a valid target`,
        rule: '355.9',
      };
    }
  }
  // 383.3.b, 383.3.b.1: its cost is paid to finalize it, runes adding resources first (357.1.a),
  // with the Deflect of its targets (809.1.d, 356.2.a.2, 401).
  const cost = withDeflect(draft, item.controller, costOf(ability) ?? NO_COST, targets);
  if (cost.energy > 0 || cost.power.length > 0) {
    const runes = useRunes(draft, draft, item.controller, action.payment ?? []);
    if (runes !== null) return runes;
    const paid = payCost(draft, item.controller, cost);
    if (paid !== null) return paid;
  }
  const chain = draft.chain;
  if (chain === null) throw new EngineInvariantError('No Chain');
  draft.chain = {
    ...chain,
    items: chain.items.map((i) => (i.object === item.object ? { ...i, targets } : i)),
  };
  finalize(draft, item.object);
  return null;
}
