// Playing a token (179–187, 350.2): an effect creates it and plays it into its controller's base.
// Q-003 (docs/rules/questions.md), provisional decision: the token enters the board at once,
// during the resolution of the effect that plays it, so that a later linked instruction of
// that effect can affect it ("then buff it", 359.3.e.14).

import type { CardDefinition, CardId, ObjectId, PlayerId } from '@foilengine/types';
import { trigger } from '../abilities/triggers.ts';
import { createObject, type Draft, emit, findObject, playerOf, updateObject } from '../draft.ts';
import { EngineInvariantError } from '../errors.ts';

/** `player` plays a `token` into their base. Returns the new token. */
export function playToken(draft: Draft, player: PlayerId, token: CardId): ObjectId {
  const definition = draft.cards[token] as CardDefinition | undefined;
  if (definition?.token !== true) throw new EngineInvariantError(`${token} is not a token`);
  // 183: its owner is the player who controlled the effect; 182: so is its controller.
  const object = createObject(draft, token, player, null);
  // 185.2.d: a token unit is a unit: it enters exhausted (143.4, 359.2.c). It costs nothing to
  // play (185.3.a.1).
  updateObject(draft, object.id, { exhausted: true });
  playerOf(draft, player).zones.base.push(object.id);
  emit(draft, {
    type: 'TokenPlayed',
    rule: '350.2',
    visibility: { kind: 'public' },
    player,
    object: object.id,
    card: token,
  });
  // 383.4.a.2: its Play Effects trigger once it has entered the board.
  trigger(draft, 'played', [object.id]);
  return object.id;
}

/** 186.1: a token put into a Non-Board Zone other than the Chain ceases to exist there. */
export function ceaseIfToken(draft: Draft, object: ObjectId, zone: ObjectId[]): void {
  const card = findObject(draft, object)?.card;
  if (card === undefined || (draft.cards[card] as CardDefinition).token !== true) return;
  zone.splice(zone.indexOf(object), 1);
  draft.changedObjects.set(object, null);
  emit(draft, {
    type: 'TokenCeasedToExist',
    rule: '186.1',
    visibility: { kind: 'public' },
    object,
    card,
  });
}
