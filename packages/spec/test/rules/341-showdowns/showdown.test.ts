import { scenario } from '@foilengine/testkit';
import type { ObjectId } from '@foilengine/types';
import { describe } from 'vitest';
import { A, B, battlefield, move, ofType, turnThree, unitsInBase } from '../../battlefields.ts';

/** A moves both units to the first battlefield: it becomes Contested and a Showdown begins. */
const contested = () => turnThree();

describe('341–348 Showdowns without spells', () => {
  scenario(
    'rule 344.2: a Contested battlefield without units of different players opens a Showdown in the next cleanup',
    {
      rules: ['344.2', '344', '323.7', '323.11', '455'],
      setup: contested,
      check: (t) => {
        const target = battlefield(t.state, 0);
        t.act(move(A, unitsInBase(t.state, A), target));
        t.expect(ofType(t.events, 'ShowdownStarted')).toMatchObject([
          { battlefield: target, focus: A },
        ]);
        t.expect(t.state.showdown).toEqual({ battlefield: target, focus: A, passes: 0 });
      },
    },
  );

  scenario('rule 345: the player who applied Contested gains Focus, and with it Priority', {
    rules: ['345', '313.2', '343.1'],
    setup: contested,
    check: (t) => {
      t.act(move(A, unitsInBase(t.state, A), battlefield(t.state, 0)));
      t.expectDecision({ kind: 'Focus', player: A });
      t.expectIllegal({ type: 'EndTurn', player: A }, 'wrong-action');
    },
  });

  scenario(
    'rule 347.2.b: when the player with Focus passes, the next player in turn order gains Focus',
    {
      rules: ['347.2.b', '347.2'],
      setup: contested,
      check: (t) => {
        t.act(move(A, unitsInBase(t.state, A), battlefield(t.state, 0)), {
          type: 'PassFocus',
          player: A,
        });
        t.expect(ofType(t.events, 'FocusPassed').at(-1)).toMatchObject({
          player: A,
          next: B,
          rule: '347.2.b',
        });
        t.expectDecision({ kind: 'Focus', player: B });
        t.expectIllegal({ type: 'PassFocus', player: A }, 'not-your-decision');
      },
    },
  );

  scenario('rule 347.2.a: when all players have passed in sequence, the Showdown ends', {
    rules: ['347.2.a', '348'],
    setup: contested,
    check: (t) => {
      const target = battlefield(t.state, 0);
      t.act(
        move(A, unitsInBase(t.state, A), target),
        { type: 'PassFocus', player: A },
        { type: 'PassFocus', player: B },
      );
      t.expect(ofType(t.events, 'ShowdownEnded')).toMatchObject([
        { battlefield: target, rule: '348.2' },
      ]);
      t.expect(t.state.showdown).toBeNull();
      t.expectDecision({ kind: 'Priority', player: A });
    },
  });

  scenario(
    'rule 348.2.a: the only player with units at the battlefield establishes Control of it',
    {
      rules: ['348.2.a', '190.4', '190.3.b'],
      setup: contested,
      check: (t) => {
        const target = battlefield(t.state, 0);
        t.act(
          move(A, unitsInBase(t.state, A), target),
          { type: 'PassFocus', player: A },
          { type: 'PassFocus', player: B },
        );
        t.expect(ofType(t.events, 'ControlEstablished')).toMatchObject([
          { player: A, battlefield: target },
        ]);
        t.expect(t.state.battlefields[0]).toMatchObject({
          controller: A,
          contestedBy: null,
          showdownStaged: false,
        });
      },
    },
  );

  scenario(
    'rule 348.2.a.1: establishing Control is a Conquer when the player has not Scored it this turn',
    {
      rules: ['348.2.a.1', '471.1', '473.1'],
      setup: contested,
      check: (t) => {
        const target = battlefield(t.state, 0);
        t.act(
          move(A, unitsInBase(t.state, A), target),
          { type: 'PassFocus', player: A },
          { type: 'PassFocus', player: B },
        );
        t.expect(ofType(t.events, 'BattlefieldScored')).toMatchObject([
          { player: A, battlefield: target, method: 'conquer', rule: '471.1' },
        ]);
        t.expect(ofType(t.events, 'PointsGained')).toMatchObject([
          { player: A, total: 1, rule: '473.1' },
        ]);
        t.expect(t.player('A').scoredThisTurn).toEqual([target]);
      },
    },
  );

  scenario('rule 313.4: a player without Focus cannot act in a Showdown', {
    rules: ['313.4'],
    setup: contested,
    check: (t) => {
      t.act(move(A, unitsInBase(t.state, A) as ObjectId[], battlefield(t.state, 0)));
      t.expectIllegal({ type: 'PassFocus', player: B }, 'not-your-decision');
    },
  });
});
