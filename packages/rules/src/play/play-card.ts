// Playing a card (349–359). M2 plays units without abilities, from the hand or, for the
// Chosen Champion, from the Champion Zone (108.3.d). The chain arrives with M3: until then
// a unit is played as one action that follows the steps of the play process in order.

import type { CardDefinition, GameState, IllegalReason, PlayCard } from '@foilengine/types';
import { cleanup } from '../cleanup/cleanup.ts';
import {
  type Draft,
  draftOf,
  emit,
  objectOf,
  playerOf,
  renewObject,
  stateOf,
  updateObject,
} from '../draft.ts';
import { EngineInvariantError, IllegalActionError } from '../errors.ts';
import { payCost, useRunes } from '../resources/payment.ts';

/** Plays the card on the draft. Returns why it is illegal, if it is; the draft is then to be dropped. */
function playCard(draft: Draft, state: GameState, action: PlayCard): IllegalReason | null {
  const player = playerOf(draft, action.player);
  const from = player.zones.hand.includes(action.card)
    ? 'hand'
    : player.zones.championZone.includes(action.card)
      ? 'championZone'
      : null;
  if (from === null) {
    return {
      code: 'card-not-playable',
      message: `${action.card} is not in ${action.player}'s hand or Champion Zone`,
      rule: '108.3.d',
    };
  }
  const object = objectOf(draft, action.card);
  const definition = state.cards[object.card] as CardDefinition;
  if (definition.category !== 'unit' || definition.cost === undefined) {
    return {
      code: 'card-not-playable',
      message: `${definition.name} is a ${definition.category}: only units can be played yet`,
      rule: null,
    };
  }

  // 355.2: choose a valid location: the base, or a battlefield the player controls (355.2.a).
  const location = action.location;
  const target =
    location.kind === 'battlefield'
      ? draft.battlefields.find((b) => b.object === location.battlefield)
      : null;
  if (location.kind === 'battlefield' && target?.controller !== action.player) {
    return {
      code: 'invalid-location',
      message: 'A unit enters your base or a battlefield you control',
      rule: '355.2.a',
    };
  }

  // 356: the total cost is the printed cost: no modifiers before M3. 357: pay it, using runes
  // to add resources first (357.1.a). 358.2, 358.5: if it is not paid, the whole play is undone.
  const runes = useRunes(draft, state, action.player, action.payment);
  if (runes !== null) return runes;
  const paid = payCost(draft, action.player, definition.cost);
  if (paid !== null) return paid;

  // 359.2: the unit becomes a game object and enters the board exhausted at the chosen location
  // (359.2.c). It came from a Non-Board Zone: a new object (124).
  player.zones[from] = player.zones[from].filter((id) => id !== action.card);
  const unit = renewObject(draft, action.card);
  updateObject(draft, unit.id, { exhausted: true });
  if (target === null || target === undefined) player.zones.base.push(unit.id);
  else target.units.push(unit.id);
  emit(draft, {
    type: 'CardPlayed',
    rule: '359.2.c',
    visibility: { kind: 'public' },
    player: action.player,
    object: unit.id,
    previousObject: action.card,
    card: unit.card,
    from,
    battlefield: target?.object ?? null,
  });
  cleanup(draft); // 319.6: an object entered the board.
  return null;
}

export function checkPlayCard(state: GameState, action: PlayCard): IllegalReason | null {
  return playCard(draftOf(state), state, action);
}

export function applyPlayCard(
  state: GameState,
  action: PlayCard,
): { state: GameState; events: Draft['events'] } {
  const draft = draftOf(state);
  const reason = playCard(draft, state, action);
  if (reason !== null) throw new IllegalActionError(reason);
  if (draft.stage.kind === 'ended' && draft.winner === null)
    throw new EngineInvariantError('Game ended without a winner');
  return { state: stateOf(state, draft), events: draft.events };
}
