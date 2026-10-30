import { board, scenario } from '@foilengine/testkit';
import type { ObjectId } from '@foilengine/types';
import { describe, expect } from 'vitest';
import {
  A,
  afterConquest,
  B,
  battlefield,
  endTurn,
  move,
  ofType,
  playCheap,
  turnThree,
  unitsInBase,
  v,
} from '../../battlefields.ts';

describe('144 Standard Move, 447–455 Movement', () => {
  scenario('rule 144.2: exhausting the unit is the cost of its Standard Move', {
    rules: ['144.2', '144.4.a', '450'],
    setup: turnThree,
    check: (t) => {
      const [unit] = unitsInBase(t.state, A) as [ObjectId];
      t.act(move(A, [unit], battlefield(t.state, 0)));
      t.expect(ofType(t.events, 'ObjectExhausted')).toMatchObject([
        { object: unit, rule: '144.2' },
      ]);
      t.expect(ofType(t.events, 'UnitsMoved')).toMatchObject([
        { player: A, units: [unit], battlefield: battlefield(t.state, 0) },
      ]);
      t.expect(t.state.battlefields[0]?.units).toEqual([unit]);
      t.expect(t.player('A').zones.base).not.toContain(unit);
      t.expect(t.state.objects[unit]?.exhausted).toBe(true);
    },
  });

  scenario('rule 144.2: an exhausted unit cannot pay for a Standard Move', {
    rules: ['144.2', '359.2.c'],
    setup: () => {
      const state = board()
        .firstPlayer('A')
        .player('A', { hand: [v(1), v(2), v(3), v(4)] })
        .afterMulligans()
        .build();
      return playCheap(state, A, 'test:vanilla-1').state;
    },
    check: (t) => {
      const [unit] = unitsInBase(t.state, A) as [ObjectId];
      t.expectIllegal(move(A, [unit], battlefield(t.state, 0)), 'invalid-move');
    },
  });

  scenario(
    'rule 144.3.a: several units move together to one destination, their costs paid at once',
    {
      rules: ['144.3.a', '144.3', '144.3.c'],
      setup: turnThree,
      check: (t) => {
        const units = unitsInBase(t.state, A);
        t.expect(units).toHaveLength(2);
        t.act(move(A, units, battlefield(t.state, 0)));
        t.expect(ofType(t.events, 'UnitsMoved')).toHaveLength(1);
        t.expect(t.state.battlefields[0]?.units).toEqual(units);
      },
    },
  );

  scenario('rule 448.2: moving on the board does not change the objects', {
    rules: ['448.2', '448.3'],
    setup: turnThree,
    check: (t) => {
      const units = unitsInBase(t.state, A);
      t.act(move(A, units, battlefield(t.state, 0)));
      // The same ids are still objects of the game, now at the battlefield.
      for (const unit of units) t.expect(t.state.objects[unit]).toBeDefined();
      t.expect(t.state.battlefields[0]?.units).toEqual(units);
    },
  });

  scenario(
    'rule 452: the destination becomes Contested when its controller is not the moving player',
    {
      rules: ['452', '190.3.a', '190.3.a.1'],
      setup: turnThree,
      check: (t) => {
        const target = battlefield(t.state, 0);
        t.act(move(A, unitsInBase(t.state, A), target));
        t.expect(ofType(t.events, 'BattlefieldContested')).toMatchObject([
          { player: A, battlefield: target, rule: '452' },
        ]);
      },
    },
  );

  scenario('rule 144.4.b: units move from a battlefield back to their base', {
    rules: ['144.4.b'],
    setup: () => {
      // A's turn 5: the units that conquered on turn 3 are ready again.
      let state = afterConquest().state;
      state = endTurn(state).state;
      return endTurn(state).state;
    },
    check: (t) => {
      const units = [...(t.state.battlefields[0]?.units ?? [])];
      t.act(move(A, units, 'base'));
      t.expect(unitsInBase(t.state, A)).toEqual(expect.arrayContaining(units));
      t.expect(t.state.battlefields[0]?.units).toEqual([]);
    },
  });

  scenario('rule 144.4.a: units move to a battlefield only from their base', {
    rules: ['144.4.a', '144.4.c.1'],
    setup: () => {
      let state = afterConquest().state;
      state = endTurn(state).state;
      return endTurn(state).state;
    },
    check: (t) => {
      const units = [...(t.state.battlefields[0]?.units ?? [])];
      t.expectIllegal(move(A, units, battlefield(t.state, 1)), 'invalid-move');
    },
  });

  scenario(
    'rule 454: moving to a battlefield with enemy units causes Combat, not implemented yet',
    {
      rules: ['454'],
      setup: () => endTurn(afterConquest().state).state,
      check: (t) => {
        const [unit] = unitsInBase(t.state, B) as [ObjectId];
        const reason = t.expectIllegal(move(B, [unit], battlefield(t.state, 0)), 'not-implemented');
        t.expect(reason.rule).toBe('454');
      },
    },
  );

  scenario('rule 144.1.c: no Standard Move during a Showdown', {
    rules: ['144.1.c'],
    setup: turnThree,
    check: (t) => {
      const [first, second] = unitsInBase(t.state, A) as [ObjectId, ObjectId];
      t.act(move(A, [first], battlefield(t.state, 0)));
      t.expectDecision({ kind: 'Focus', player: A });
      t.expectIllegal(move(A, [second], battlefield(t.state, 1)), 'wrong-action');
    },
  });
});
