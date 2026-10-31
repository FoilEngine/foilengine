// Vision (817) and Predict (437): a choice during a resolution (ADR 0020).

import { autoPayment, viewFor } from '@foilengine/rules';
import { board, scenario, testSetup } from '@foilengine/testkit';
import type { Action, CardId, GameState, ObjectId, PlayerId } from '@foilengine/types';
import { describe } from 'vitest';
import { A, B, inHand, ofType, v } from '../../battlefields.ts';

const pass = (player: PlayerId): Action => ({ type: 'PassPriority', player });

/** A goes first and draws Vanilla 5 on turn 1: the top of A's Main Deck is then Vanilla 6, 7, 8. */
const start = (handA: string[]) =>
  board()
    .setup(testSetup({ withAbilities: true }))
    .firstPlayer('A')
    .player('A', { hand: handA, mainDeckTop: [v(5), v(6), v(7), v(8)] })
    .player('B', { hand: [v(1), v(2), v(3), v(4)], mainDeckTop: [v(5), v(6), v(7), v(8)] })
    .afterMulligans()
    .build();

function play(state: GameState, player: PlayerId, card: string): Action {
  const object = inHand(state, player, card);
  const definition = state.cards[state.objects[object]?.card as CardId];
  const payment =
    definition?.cost === undefined ? null : autoPayment(state, player, definition.cost);
  if (payment === null) throw new Error(`${player} cannot pay for ${card}`);
  return {
    type: 'PlayCard',
    player,
    card: object,
    payment,
    ...(definition?.category === 'unit' ? { location: { kind: 'base' as const } } : {}),
  };
}

const deckOf = (state: GameState, player: PlayerId) =>
  state.players.find((p) => p.id === player)?.zones.mainDeck ?? [];
const cardsOf = (state: GameState, ids: readonly ObjectId[]) =>
  ids.map((id) => state.objects[id]?.card);

describe('817 Vision, 437 Predict', () => {
  scenario('rule 817.1.b: when a permanent with Vision is played, its controller Predicts', {
    rules: [
      '817.1.b',
      '817',
      '817.1',
      '817.1.a',
      '817.1.c',
      '817.3',
      '437',
      '437.1',
      '437.2',
      '437.2.a',
      '437.3',
      '417',
      '417.1',
      '417.1.a',
    ],
    setup: () => start(['Seer', v(1), v(2), v(3)]),
    check: (t) => {
      const [top] = deckOf(t.state, A) as [ObjectId];
      t.act(play(t.state, A, 'test:seer'), pass(A), pass(B));
      t.expect(ofType(t.events, 'Predicted')).toMatchObject([{ player: A, count: 1 }]);
      // A looks at the top card of their Main Deck; B sees nothing of it.
      t.expectDecision({
        kind: 'Predict',
        player: A,
        cards: [{ object: top, card: 'test:vanilla-6' as CardId }],
      });
      t.expect(JSON.stringify(viewFor(t.state, B))).not.toContain(top);
      // The resolution waits: nothing else can happen (158.3).
      t.actIllegal(pass(B), 'wrong-action');
      t.act({ type: 'Predict', player: A, recycle: [top], top: [] });
      t.expect(cardsOf(t.state, deckOf(t.state, A).slice(0, 1))).toEqual(['test:vanilla-7']);
      t.expect(cardsOf(t.state, deckOf(t.state, A).slice(-1))).toEqual(['test:vanilla-6']);
      t.expect(t.state.chain).toBeNull();
      t.expect(t.state.resolving).toBeNull();
    },
  });

  scenario(
    'rule 437.1.a: Predicting several cards, the rest go back on top in the order the player chooses',
    {
      rules: ['437.1.a'],
      // Glimpse: "Predict 2, then draw 1."
      setup: () => start(['Glimpse', v(1), v(2), v(3)]),
      check: (t) => {
        const [first, second] = deckOf(t.state, A) as [ObjectId, ObjectId];
        t.act(play(t.state, A, 'test:glimpse'), pass(A), pass(B));
        t.expectDecision({ kind: 'Predict', player: A });
        // Each card looked at, once: recycled or back on top.
        t.actIllegal({ type: 'Predict', player: A, recycle: [], top: [first] }, 'invalid-choice');
        t.act({ type: 'Predict', player: A, recycle: [], top: [second, first] });
        // The resolution resumes: Glimpse draws the card now on top.
        t.expect(ofType(t.events, 'CardDrawn')).toMatchObject([
          { player: A, card: 'test:vanilla-7' },
        ]);
        t.expect(cardsOf(t.state, deckOf(t.state, A).slice(0, 1))).toEqual(['test:vanilla-6']);
        t.expect(ofType(t.events, 'ChainItemResolved')).toHaveLength(1);
      },
    },
  );
});
