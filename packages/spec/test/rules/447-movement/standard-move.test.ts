import { board, scenario } from '@foilengine/testkit';
import type { ObjectId } from '@foilengine/types';
import { describe, expect } from 'vitest';
import {
  A,
  act,
  afterConquest,
  B,
  battlefield,
  endTurn,
  move,
  ofType,
  playCheap,
  turnFive,
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

  scenario(
    "rule 144: units have a Standard Move, usable any time in their controller's Main Phase",
    {
      rules: [
        '144',
        '144.1',
        '144.1.a',
        '144.4',
        '107.1.b',
        '107.2.b',
        '448.1',
        '449',
        '449.1',
        '449.2',
      ],
      // A's turn 5: two ready units at the first battlefield, Vanilla 6 ready in base.
      setup: turnFive,
      check: (t) => {
        const target = battlefield(t.state, 0);
        const [u1, u2] = (t.state.battlefields[0]?.units ?? []) as [ObjectId, ObjectId];
        const [v6] = unitsInBase(t.state, A) as [ObjectId];
        // Two Standard Moves in the same Main Phase, from a battlefield (origin) to the base
        // (destination): both are Locations.
        for (const unit of [u1, u2]) {
          t.act(move(A, [unit], 'base'));
          t.expect(ofType(t.events, 'UnitsMoved')).toMatchObject([
            { units: [unit], battlefield: null },
          ]);
          t.expect(t.state.battlefields[0]?.units).not.toContain(unit);
          t.expect(t.player('A').zones.base).toContain(unit);
        }
        // From the base to a battlefield.
        t.act(move(A, [v6], target));
        t.expect(ofType(t.events, 'UnitsMoved')).toMatchObject([
          { units: [v6], battlefield: target },
        ]);
        t.expect(t.player('A').zones.base).not.toContain(v6);
        t.expect(t.state.battlefields[0]?.units).toEqual([v6]);
      },
    },
  );

  scenario('rule 144.3.b: units moving together may come from different origins', {
    rules: ['144.3.b', '448.3.a', '448.3.b'],
    setup: () => {
      // A's turn 5: Vanilla 6 conquers the second battlefield; then A's turn 7, everything ready.
      let state = turnFive();
      const [v6] = unitsInBase(state, A) as [ObjectId];
      state = act(
        state,
        move(A, [v6], battlefield(state, 1)),
        { type: 'PassFocus', player: A },
        { type: 'PassFocus', player: B },
      ).state;
      return endTurn(endTurn(state).state).state;
    },
    check: (t) => {
      const [fromFirst] = (t.state.battlefields[0]?.units ?? []) as [ObjectId];
      const [fromSecond] = (t.state.battlefields[1]?.units ?? []) as [ObjectId];
      t.act(move(A, [fromFirst, fromSecond], 'base'));
      t.expect(ofType(t.events, 'UnitsMoved')).toMatchObject([
        { units: [fromFirst, fromSecond], battlefield: null },
      ]);
      // 448.3.a, 448.3.b: each unit is now at its destination, and nowhere else.
      for (const unit of [fromFirst, fromSecond]) {
        t.expect(t.player('A').zones.base.filter((id) => id === unit)).toHaveLength(1);
        t.expect(t.state.battlefields.some((b) => b.units.includes(unit))).toBe(false);
      }
    },
  });
});
