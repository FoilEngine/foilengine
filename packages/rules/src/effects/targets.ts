// Targets (355.6–355.10): what a card chooses as it is played, and whether a choice is valid.

import type { ObjectId, PlayerId, TargetSpec } from '@foilengine/types';
import { controllerOf, type Draft, findObject, locationOf } from '../draft.ts';

/**
 * 355.9: a target is valid if it is a unit on the board (355.9.a, 355.9.a.1) that meets the
 * targeting restrictions (355.9.b), seen from `controller`, the player of the card. "Here" is the
 * location of `source`, the permanent of the ability (197); a spell has none.
 */
export function isValidTarget(
  draft: Draft,
  spec: TargetSpec,
  target: ObjectId,
  controller: PlayerId,
  source: ObjectId | null = null,
): boolean {
  const object = findObject(draft, target);
  if (object === undefined || draft.cards[object.card]?.category !== 'unit') return false;
  const location = locationOf(draft, target);
  if (location === null) return false;
  if (spec.at === 'battlefield' && location.kind !== 'battlefield') return false;
  if (spec.at === 'here') {
    const here = source === null ? null : locationOf(draft, source);
    if (here === null || !sameLocation(here, location)) return false;
  }
  const friendly = controllerOf(draft, target) === controller;
  if (spec.controller === 'friendly' && !friendly) return false;
  if (spec.controller === 'enemy' && friendly) return false;
  return true;
}

/** Every unit on the board that is a valid choice for `spec` (for legalActions). */
export function validTargets(
  draft: Draft,
  spec: TargetSpec,
  controller: PlayerId,
  source: ObjectId | null = null,
): ObjectId[] {
  const onBoard = [
    ...draft.players.flatMap((p) => p.zones.base),
    ...draft.battlefields.flatMap((b) => b.units),
  ];
  return onBoard.filter((id) => isValidTarget(draft, spec, id, controller, source));
}

type Location = NonNullable<ReturnType<typeof locationOf>>;

/** The same base or the same battlefield. */
function sameLocation(a: Location, b: Location): boolean {
  if (a.kind === 'base') return b.kind === 'base' && a.player === b.player;
  return b.kind === 'battlefield' && a.battlefield.object === b.battlefield.object;
}
