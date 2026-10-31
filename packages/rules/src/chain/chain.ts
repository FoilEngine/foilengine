// The Chain (327–340) and the FEPR process: Finalize, Execute, Pass, Resolve (334–340).
// Cards are put on the Chain by the play process (play/play-card.ts). There is no outstanding
// task to handle between steps before triggered abilities arrive: each action runs the steps it
// starts, then the engine waits for the player with Priority (338).

import type { ChainItem, ObjectId, PlayerId } from '@foilengine/types';
import { cleanup } from '../cleanup/cleanup.ts';
import { type Draft, emit, objectOf, playerOf, renewObject } from '../draft.ts';
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
  const item: ChainItem = { object: object.id, controller: playerId, status: 'pending', targets };
  draft.chain =
    draft.chain === null
      ? { items: [item], priority: playerId, passes: 0 }
      : { ...draft.chain, items: [...draft.chain.items, item] };
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
 * 340: the newest Finalized Chain Item resolves (340.1). A spell's instructions are executed
 * from top to bottom (158.1), then it goes to its owner's trash (157), a new object (124).
 * No cleanup happens while it resolves (321); one runs once it has (321.1, 319.5).
 */
export function resolveNewest(draft: Draft): void {
  const chain = draft.chain;
  const item = chain?.items.at(-1);
  if (chain === null || item === undefined) throw new EngineInvariantError('Nothing to resolve');
  if (item.status !== 'finalized') throw new EngineInvariantError('The newest item is Pending');
  const object = objectOf(draft, item.object);
  executeInstructions(draft, item);
  removeFromChain(draft, item.object);
  const owner = playerOf(draft, object.owner);
  const trashed = renewObject(draft, item.object);
  owner.zones.trash.push(trashed.id);
  emit(draft, {
    type: 'ChainItemResolved',
    rule: '340.1',
    visibility: { kind: 'public' },
    player: item.controller,
    object: item.object,
    card: object.card,
    trashed: trashed.id,
  });
  afterResolution(draft);
}

/**
 * What follows a resolution: a cleanup (321.1, 319.5); then, if the Chain is empty, the turn is
 * Open again (340.2) and, during a Showdown, Focus passes to the next player in turn order
 * (340.2.a, 347.1.b); otherwise the controller of the newest item gains Priority (340.4).
 * Every chain item is a card for now: none was started by a triggered or an Add ability.
 */
function afterResolution(draft: Draft): void {
  cleanup(draft);
  if (draft.winner !== null) return;
  if (draft.chain !== null) {
    givePriorityToNewest(draft);
    return;
  }
  const showdown = draft.showdown;
  if (showdown === null) return;
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
