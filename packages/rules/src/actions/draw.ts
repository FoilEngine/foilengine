// Draw (414) and Burn Out (432).

import type { PlayerId, RuleNumber } from '@foilengine/types';
import { checkVictory } from '../cleanup/cleanup.ts';
import { type Draft, emit, objectOf, opponentsOf, playerOf, renewObject } from '../draft.ts';
import { EngineInvariantError } from '../errors.ts';
import { shuffle } from '../rng/xoshiro128.ts';

/** More Burn Outs than this in one draw is a bug: the opponent must have won long before. */
const MAX_BURN_OUTS_PER_DRAW = 100;

/**
 * Draws `count` cards from the top of the Main Deck (414.1.a). Each drawn card becomes
 * a new object, since it moves from one Non-Board Zone to another (124).
 * When the Main Deck runs out, the player Burns Out, then draws the rest (414.4, 432.1.a).
 */
export function drawCards(draft: Draft, playerId: PlayerId, count: number, rule: RuleNumber): void {
  const zones = playerOf(draft, playerId).zones;
  let burnOuts = 0;
  for (let i = 0; i < count; i++) {
    while (zones.mainDeck.length === 0) {
      if (draft.winner !== null) return;
      burnOuts += 1;
      if (burnOuts > MAX_BURN_OUTS_PER_DRAW) {
        throw new EngineInvariantError(`${playerId} burned out ${burnOuts} times in one draw`);
      }
      burnOut(draft, playerId, burnOuts > 1);
    }
    if (draft.winner !== null) return;
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

/**
 * Burn Out (432.2): recycle the trash into the Main Deck in a random order (432.2.b, 417.5),
 * then an opponent gains 1 point (432.2.c). The caller completes the action (432.2.d).
 * Points from a repeated Burn Out within the same action win at once (432.3.c, 432.3.c.1).
 */
function burnOut(draft: Draft, playerId: PlayerId, repeated: boolean): void {
  const player = playerOf(draft, playerId);
  const opponents = opponentsOf(draft, playerId);
  const opponent = opponents[0];
  if (opponent === undefined || opponents.length > 1) {
    // Choosing among several opponents is a Decision: it arrives with the multiplayer modes.
    throw new EngineInvariantError(
      `Burn Out with ${opponents.length} opponents is not implemented yet`,
    );
  }

  const recycled = shuffle(draft.rng, player.zones.trash);
  draft.rng = recycled.rng;
  player.zones.trash = [];
  for (const id of recycled.value) {
    const object = renewObject(draft, id);
    player.zones.mainDeck.push(object.id);
    emit(draft, {
      type: 'CardRecycled',
      rule: '432.2.b',
      // Cards in the trash are public (108.2.d).
      visibility: { kind: 'public' },
      player: playerId,
      object: object.id,
      previousObject: id,
      card: object.card,
      from: 'trash',
      to: 'mainDeck',
    });
  }

  emit(draft, {
    type: 'BurnedOut',
    rule: '432.2',
    visibility: { kind: 'public' },
    player: playerId,
    opponent: opponent.id,
  });
  opponent.points += 1;
  emit(draft, {
    type: 'PointsGained',
    rule: '432.2.c',
    visibility: { kind: 'public' },
    player: opponent.id,
    amount: 1,
    total: opponent.points,
  });
  if (repeated) checkVictory(draft, '432.3.c.1');
}
