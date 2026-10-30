// Draw (414): take cards from the top of the Main Deck into the hand.

import type { PlayerId, RuleNumber } from '@foilengine/types';
import { type Draft, emit, objectOf, playerOf, renewObject } from '../draft.ts';
import { EngineInvariantError } from '../errors.ts';

/**
 * Draws `count` cards from the top of the Main Deck (414.1.a). Each drawn card becomes
 * a new object, since it moves from one Non-Board Zone to another (124).
 * Drawing from a too-small deck needs the Burn Out (414.4, 432), which arrives with M2.
 */
export function drawCards(draft: Draft, playerId: PlayerId, count: number, rule: RuleNumber): void {
  const zones = playerOf(draft, playerId).zones;
  if (zones.mainDeck.length < count) {
    throw new EngineInvariantError(
      `${playerId} must draw ${count} with ${zones.mainDeck.length} cards left: Burn Out (414.4) is not implemented yet`,
    );
  }
  for (let i = 0; i < count; i++) {
    const top = zones.mainDeck.shift();
    if (top === undefined) throw new EngineInvariantError('Empty Main Deck');
    const drawn = renewObject(draft, top);
    zones.hand.push(drawn.id);
    emit(draft, {
      type: 'CardDrawn',
      rule,
      visibility: { kind: 'private', to: [playerId] },
      player: playerId,
      object: drawn.id,
      card: objectOf(draft, drawn.id).card,
    });
  }
}
