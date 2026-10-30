// Standard Move (144, 447–455): exhaust ready units to move them to one destination.

import type {
  CardDefinition,
  GameState,
  IllegalReason,
  ObjectId,
  StandardMove,
} from '@foilengine/types';
import { cleanup } from '../cleanup/cleanup.ts';
import {
  battlefieldOf,
  controllerOf,
  type Draft,
  draftOf,
  emit,
  locationOf,
  objectOf,
  playerOf,
  playersAt,
  stateOf,
  updateObject,
} from '../draft.ts';
import { IllegalActionError } from '../errors.ts';

function invalid(message: string, rule: IllegalReason['rule']): IllegalReason {
  return { code: 'invalid-move', message, rule };
}

/** Moves the units on the draft. Returns why the move is illegal, if it is. */
function standardMove(draft: Draft, state: GameState, action: StandardMove): IllegalReason | null {
  const { player: playerId, units, destination } = action;
  if (units.length === 0) return invalid('Choose at least one unit', '144');
  if (new Set(units).size !== units.length) return invalid('A unit was chosen twice', '144.3');

  const origins = [];
  for (const unit of units) {
    const object = draft.objects[unit];
    if (
      object === undefined ||
      (state.cards[object.card] as CardDefinition | undefined)?.category !== 'unit'
    ) {
      return invalid(`${unit} is not a unit on the board`, '144');
    }
    if (controllerOf(draft, unit) !== playerId)
      return invalid(`${playerId} does not control ${unit}`, '144');
    // 144.2: exhausting the unit is the cost; an exhausted unit cannot pay it (415.4).
    if (object.exhausted) return invalid(`${unit} is exhausted`, '144.2');
    const location = locationOf(draft, unit);
    if (location === null) return invalid(`${unit} is not on the board`, '146.1');
    origins.push(location);
  }

  if (destination.kind === 'battlefield') {
    // 144.4.a: from the base to a battlefield. Battlefield to battlefield needs Ganking (144.4.c.1, M3).
    if (origins.some((origin) => origin.kind !== 'base')) {
      return invalid('Units move to a battlefield from their base', '144.4.a');
    }
    const target = draft.battlefields.find((b) => b.object === destination.battlefield);
    if (target === undefined)
      return invalid(`${destination.battlefield} is not a battlefield`, '449.2');
    const others = [...playersAt(draft, target)].filter((p) => p !== playerId);
    if (others.length >= 2)
      return invalid('A battlefield with units of 2 other players', '144.4.a.1');
    // 454: with units of one other player there, the move causes Combat at the next cleanup.
  } else if (origins.some((origin) => origin.kind !== 'battlefield')) {
    // 144.4.b: from a battlefield to the base.
    return invalid('Units move to their base from a battlefield', '144.4.b');
  }

  // 144.2, 144.3.c: exhaust every unit, as one payment.
  for (const unit of units) {
    updateObject(draft, unit, { exhausted: true });
    emit(draft, {
      type: 'ObjectExhausted',
      rule: '144.2',
      visibility: { kind: 'public' },
      player: playerId,
      object: unit,
    });
  }
  // 448.3: moving is instantaneous; board to board, the units stay the same objects (448.2).
  const player = playerOf(draft, playerId);
  for (const [index, unit] of units.entries()) {
    const origin = origins[index];
    if (origin?.kind === 'base') player.zones.base = player.zones.base.filter((id) => id !== unit);
    else if (origin?.kind === 'battlefield')
      origin.battlefield.units = origin.battlefield.units.filter((id) => id !== unit);
  }
  if (destination.kind === 'base') {
    player.zones.base.push(...units);
  } else {
    battlefieldOf(draft, destination.battlefield).units.push(...units);
  }
  emit(draft, {
    type: 'UnitsMoved',
    rule: '144',
    visibility: { kind: 'public' },
    player: playerId,
    units,
    battlefield: destination.kind === 'base' ? null : destination.battlefield,
  });

  // 452, 190.3.a.1: the destination becomes Contested if it is not already, and the player does
  // not control it.
  if (destination.kind === 'battlefield') {
    const target = battlefieldOf(draft, destination.battlefield);
    if (target.contestedBy === null && target.controller !== playerId) {
      target.contestedBy = playerId;
      emit(draft, {
        type: 'BattlefieldContested',
        rule: '452',
        visibility: { kind: 'public' },
        player: playerId,
        battlefield: target.object,
      });
    }
  }
  cleanup(draft); // 455
  return null;
}

export function checkStandardMove(state: GameState, action: StandardMove): IllegalReason | null {
  return standardMove(draftOf(state), state, action);
}

export function applyStandardMove(
  state: GameState,
  action: StandardMove,
): { state: GameState; events: Draft['events'] } {
  const draft = draftOf(state);
  const reason = standardMove(draft, state, action);
  if (reason !== null) throw new IllegalActionError(reason);
  return { state: stateOf(state, draft), events: draft.events };
}

/** Ready units a player controls, by location: the candidates for a Standard Move. */
export function movableUnits(
  state: GameState,
  playerId: string,
): { base: ObjectId[]; battlefields: ObjectId[] } {
  const draft = draftOf(state);
  const ready = (id: ObjectId) =>
    !objectOf(draft, id).exhausted &&
    state.cards[objectOf(draft, id).card]?.category === 'unit' &&
    controllerOf(draft, id) === playerId;
  const base = draft.players.find((p) => p.id === playerId)?.zones.base.filter(ready) ?? [];
  const battlefields = draft.battlefields.flatMap((b) => b.units.filter(ready));
  return { base, battlefields };
}
