// Repeat (820) and Deploy (830).

import { autoPayment } from '@foilengine/rules';
import { board, scenario, TEST_CARDS, testSetup } from '@foilengine/testkit';
import type { Action, CardId, Cost, GameState, ObjectId, PlayerId } from '@foilengine/types';
import { describe } from 'vitest';
import { A, act, B, battlefield, endTurn, inHand, move, ofType, v } from '../../battlefields.ts';

const pass = (player: PlayerId): Action => ({ type: 'PassPriority', player });

const start = (handA: string[], handB: string[] = [v(1), v(2), v(3), v(4)]) =>
  board()
    .setup(testSetup({ withAbilities: true }))
    .firstPlayer('A')
    .player('A', { hand: handA, mainDeckTop: [v(5), v(6), v(7), v(8)] })
    .player('B', { hand: handB, mainDeckTop: [v(5), v(6), v(7), v(8)] })
    .afterMulligans()
    .build();

const payFor = (state: GameState, player: PlayerId, cost: Cost) => {
  const payment = autoPayment(state, player, cost);
  if (payment === null) throw new Error(`${player} cannot pay`);
  return payment;
};

/** `player` plays unit `card` (a test card id) to their base. */
function playUnit(state: GameState, player: PlayerId, card: string): GameState {
  const object = inHand(state, player, card);
  const cost = state.cards[state.objects[object]?.card as CardId]?.cost as Cost;
  return act(state, {
    type: 'PlayCard',
    player,
    card: object,
    payment: payFor(state, player, cost),
    location: { kind: 'base' },
  }).state;
}

/** The unit of `card` (a test card id) in `player`'s base. */
const inBase = (state: GameState, player: PlayerId, card: string) =>
  (state.players.find((p) => p.id === player)?.zones.base ?? []).find(
    (id) => state.objects[id]?.card === card,
  ) as ObjectId;

describe('820 Repeat', () => {
  scenario(
    'rule 820.1.d: paying Repeat executes the instructions one more time, with choices of their own',
    {
      rules: [
        '820.1.d',
        '820',
        '820.1',
        '820.1.a',
        '820.1.b',
        '820.1.c',
        '820.1.c.1',
        '820.1.d.1',
        '820.2',
        '820.2.a',
        '820.3.a',
      ],
      // B plays Vanilla 1 and Vanilla 2 on turn 2. Turn 3: A's Volley, "[Repeat] [1] Deal 1 to a
      // unit.", on Vanilla 1, then on Vanilla 2.
      setup: () => {
        let state = endTurn(start(['Volley', 'Bolt', v(1), v(2)])).state;
        state = playUnit(playUnit(state, B, 'test:vanilla-1'), B, 'test:vanilla-2');
        return endTurn(state).state;
      },
      check: (t) => {
        const first = inBase(t.state, B, 'test:vanilla-1');
        const second = inBase(t.state, B, 'test:vanilla-2');
        // Only a card with Repeat can pay it.
        const bolt = inHand(t.state, A, 'test:bolt');
        const reason = t.actIllegal(
          {
            type: 'PlayCard',
            player: A,
            card: bolt,
            targets: [first],
            repeat: { targets: [second] },
            payment: payFor(t.state, A, { energy: 2, power: [] }),
          },
          'card-not-playable',
        );
        t.expect(reason.rule).toBe('820.1.a');
        t.act(
          {
            type: 'PlayCard',
            player: A,
            card: inHand(t.state, A, 'test:volley'),
            targets: [first],
            repeat: { targets: [second] },
            payment: payFor(t.state, A, { energy: 2, power: [] }),
          },
          pass(A),
          pass(B),
        );
        t.expect(ofType(t.events, 'ResourcesPaid')).toMatchObject([{ resources: { energy: 2 } }]);
        t.expect(ofType(t.events, 'DamageDealt')).toMatchObject([
          { damage: [{ unit: first, amount: 1 }] },
          { damage: [{ unit: second, amount: 1 }] },
        ]);
        // Played once (820.3.a).
        t.expect(ofType(t.events, 'ChainItemAdded')).toHaveLength(1);
        t.expect(ofType(t.events, 'ChainItemResolved')).toHaveLength(1);
      },
    },
  );
});

describe('830 Deploy', () => {
  scenario(
    'rule 830.1.b: gear with Deploy is played to a battlefield, stays there, and dies when an opponent holds it',
    {
      rules: ['830.1.b', '830', '830.1', '830.1.a', '830.1.b.1', '830.1.b.3', '830.3', '148.1.a.4'],
      // Turn 1: A plays Mine to the first battlefield. B plays Vanilla 1 on turn 2, conquers the
      // battlefield on turn 4, and holds it on turn 6.
      setup: () => start(['Mine', v(1), v(2), v(3)]),
      check: (t) => {
        const mine = inHand(t.state, A, 'test:mine');
        const payment = payFor(t.state, A, { energy: 1, power: [] });
        t.expect(
          t.actIllegal({ type: 'PlayCard', player: A, card: mine, payment }, 'invalid-location')
            .rule,
        ).toBe('830.1.b');
        const there = battlefield(t.state, 0);
        t.act({
          type: 'PlayCard',
          player: A,
          card: mine,
          payment,
          location: { kind: 'battlefield', battlefield: there },
        });
        const [deployed] = t.state.battlefields[0]?.gear ?? [];
        t.expect(t.state.objects[deployed as ObjectId]?.card).toBe(TEST_CARDS.mine.id);
        // Not recalled by the cleanups (830.1.b.3).
        t.expect(ofType(t.events, 'GearRecalled')).toEqual([]);
        let state = endTurn(t.state).state;
        state = playUnit(state, B, 'test:vanilla-1');
        state = endTurn(endTurn(state).state).state;
        state = act(
          state,
          move(B, [inBase(state, B, 'test:vanilla-1')], there),
          { type: 'PassFocus', player: B },
          { type: 'PassFocus', player: A },
        ).state;
        t.expect(state.battlefields[0]?.gear).toEqual([deployed]);
        // Turn 6: B holds the battlefield; Mine's ability kills it.
        const held = act(endTurn(endTurn(state).state).state, pass(A), pass(B));
        t.expect(ofType(held.events, 'GearKilled')).toMatchObject([{ gear: deployed, player: A }]);
        t.expect(held.state.battlefields[0]?.gear).toEqual([]);
      },
    },
  );
});
