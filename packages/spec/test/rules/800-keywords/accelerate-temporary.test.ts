// Accelerate (805) and Temporary (816).

import { autoPayment, characteristics } from '@foilengine/rules';
import { board, scenario, testSetup } from '@foilengine/testkit';
import type { Action, GameState, ObjectId, PlayerId } from '@foilengine/types';
import { describe } from 'vitest';
import { A, act, B, inHand, ofType, unitsInBase, v } from '../../battlefields.ts';

const start = (handA: string[]) =>
  board()
    .setup(testSetup({ withAbilities: true }))
    .firstPlayer('A')
    .player('A', { hand: handA, mainDeckTop: [v(5), v(6), v(7)] })
    .player('B', { hand: [v(1), v(2), v(3), v(4)], mainDeckTop: [v(5), v(6), v(7)] })
    .afterMulligans()
    .build();

function playUnit(state: GameState, player: PlayerId, card: string, accelerate = false): Action {
  const object = inHand(state, player, card);
  const definition = state.cards[state.objects[object]?.card as never];
  const cost = definition?.cost ?? { energy: 0, power: [] };
  const total = accelerate
    ? {
        energy: cost.energy + 1,
        power: [...cost.power, definition?.domains[0] ?? ('any' as const)],
      }
    : cost;
  const payment = autoPayment(state, player, total);
  if (payment === null) throw new Error(`${player} cannot pay for ${card}`);
  return {
    type: 'PlayCard',
    player,
    card: object,
    location: { kind: 'base' },
    payment,
    ...(accelerate ? { accelerate: true } : {}),
  };
}

describe('805 Accelerate', () => {
  scenario("rule 805.1.b: paying Accelerate's [1][C] as the unit is played, it enters ready", {
    rules: [
      '805.1.b',
      '805',
      '805.1',
      '805.1.a',
      '805.2',
      '805.6',
      '143.4',
      '143.4.a',
      '355.1.a',
      '356.2.b',
      '356.2.b.1',
    ],
    // Turn 1: two Fury runes. Sprinter costs 1; with Accelerate, 2 Energy and 1 Fury Power.
    setup: () => start(['Sprinter', v(1), v(2), v(3)]),
    check: (t) => {
      t.act(playUnit(t.state, A, 'test:sprinter', true));
      t.expect(ofType(t.events, 'ResourcesPaid')).toMatchObject([
        { resources: { energy: 2, power: { fury: 1 } } },
      ]);
      const [played] = ofType(t.events, 'CardPlayed');
      t.expect(t.state.objects[played?.object as ObjectId]?.exhausted).toBe(false);
      // It enters ready: it is not readied after entering exhausted (805.6).
      t.expect(ofType(t.events, 'ObjectsReadied')).toEqual([]);
    },
  });

  scenario('rule 805.2: Accelerate is optional: without it, the unit enters exhausted', {
    rules: ['805.2'],
    setup: () => start(['Sprinter', v(1), v(2), v(3)]),
    check: (t) => {
      t.act(playUnit(t.state, A, 'test:sprinter'));
      const [played] = ofType(t.events, 'CardPlayed');
      t.expect(t.state.objects[played?.object as ObjectId]?.exhausted).toBe(true);
      // A unit without Accelerate cannot pay it.
      const vanilla = inHand(t.state, A, 'test:vanilla-1');
      t.actIllegal(
        {
          type: 'PlayCard',
          player: A,
          card: vanilla,
          location: { kind: 'base' },
          accelerate: true,
          payment: [],
        },
        'card-not-playable',
      );
    },
  });
});

describe('816 Temporary', () => {
  scenario(
    "rule 816.1.b: a permanent with Temporary is killed at the start of its controller's Beginning Phase",
    {
      rules: [
        '816.1.b',
        '816',
        '816.1',
        '816.1.a',
        '816.1.c',
        '816.3',
        '429.1.a.1',
        '429.6',
        '315.2.a',
        '315.2.a.1',
      ],
      // A plays Sprite on turn 1.
      setup: () => {
        const state = start(['Sprite', v(1), v(2), v(3)]);
        return act(state, playUnit(state, A, 'test:sprite')).state;
      },
      check: (t) => {
        const [sprite] = unitsInBase(t.state, A) as [ObjectId];
        t.expect(characteristics(t.state, sprite).keywords).toContain('temporary');
        // B's turn: not B's permanent, nothing happens.
        t.act({ type: 'EndTurn', player: A });
        t.expect(ofType(t.events, 'AbilityAdded')).toEqual([]);
        // A's Beginning Phase: the ability triggers and waits on the Chain, before scoring.
        t.act({ type: 'EndTurn', player: B });
        t.expect(ofType(t.events, 'AbilityAdded')).toMatchObject([
          { source: sprite, triggered: true },
        ]);
        t.expect(t.state.stage).toMatchObject({ turnPlayer: A, phase: 'beginning' });
        t.act({ type: 'PassPriority', player: A }, { type: 'PassPriority', player: B });
        t.expect(ofType(t.events, 'UnitKilled')).toMatchObject([
          { unit: sprite, rule: '429.1.a.1' },
        ]);
        t.expect(t.state.objects[sprite]).toBeUndefined();
      },
    },
  );
});
