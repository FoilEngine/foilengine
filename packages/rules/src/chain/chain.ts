// The Chain (327–340) and the FEPR process: Finalize, Execute, Pass, Resolve (334–340).
// Cards are put on the Chain by the play process (play/play-card.ts). There is no outstanding
// task to handle between steps before triggered abilities arrive: each action runs the steps it
// starts, then the engine waits for the player with Priority (338).

import type { ChainAbility, ChainItem, ObjectId, PlayerId } from '@foilengine/types';
import { cleanup } from '../cleanup/cleanup.ts';
import { type Draft, emit, newId, objectOf, playerOf, renewObject } from '../draft.ts';
import { executeInstructions } from '../effects/instructions.ts';
import { EngineInvariantError } from '../errors.ts';

/** The next player in turn order after `player` (338.1.b.1, 340.2.a). */
export function nextInTurnOrder(draft: Draft, player: PlayerId): PlayerId {
  const index = draft.turnOrder.indexOf(player);
  const next = draft.turnOrder[(index + 1) % draft.turnOrder.length];
  if (index < 0 || next === undefined)
    throw new EngineInvariantError(`${player} is not in turn order`);
  return next;
}

/**
 * Step 1 of playing (354): the card leaves its zone for the Chain, as a Pending Chain Item
 * (354.2, 329.1). The Chain is a Non-Board Zone: the card becomes a new object (328, 124).
 * If a Chain exists, the item joins it (330.2); otherwise the Chain begins, and the turn
 * becomes Closed (331.1, 354.1).
 */
export function addToChain(
  draft: Draft,
  playerId: PlayerId,
  card: ObjectId,
  from: 'hand' | 'championZone',
  targets: readonly ObjectId[],
): ObjectId {
  const player = playerOf(draft, playerId);
  player.zones[from] = player.zones[from].filter((id) => id !== card);
  const object = renewObject(draft, card);
  const item: ChainItem = {
    object: object.id,
    controller: playerId,
    status: 'pending',
    targets,
    ability: null,
  };
  append(draft, item, false);
  emit(draft, {
    type: 'ChainItemAdded',
    rule: '354',
    visibility: { kind: 'public' },
    player: playerId,
    object: object.id,
    previousObject: card,
    card: object.card,
    from,
    targets,
  });
  return object.id;
}

/** Adds an item; a new Chain begins if none exists (330.2). */
function append(draft: Draft, item: ChainItem, triggered: boolean): void {
  draft.chain =
    draft.chain === null
      ? { items: [item], priority: item.controller, passes: 0, triggered }
      : { ...draft.chain, items: [...draft.chain.items, item] };
}

/**
 * An ability goes on the Chain, Pending: an activated one as it is activated (377.3.a,
 * 401), a triggered one when it is put there (383.3). It has no card (377.3.a.1): it gets an id
 * of its own (123).
 */
export function addAbility(
  draft: Draft,
  playerId: PlayerId,
  ability: ChainAbility,
  targets: readonly ObjectId[],
): ObjectId {
  const object = newId(draft);
  append(
    draft,
    { object, controller: playerId, status: 'pending', targets, ability },
    ability.triggered,
  );
  emit(draft, {
    type: 'AbilityAdded',
    rule: ability.triggered ? '383.3' : '377.3.a',
    visibility: { kind: 'public' },
    player: playerId,
    object,
    source: ability.source,
    card: ability.card,
    index: ability.index,
    triggered: ability.triggered,
    targets,
  });
  return object;
}

/** The item of `object` on the Chain. */
function itemOf(draft: Draft, object: ObjectId): ChainItem {
  const item = draft.chain?.items.find((i) => i.object === object);
  if (item === undefined) throw new EngineInvariantError(`${object} is not on the Chain`);
  return item;
}

/** 359.1, 329.3: the item is no longer Pending: it is a Finalized Chain Item. */
export function finalize(draft: Draft, object: ObjectId): void {
  const chain = draft.chain;
  if (chain === null) throw new EngineInvariantError('No Chain');
  itemOf(draft, object);
  draft.chain = {
    ...chain,
    items: chain.items.map((i) => (i.object === object ? { ...i, status: 'finalized' } : i)),
  };
  emit(draft, {
    type: 'ChainItemFinalized',
    rule: '359.1',
    visibility: { kind: 'public' },
    object,
  });
}

/** Takes an item off the Chain; the Chain ends when it is empty (330, 340.2). */
export function removeFromChain(draft: Draft, object: ObjectId): void {
  const chain = draft.chain;
  if (chain === null) throw new EngineInvariantError('No Chain');
  const items = chain.items.filter((i) => i.object !== object);
  draft.chain = items.length === 0 ? null : { ...chain, items };
}

/**
 * 337.4: once no item is Pending, the controller of the next item on the Chain (the newest,
 * which resolves first, 340.1) gains Priority (312.2.c). The sequence of passes starts over.
 */
export function givePriorityToNewest(draft: Draft): void {
  const chain = draft.chain;
  if (chain === null) return;
  const newest = chain.items.at(-1);
  if (newest === undefined) throw new EngineInvariantError('Empty Chain');
  draft.chain = { ...chain, priority: newest.controller, passes: 0 };
}

/**
 * 338.1.b, 339: the player with Priority passes it. When every player has passed in sequence
 * without adding an item, the newest item resolves (339.1); otherwise the next player in turn
 * order gains Priority (339.2, 312.2.d).
 */
export function passPriority(draft: Draft): void {
  const chain = draft.chain;
  if (chain === null) throw new EngineInvariantError('No Chain');
  const next = nextInTurnOrder(draft, chain.priority);
  const passes = chain.passes + 1;
  emit(draft, {
    type: 'PriorityPassed',
    rule: '338.1.b',
    visibility: { kind: 'public' },
    player: chain.priority,
    next,
  });
  if (passes >= draft.turnOrder.length) {
    resolveNewest(draft);
    return;
  }
  draft.chain = { ...chain, priority: next, passes };
}

/**
 * 340: the newest Finalized Chain Item resolves (340.1). Its instructions are executed from top
 * to bottom (158.1). A spell then goes to its owner's trash (157), a new object (124); an
 * ability, which has no card, simply leaves the Chain. No cleanup happens while it resolves
 * (321); one runs once it has (321.1, 319.5).
 */
export function resolveNewest(draft: Draft): void {
  const chain = draft.chain;
  const item = chain?.items.at(-1);
  if (chain === null || item === undefined) throw new EngineInvariantError('Nothing to resolve');
  if (item.status !== 'finalized') throw new EngineInvariantError('The newest item is Pending');
  // A choice stops the resolution: the item stays on the Chain until it resumes (ADR 0020).
  if (executeInstructions(draft, item)) completeResolution(draft, item);
}

/**
 * ADR 0020: once its player has made the choice in `draft.resolving`, the resolution goes on from
 * the next instruction.
 */
export function resumeResolution(draft: Draft): void {
  const resolving = draft.resolving;
  if (resolving === null) throw new EngineInvariantError('No resolution waits');
  const item = draft.chain?.items.find((i) => i.object === resolving.item);
  if (item === undefined) throw new EngineInvariantError(`${resolving.item} is not on the Chain`);
  draft.resolving = null;
  if (executeInstructions(draft, item, resolving.next, resolving.token)) {
    completeResolution(draft, item);
  }
}

/** 340.1: the item leaves the Chain, a spell to its owner's trash; what follows (340.2–340.4). */
function completeResolution(draft: Draft, item: ChainItem): void {
  const beganWithTrigger = draft.chain?.triggered ?? false;
  removeFromChain(draft, item.object);
  let card = item.ability?.card;
  let trashed: ObjectId | null = null;
  if (item.ability === null) {
    const object = objectOf(draft, item.object);
    card = object.card;
    const renewed = renewObject(draft, item.object);
    playerOf(draft, object.owner).zones.trash.push(renewed.id);
    trashed = renewed.id;
  }
  if (card === undefined) throw new EngineInvariantError('A Chain item without a card');
  emit(draft, {
    type: 'ChainItemResolved',
    rule: '340.1',
    visibility: { kind: 'public' },
    player: item.controller,
    object: item.object,
    card,
    trashed,
  });
  afterResolution(draft, beganWithTrigger);
}

/**
 * What follows a resolution: a cleanup (321.1, 319.5); then, if the Chain is empty, the turn is
 * Open again (340.2) and, during a Showdown, Focus passes to the next player in turn order
 * (340.2.a, 347.1.b), unless a triggered ability began the Chain (340.2.a, 346.1); otherwise the
 * controller of the newest item gains Priority (340.4). Add abilities do not exist yet.
 */
function afterResolution(draft: Draft, beganWithTrigger: boolean): void {
  cleanup(draft);
  if (draft.winner !== null) return;
  if (draft.chain !== null) {
    givePriorityToNewest(draft);
    return;
  }
  const showdown = draft.showdown;
  if (showdown === null || beganWithTrigger) return;
  const next = nextInTurnOrder(draft, showdown.focus);
  draft.showdown = { ...showdown, focus: next, passes: 0 };
  emit(draft, {
    type: 'FocusPassed',
    rule: '340.2.a',
    visibility: { kind: 'public' },
    player: showdown.focus,
    next,
  });
}
