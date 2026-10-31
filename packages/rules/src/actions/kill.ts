// Kill (429): a permanent goes from the board to its owner's trash (429.1, 429.2), as a new object
// (124). Active, when an effect instructs it (429.1.a.1); passive, for lethal damage in a cleanup
// (429.1.a.2, 323.4).

import type { ObjectId } from '@foilengine/types';
import { trigger } from '../abilities/triggers.ts';
import { type Draft, emit, locationOf, objectOf, playerOf, renewObject } from '../draft.ts';
import { EngineInvariantError } from '../errors.ts';
import { ceaseIfToken } from './play-token.ts';

/** Kills these permanents, at the same time, in this order. */
export function killPermanents(
  draft: Draft,
  units: readonly ObjectId[],
  rule: '323.4' | '429.1.a.1',
): void {
  // 808.1.d.2, 383.2.c.3, 429.1.a.1.b: abilities that trigger on their source's death are
  // processed just before it goes to the trash, while what they need about it can still be noted.
  trigger(draft, 'dies', units);
  for (const unit of units) {
    const location = locationOf(draft, unit);
    if (location === null) throw new EngineInvariantError(`${unit} is not on the board`);
    if (location.kind === 'base') {
      const base = playerOf(draft, location.player).zones;
      base.base = base.base.filter((id) => id !== unit);
    } else {
      location.battlefield.units = location.battlefield.units.filter((id) => id !== unit);
    }
    // 429.2: directly to its owner's trash; a Non-Board Zone, so a new object (124).
    const owner = objectOf(draft, unit).owner;
    const dead = renewObject(draft, unit);
    const trash = playerOf(draft, owner).zones.trash;
    trash.push(dead.id);
    emit(draft, {
      type: 'UnitKilled',
      rule,
      visibility: { kind: 'public' },
      player: owner,
      unit,
      object: dead.id,
      card: dead.card,
    });
    ceaseIfToken(draft, dead.id, trash);
  }
}
