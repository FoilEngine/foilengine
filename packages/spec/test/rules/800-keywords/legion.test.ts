// Legion (812), a Dependent Keyword (727), and discounts (356.4).

import { autoPayment } from '@foilengine/rules';
import { board, scenario, testSetup } from '@foilengine/testkit';
import type { Action, CardId, Cost, GameState, PlayerId } from '@foilengine/types';
import { describe } from 'vitest';
import { A, act, B, endTurn, inHand, ofType, v } from '../../battlefields.ts';

const start = (handA: string[]) =>
  board()
    .setup(testSetup({ withAbilities: true }))
    .firstPlayer('A')
    .player('A', { hand: handA, mainDeckTop: [v(5), v(6), v(7), v(8)] })
    .player('B', { hand: [v(1), v(2), v(3), v(4)], mainDeckTop: [v(5), v(6), v(7), v(8)] })
    .afterMulligans()
    .build();

/** `player` plays unit `card` (a test card id) to their base, paying `cost` with autoPayment. */
function play(state: GameState, player: PlayerId, card: string, cost?: Cost): Action {
  const object = inHand(state, player, card);
  const toPay = cost ?? state.cards[state.objects[object]?.card as CardId]?.cost;
  const payment = toPay === undefined ? null : autoPayment(state, player, toPay);
  if (payment === null) throw new Error(`${player} cannot pay for ${card}`);
  return { type: 'PlayCard', player, card: object, payment, location: { kind: 'base' } };
}

describe('812 Legion', () => {
  scenario(
    'rule 812.1.b.1: a Legion ability is Active if its controller played another card this turn',
    {
      rules: [
        '812.1.b.1',
        '812',
        '812.1',
        '812.1.a',
        '812.1.b',
        '812.1.b.2',
        '812.1.c',
        '812.3',
        '356.4.a',
        '356.4.b',
      ],
      // Turn 1, two runes: Legionnaire costs [3], "[Legion][>] I cost [2] less".
      setup: () => start(['Legionnaire', v(1), v(2), v(3)]),
      check: (t) => {
        // Alone, it costs 3: more than A has.
        t.expectIllegal(play(t.state, A, 'test:legionnaire', { energy: 2, power: [] }));
        t.act(play(t.state, A, 'test:vanilla-1'));
        // Another card was played: it costs 1.
        t.act(play(t.state, A, 'test:legionnaire', { energy: 1, power: [] }));
        t.expect(ofType(t.events, 'ResourcesPaid').at(-1)).toMatchObject({
          resources: { energy: 1 },
        });
      },
    },
  );

  scenario('rule 812.1.c: the card with Legion itself does not count, and the count is per turn', {
    rules: ['812.1.c', '727.1.c.1'],
    // Herald: "[Legion][>] When you play me, draw 1."
    setup: () => start(['Herald', 'Herald', 'Legionnaire', v(1)]),
    check: (t) => {
      // The first Herald is the first card played this turn: its own play does not count.
      t.act(play(t.state, A, 'test:herald'));
      t.expect(ofType(t.events, 'AbilityAdded')).toEqual([]);
      // The second one: Legion is Active, its ability triggers.
      t.act(play(t.state, A, 'test:herald'));
      t.expect(ofType(t.events, 'AbilityAdded')).toMatchObject([{ triggered: true }]);
      t.act({ type: 'PassPriority', player: A }, { type: 'PassPriority', player: B });
      // Turn 3: no card played yet this turn, Legionnaire costs its full [3].
      const turn3 = endTurn(endTurn(t.state).state).state;
      const played = act(turn3, play(turn3, A, 'test:legionnaire'));
      t.expect(ofType(played.events, 'ResourcesPaid')).toMatchObject([
        { resources: { energy: 3 } },
      ]);
    },
  });
});
