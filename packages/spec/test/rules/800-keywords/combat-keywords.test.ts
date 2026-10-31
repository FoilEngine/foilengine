// Combat keywords: Assault (807), Shield (814), Tank (815), Backline (826), and the order of
// combat damage assignment they impose (467.2.c.6–467.2.c.8).

import { autoPayment, characteristics } from '@foilengine/rules';
import { board, scenario, testSetup } from '@foilengine/testkit';
import type { Action, GameState, ObjectId, PlayerId } from '@foilengine/types';
import { describe } from 'vitest';
import {
  A,
  act,
  B,
  battlefield,
  endTurn,
  inHand,
  move,
  unitsInBase,
  v,
} from '../../battlefields.ts';

/** Plays unit `card` (a test card id) from the hand to the base, paid with autoPayment. */
function play(state: GameState, player: PlayerId, card: string): GameState {
  const object = inHand(state, player, card);
  const cost = state.cards[state.objects[object]?.card as never]?.cost;
  const payment = cost === undefined ? null : autoPayment(state, player, cost);
  if (payment === null) throw new Error(`${player} cannot pay for ${card}`);
  return act(state, { type: 'PlayCard', player, card: object, payment, location: { kind: 'base' } })
    .state;
}

/**
 * A plays `defenders` on turn 1 and conquers the first battlefield with them on turn 3; B plays
 * `attackers` on turn 2 and attacks with them on turn 4. Both pass the Combat Showdown: B, the
 * Attacker, must assign combat damage.
 */
function damageStep(defenders: [string, string], attackers: string[]): GameState {
  let state = board()
    .setup(testSetup({ withAbilities: true }))
    .firstPlayer('A')
    .player('A', { hand: [...defenders, v(3), v(4)], mainDeckTop: [v(5), v(6)] })
    .player('B', {
      hand: [...attackers, ...[v(6), v(7), v(8)].slice(0, 4 - attackers.length)],
      mainDeckTop: [v(9), v(10)],
    })
    .afterMulligans()
    .build();
  const id = (card: string) => `test:${card.toLowerCase().replace(' ', '-')}`;
  for (const card of defenders) state = play(state, A, id(card));
  state = endTurn(state).state;
  for (const card of attackers) state = play(state, B, id(card));
  state = endTurn(state).state;
  state = act(
    state,
    move(A, unitsInBase(state, A), battlefield(state, 0)),
    { type: 'PassFocus', player: A },
    { type: 'PassFocus', player: B },
  ).state;
  state = endTurn(state).state;
  return act(
    state,
    move(B, unitsInBase(state, B), battlefield(state, 0)),
    { type: 'PassFocus', player: B },
    { type: 'PassFocus', player: A },
  ).state;
}

const assign = (assignment: { unit: ObjectId; amount: number }[]): Action => ({
  type: 'AssignCombatDamage',
  player: B,
  assignment,
});

const defending = (state: GameState, card: string) =>
  (state.combat?.defenders ?? []).find((u) => state.objects[u]?.card === card) as ObjectId;

describe('807 Assault, 814 Shield', () => {
  scenario('rule 807.1.c: a unit with Assault has +X [M] while it is an attacker', {
    rules: [
      '807.1.c',
      '807',
      '807.1',
      '807.1.a',
      '807.1.b',
      '807.1.b.2',
      '807.1.d',
      '807.1.d.1',
      '807.3',
    ],
    // B's Bruiser (Might 2, Assault 2) attacks A's Vanilla 1 and Archer.
    setup: () => damageStep(['Vanilla 1', 'Archer'], ['Bruiser']),
    check: (t) => {
      const [bruiser] = t.state.combat?.attackers ?? [];
      t.expect(characteristics(t.state, bruiser as ObjectId)).toMatchObject({
        might: 4,
        assault: 2,
      });
      t.expectDecision({ kind: 'AssignDamage', player: B, amount: 4 });
    },
  });

  scenario('rule 814.1.c: a unit with Shield has +X [M] while it is a defender', {
    rules: [
      '814.1.c',
      '814',
      '814.1',
      '814.1.a',
      '814.1.b',
      '814.1.b.2',
      '814.1.d',
      '814.1.d.1',
      '814.3',
    ],
    // A's Wall (Might 2, Shield 2) defends with Vanilla 1; B attacks with Vanilla 3 (Might 3).
    setup: () => damageStep(['Wall', 'Vanilla 1'], [v(3)]),
    check: (t) => {
      const wall = defending(t.state, 'test:wall');
      t.expect(characteristics(t.state, wall)).toMatchObject({ might: 4, shield: 2 });
      // B assigns 3: lethal for Wall is now 4, so it survives even with all of it.
      const vanilla = defending(t.state, 'test:vanilla-1');
      t.act(
        assign([
          { unit: vanilla, amount: 1 },
          { unit: wall, amount: 2 },
        ]),
      );
      t.expectDecision({ kind: 'AssignDamage', player: A, amount: 5 });
    },
  });
});

describe('815 Tank, 826 Backline, 467.2.c.6 order of assignment', () => {
  // In each case B attacks with Vanilla 2 (Might 2): not enough to kill both defenders.

  scenario(
    "rule 815.1.b: a unit with Tank gets lethal damage before its controller's other units",
    {
      rules: ['815.1.b', '815', '815.1', '815.1.a', '815.1.c', '815.1.c.1', '815.3', '467.2.c.6'],
      setup: () => damageStep(['Guardian', 'Vanilla 1'], [v(2)]),
      check: (t) => {
        const guardian = defending(t.state, 'test:guardian');
        const vanilla = defending(t.state, 'test:vanilla-1');
        t.expect(characteristics(t.state, guardian).keywords).toEqual(['tank']);
        // Without Tank, killing Vanilla 1 and damaging Guardian would be legal (467.2.c.3).
        const reason = t.actIllegal(
          assign([
            { unit: vanilla, amount: 1 },
            { unit: guardian, amount: 1 },
          ]),
          'invalid-assignment',
        );
        t.expect(reason.rule).toBe('467.2.c.6');
        t.act(assign([{ unit: guardian, amount: 2 }]));
      },
    },
  );

  scenario('rule 815.1.c.2: with several units with Tank, damage may go to any of them first', {
    rules: ['815.1.c.2', '467.2.c.7'],
    setup: () => damageStep(['Guardian', 'Guardian'], [v(2)]),
    check: (t) => {
      const [first, second] = t.state.combat?.defenders ?? [];
      t.expectLegal(assign([{ unit: first as ObjectId, amount: 2 }]));
      t.expectLegal(assign([{ unit: second as ObjectId, amount: 2 }]));
    },
  });

  scenario(
    "rule 826.3: a unit with Backline gets lethal damage after its controller's other units",
    {
      rules: ['826.3', '826', '826.1', '826.2', '826.4', '826.4.a', '826.6'],
      setup: () => damageStep(['Archer', 'Vanilla 1'], [v(2)]),
      check: (t) => {
        const archer = defending(t.state, 'test:archer');
        const vanilla = defending(t.state, 'test:vanilla-1');
        t.expect(characteristics(t.state, archer).keywords).toEqual(['backline']);
        t.expect(
          t.actIllegal(assign([{ unit: archer, amount: 2 }]), 'invalid-assignment').rule,
        ).toBe('467.2.c.6');
        t.act(
          assign([
            { unit: vanilla, amount: 1 },
            { unit: archer, amount: 1 },
          ]),
        );
      },
    },
  );

  scenario(
    'rule 467.2.c.8: a unit with Tank and Backline is assigned damage first or last, as the player chooses',
    {
      rules: ['467.2.c.8'],
      setup: () => damageStep(['Fickle', 'Vanilla 1'], [v(2)]),
      check: (t) => {
        const fickle = defending(t.state, 'test:fickle');
        const vanilla = defending(t.state, 'test:vanilla-1');
        // First, as with Tank; or last, as with Backline.
        t.expectLegal(assign([{ unit: fickle, amount: 2 }]));
        t.expectLegal(
          assign([
            { unit: vanilla, amount: 1 },
            { unit: fickle, amount: 1 },
          ]),
        );
      },
    },
  );
});
