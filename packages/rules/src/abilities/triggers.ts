// Triggered abilities (382–386): when their Condition is met, they wait to be put on the Chain
// (383.3), which happens once the current task is complete (334.1, 334.2).

import type { CardDefinition, ObjectId, PlayerId, Trigger } from '@foilengine/types';
import { addAbility, finalize, givePriorityToNewest } from '../chain/chain.ts';
import { controllerOf, type Draft, findObject } from '../draft.ts';
import { EngineInvariantError } from '../errors.ts';

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

/** Turn order, starting with the Turn Player (303.2.a, 383.3.d.1). */
function fromTurnPlayer(draft: Draft): PlayerId[] {
  const stage = draft.stage;
  const first = stage.kind === 'turn' ? draft.turnOrder.indexOf(stage.turnPlayer) : 0;
  return draft.turnOrder.map(
    (_, i) => draft.turnOrder[(first + i) % draft.turnOrder.length] as PlayerId,
  );
}

/** The player who must order several simultaneous triggered abilities now (383.3.d), if any. */
export function playerToOrder(
  draft: Pick<Draft, 'triggered' | 'stage' | 'turnOrder'>,
): PlayerId | null {
  for (const player of fromTurnPlayer(draft as Draft)) {
    const mine = draft.triggered.filter((t) => t.controller === player);
    if (mine.length > 1) return player;
    if (mine.length === 1) return null;
  }
  return null;
}

/**
 * 383.3.d.1: starting with the Turn Player and in turn order, each player puts their triggered
 * abilities on the Chain, Pending. A player with several chooses their order (383.3.d): this
 * stops at them and returns false.
 */
export function placeTriggered(draft: Draft): boolean {
  for (const player of fromTurnPlayer(draft)) {
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

/**
 * 337.1: Pending items are finalized in the order they were added. Triggered abilities have no
 * choice to make yet, so nothing stops them. Then their controllers act (337.4).
 */
export function finalizePending(draft: Draft): void {
  for (const item of draft.chain?.items ?? []) {
    if (item.status === 'pending') finalize(draft, item.object);
  }
  givePriorityToNewest(draft);
}
