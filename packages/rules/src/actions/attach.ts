// Attach (435) and Detach (436), and the Attachment of gear to units (716–719).

import type { CardDefinition, ObjectId } from '@foilengine/types';
import {
  controllerOf,
  type Draft,
  emit,
  findObject,
  locationOf,
  objectOf,
  playerOf,
  setAttached,
  topMostOf,
} from '../draft.ts';
import { EngineInvariantError } from '../errors.ts';

/**
 * Attaches `card`, a permanent on the board, to `unit` (435.1): `unit` becomes its Top-Most Card.
 * A unit is never Attached (435.1.h.1); a card already Attached to `unit` stays so (435.1.g);
 * one Attached elsewhere Detaches first (435.1.f). Its location becomes the unit's, which is not
 * a Move (435.4), and nothing else about either card changes (435.5).
 */
export function attach(draft: Draft, card: ObjectId, unit: ObjectId): void {
  const definition = draft.cards[objectOf(draft, card).card] as CardDefinition;
  if (definition.category === 'unit' || locationOf(draft, card) === null) return;
  const current = topMostOf(draft, card);
  if (current === unit) return;
  // 435.1.f: Detached first, it is left where its Top-Most Card is, then leaves that place.
  if (current !== null) detach(draft, card, current);
  leaveZone(draft, card);
  setAttached(draft, unit, [...(objectOf(draft, unit).attached ?? []), card]);
  emit(draft, {
    type: 'GearAttached',
    rule: '435.1',
    visibility: { kind: 'public' },
    player: controllerOf(draft, card),
    gear: card,
    unit,
  });
}

/**
 * Detaches `card` from `unit` (436.1): it stays at the unit's location (436.4), or at the last
 * location of a unit that is leaving the board (436.4.b, 719.5). Gear left at a battlefield is
 * recalled in the next cleanup (436.4.a, 323.6).
 */
export function detach(draft: Draft, card: ObjectId, unit: ObjectId): void {
  const location = locationOf(draft, unit);
  if (location === null) throw new EngineInvariantError(`${unit} is not on the board`);
  setAttached(
    draft,
    unit,
    (objectOf(draft, unit).attached ?? []).filter((id) => id !== card),
  );
  if (location.kind === 'base') playerOf(draft, location.player).zones.base.push(card);
  else location.battlefield.gear.push(card);
  emit(draft, {
    type: 'GearDetached',
    rule: '436.1',
    visibility: { kind: 'public' },
    gear: card,
    unit,
  });
}

/**
 * 719.5: a Top-Most Card leaving the board for a Non-Board Zone: all its Attached cards Detach,
 * staying where it was. Its controller would choose the order (719.5.a); it only matters to
 * effects of detaching, none of which exist yet: they detach in the order they were attached.
 */
export function detachAll(draft: Draft, unit: ObjectId): void {
  for (const card of findObject(draft, unit)?.attached ?? []) detach(draft, card, unit);
}

/** Takes an unattached permanent out of its base or battlefield list. */
function leaveZone(draft: Draft, card: ObjectId): void {
  const location = locationOf(draft, card);
  if (location === null) return;
  if (location.kind === 'base') {
    const zones = playerOf(draft, location.player).zones;
    zones.base = zones.base.filter((id) => id !== card);
  } else {
    location.battlefield.gear = location.battlefield.gear.filter((id) => id !== card);
    location.battlefield.units = location.battlefield.units.filter((id) => id !== card);
  }
}
