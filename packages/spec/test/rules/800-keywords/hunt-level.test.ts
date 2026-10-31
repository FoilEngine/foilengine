// XP (728–733), Hunt (823), Level (824) and Dependent Keywords (726, 727).

import { autoPayment, characteristics, viewFor } from '@foilengine/rules';
import { board, scenario, testSetup } from '@foilengine/testkit';
import type { Action, CardId, GameState, ObjectId, PlayerId } from '@foilengine/types';
import { describe } from 'vitest';
import { A, act, B, battlefield, endTurn, inHand, move, ofType, v } from '../../battlefields.ts';

const pass = (player: PlayerId): Action => ({ type: 'PassPriority', player });

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
  return { type: 'PlayCard', player, card: object, payment, location: { kind: 'base' } };
}

function playAll(state: GameState, player: PlayerId, cards: string[]): GameState {
  return cards.reduce((current, card) => act(current, play(current, player, card)).state, state);
}

/** The unit of `card` (a test card id) on the board. */
const unit = (state: GameState, card: string) =>
  [
    ...state.players.flatMap((p) => p.zones.base),
    ...state.battlefields.flatMap((b) => b.units),
  ].find((id) => state.objects[id]?.card === card) as ObjectId;

const xpOf = (state: GameState, player: PlayerId) => state.players.find((p) => p.id === player)?.xp;

/** Turn 3: Tracker (Hunt 1), played on turn 1, conquers the first battlefield; its ability resolves. */
function conquerWithTracker(state: GameState): GameState {
  const tracker = unit(state, 'test:tracker');
  return act(
    state,
    move(A, [tracker], battlefield(state, 0)),
    { type: 'PassFocus', player: A },
    { type: 'PassFocus', player: B },
    pass(A),
    pass(B),
  ).state;
}

describe('823 Hunt, 728 XP', () => {
  scenario('rule 823.1.c.1: when a unit with Hunt conquers or holds, its controller gains XP', {
    rules: [
      '823.1.c.1',
      '823',
      '823.1',
      '823.1.a',
      '823.1.b',
      '823.1.c',
      '823.1.c.3',
      '823.3',
      '728',
      '729',
      '729.1',
      '729.2',
      '730',
      '730.1',
    ],
    setup: () => {
      const state = playAll(start(['Tracker', v(1), v(2), v(3)]), A, ['test:tracker']);
      return endTurn(endTurn(state).state).state;
    },
    check: (t) => {
      t.expect(characteristics(t.state, unit(t.state, 'test:tracker')).hunt).toBe(1);
      t.expect(xpOf(t.state, A)).toBe(0);
      const tracker = unit(t.state, 'test:tracker');
      t.act(
        move(A, [tracker], battlefield(t.state, 0)),
        { type: 'PassFocus', player: A },
        { type: 'PassFocus', player: B },
        pass(A),
        pass(B),
      );
      t.expect(ofType(t.events, 'XpGained')).toMatchObject([{ player: A, amount: 1, xp: 1 }]);
      // XP is public.
      t.expect(viewFor(t.state, B).opponents[0]?.xp).toBe(1);
      // Turn 5: A holds the battlefield.
      t.act({ type: 'EndTurn', player: A }, { type: 'EndTurn', player: B }, pass(A), pass(B));
      t.expect(xpOf(t.state, A)).toBe(2);
    },
  });
});

describe('824 Level, 727 Dependent Keywords', () => {
  scenario(
    'rule 824.1.c: a Level ability is Active while its controller has N XP: a passive one applies',
    {
      rules: [
        '824.1.c',
        '824',
        '824.1',
        '824.1.a',
        '824.1.b',
        '824.1.b.1',
        '824.1.b.2',
        '824.2',
        '726',
        '727',
        '727.1',
        '727.1.a',
        '727.1.b',
        '727.1.b.2',
        '727.1.c',
        '727.1.c.2',
      ],
      // Turn 1: Tracker and Veteran, "[Level 1][>] I have +2 [M]".
      setup: () => {
        const state = playAll(start(['Tracker', 'Veteran', v(1), v(2)]), A, [
          'test:tracker',
          'test:veteran',
        ]);
        return endTurn(endTurn(state).state).state;
      },
      check: (t) => {
        const veteran = unit(t.state, 'test:veteran');
        t.expect(characteristics(t.state, veteran)).toMatchObject({
          might: 1,
          keywords: ['level'],
        });
        const after = conquerWithTracker(t.state);
        t.expect(xpOf(after, A)).toBe(1);
        t.expect(characteristics(after, veteran).might).toBe(3);
      },
    },
  );

  scenario(
    'rule 727.1.c.1: a triggered Level ability triggers, and an activated one is activated, only while Active',
    {
      rules: ['727.1.c.1', '727.1.c.3'],
      // Turn 1: Tracker and Mentor, "[Level 1][>] When you play me, draw 1." and
      // "[Level 1][>] [1], [E]: Draw 1." With 0 XP, nothing triggers.
      setup: () => {
        const state = playAll(start(['Tracker', 'Mentor', 'Mentor', v(1)]), A, [
          'test:tracker',
          'test:mentor',
        ]);
        return endTurn(endTurn(state).state).state;
      },
      check: (t) => {
        const mentor = unit(t.state, 'test:mentor');
        const activate = (state: GameState): Action => ({
          type: 'ActivateAbility',
          player: A,
          source: mentor,
          ability: 1,
          payment: autoPayment(state, A, { energy: 1, power: [] }) ?? [],
        });
        t.expect(t.actIllegal(activate(t.state), 'invalid-source').rule).toBe('727.1.b');
        const tracker = unit(t.state, 'test:tracker');
        t.act(
          move(A, [tracker], battlefield(t.state, 0)),
          { type: 'PassFocus', player: A },
          { type: 'PassFocus', player: B },
          pass(A),
          pass(B),
        );
        t.expect(xpOf(t.state, A)).toBe(1);
        // With 1 XP, the activated ability can be activated…
        t.expectLegal(activate(t.state));
        // …and the second Mentor's ability triggers as it is played.
        t.act(play(t.state, A, 'test:mentor'));
        t.expect(ofType(t.events, 'AbilityAdded')).toMatchObject([{ triggered: true }]);
      },
    },
  );
});
