// Predict (437): the player chooses which of the cards they look at to recycle (417), and the
// order of the others on top of their Main Deck (437.1.a). The answer to the choice of a
// resolution (ADR 0020).

import type { IllegalReason, ObjectId, Predict } from '@foilengine/types';
import { type Draft, emit, objectOf, playerOf, renewObject } from '../draft.ts';
import { shuffle } from '../rng/xoshiro128.ts';

/** Why `action` does not answer the pending Predict, if it does not. */
export function predictProblem(draft: Draft, action: Predict): IllegalReason | null {
  const choice = draft.resolving?.choice;
  if (choice?.kind !== 'predict') {
    return { code: 'wrong-action', message: 'No Predict waits', rule: '437.1' };
  }
  const chosen = [...action.recycle, ...action.top];
  const same =
    chosen.length === choice.cards.length &&
    new Set(chosen).size === chosen.length &&
    chosen.every((card) => choice.cards.includes(card));
  return same
    ? null
    : {
        code: 'invalid-choice',
        message: 'Recycle some of the cards looked at and put the others on top, each once',
        rule: '437.1.a',
      };
}

/**
 * 437.1.a: the cards kept go back on top in the chosen order; the others are recycled to the
 * bottom (417.1.a), in a random order when there are two or more (417.5), as new objects whose
 * place no player knows (108.4.e).
 */
export function applyPredict(draft: Draft, action: Predict): void {
  const player = playerOf(draft, action.player);
  const looked = new Set([...action.recycle, ...action.top]);
  const rest = player.zones.mainDeck.filter((id) => !looked.has(id));
  const order = shuffle(draft.rng, action.recycle);
  draft.rng = order.rng;
  const recycled = (order.value as ObjectId[]).map((id) => ({
    id,
    renewed: renewObject(draft, id),
  }));
  player.zones.mainDeck = [...action.top, ...rest, ...recycled.map((r) => r.renewed.id)];
  for (const id of action.recycle) {
    const renewed = recycled.find((r) => r.id === id)?.renewed.id as ObjectId;
    emit(draft, {
      type: 'CardRecycled',
      rule: '437.1',
      visibility: { kind: 'private', to: [] },
      player: action.player,
      object: renewed,
      previousObject: id,
      card: objectOf(draft, renewed).card,
      from: 'mainDeck',
      to: 'mainDeck',
    });
  }
}
