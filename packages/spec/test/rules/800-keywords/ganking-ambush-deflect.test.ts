// Ganking (810), Ambush (822) and Deflect (809).

import { autoPayment, legalActions } from '@foilengine/rules';
import { board, scenario, testSetup } from '@foilengine/testkit';
import type { Action, CardId, Cost, GameState, ObjectId, PlayerId } from '@foilengine/types';
import { describe } from 'vitest';
import {
  A,
  act,
  B,
  battlefield,
  endTurn,
  inHand,
  move,
  ofType,
  unitsInBase,
  v,
} from '../../battlefields.ts';

const pass = (player: PlayerId): Action => ({ type: 'PassPriority', player });

const start = (handA: string[], handB: string[] = [v(1), v(2), v(3), v(4)]) =>
  board()
    .setup(testSetup({ withAbilities: true }))
    .firstPlayer('A')
    .player('A', { hand: handA, mainDeckTop: [v(5), v(6), v(7), v(8)] })
    .player('B', { hand: handB, mainDeckTop: [v(5), v(6), v(7), v(8)] })
    .afterMulligans()
    .build();

/** `player` plays `card` (a test card id) paying `cost` (its own by default) with autoPayment. */
function play(
  state: GameState,
  player: PlayerId,
  card: string,
  options: { targets?: ObjectId[]; to?: ObjectId; cost?: Cost } = {},
): Action {
  const object = inHand(state, player, card);
  const definition = state.cards[state.objects[object]?.card as CardId];
  const cost = options.cost ?? definition?.cost;
  const payment = cost === undefined ? null : autoPayment(state, player, cost);
  if (payment === null) throw new Error(`${player} cannot pay for ${card}`);
  return {
    type: 'PlayCard',
    player,
    card: object,
    payment,
    ...(options.targets === undefined ? {} : { targets: options.targets }),
    ...(definition?.category === 'unit'
      ? {
          location:
            options.to === undefined
              ? { kind: 'base' as const }
              : { kind: 'battlefield' as const, battlefield: options.to },
        }
      : {}),
  };
}

function playAll(state: GameState, player: PlayerId, cards: string[]): GameState {
  return cards.reduce((current, card) => act(current, play(current, player, card)).state, state);
}

/** The unit of `card` (a test card id) on the board: in a base or at a battlefield. */
const unit = (state: GameState, card: string) =>
  [
    ...state.players.flatMap((p) => p.zones.base),
    ...state.battlefields.flatMap((b) => b.units),
  ].find((id) => state.objects[id]?.card === card) as ObjectId;

describe('810 Ganking', () => {
  scenario('rule 810.1.b: a unit with Ganking may move from a battlefield to another', {
    rules: ['810.1.b', '810', '810.1', '810.1.a', '810.1.c', '810.3', '144.4.c', '144.4.c.1'],
    // Turn 1: Ganker and Vanilla 1. Turn 3: both conquer the first battlefield. Turn 5.
    setup: () => {
      let state = playAll(start(['Ganker', v(1), v(2), v(3)]), A, [
        'test:ganker',
        'test:vanilla-1',
      ]);
      state = endTurn(endTurn(state).state).state;
      state = act(
        state,
        move(A, unitsInBase(state, A), battlefield(state, 0)),
        { type: 'PassFocus', player: A },
        { type: 'PassFocus', player: B },
      ).state;
      return endTurn(endTurn(state).state).state;
    },
    check: (t) => {
      const ganker = unit(t.state, 'test:ganker');
      const vanilla = unit(t.state, 'test:vanilla-1');
      const to = battlefield(t.state, 1);
      // Without Ganking, a unit at a battlefield can only move to its base (144.4.b).
      t.expect(t.actIllegal(move(A, [vanilla], to), 'invalid-move').rule).toBe('144.4.a');
      t.expectLegal(move(A, [ganker], to));
      t.act(move(A, [ganker], to));
      t.expect(ofType(t.events, 'UnitsMoved')).toMatchObject([
        { units: [ganker], battlefield: to },
      ]);
      t.expect(t.state.battlefields[1]?.units).toContain(ganker);
    },
  });
});

describe('822 Ambush', () => {
  scenario(
    'rule 822.1.b: a unit with Ambush may be played, with Reaction, to a battlefield where you control units',
    {
      rules: ['822.1.b', '822', '822.1', '822.1.a', '822.1.c', '822.4', '355.2.b'],
      // Turn 1: Vanilla 1. Turn 3: it moves to the first battlefield: a Showdown starts there.
      setup: () => {
        let state = playAll(start([v(1), 'Ambusher', v(2), v(3)]), A, ['test:vanilla-1']);
        state = endTurn(endTurn(state).state).state;
        return act(state, move(A, unitsInBase(state, A), battlefield(state, 0))).state;
      },
      check: (t) => {
        t.expect(t.state.showdown).not.toBeNull();
        t.expect(t.state.battlefields[0]?.controller).toBeNull();
        // Not where A has no units, and not a unit without Ambush.
        t.expect(
          t.actIllegal(
            play(t.state, A, 'test:ambusher', { to: battlefield(t.state, 1) }),
            'invalid-location',
          ).rule,
        ).toBe('355.2.a');
        t.actIllegal(
          play(t.state, A, 'test:vanilla-2', { to: battlefield(t.state, 0) }),
          'invalid-location',
        );
        t.act(play(t.state, A, 'test:ambusher', { to: battlefield(t.state, 0) }));
        t.expect(t.state.battlefields[0]?.units).toContain(unit(t.state, 'test:ambusher'));
      },
    },
  );
});

describe('809 Deflect', () => {
  scenario(
    "rule 809.1.c: an opponent's spell that targets a unit with Deflect costs [A] more per Deflect",
    {
      rules: [
        '809.1.c',
        '809',
        '809.1',
        '809.1.a',
        '809.1.b',
        '809.1.b.1',
        '809.1.b.2',
        '809.1.c.1',
        '809.3',
        '356.2.a.2',
      ],
      // B plays Warder (Deflect 1) on turn 2; A has Bolt on turn 3.
      setup: () => {
        let state = endTurn(start([v(1), 'Bolt', v(2), v(3)], ['Warder', v(1), v(2), v(3)])).state;
        state = playAll(state, B, ['test:warder']);
        return endTurn(state).state;
      },
      check: (t) => {
        const warder = unit(t.state, 'test:warder');
        // The printed cost alone does not pay for it.
        t.expectIllegal(play(t.state, A, 'test:bolt', { targets: [warder] }));
        t.act(
          play(t.state, A, 'test:bolt', {
            targets: [warder],
            cost: { energy: 1, power: ['any'] },
          }),
        );
        const [paid] = ofType(t.events, 'ResourcesPaid');
        t.expect(paid?.resources.energy).toBe(1);
        t.expect(Object.values(paid?.resources.power ?? {}).reduce((a, b) => a + b, 0)).toBe(1);
      },
    },
  );

  scenario("rule 809.1.d: Deflect does not apply to its controller's own spells", {
    rules: ['809.1.d'],
    // Turn 1: A plays Warder. Turn 3: Bless, "Buff a friendly unit", on it for its printed cost.
    setup: () => {
      const state = playAll(start(['Warder', 'Bless', v(1), v(2)]), A, ['test:warder']);
      return endTurn(endTurn(state).state).state;
    },
    check: (t) => {
      const warder = unit(t.state, 'test:warder');
      t.act(play(t.state, A, 'test:bless', { targets: [warder] }), pass(A), pass(B));
      t.expect(ofType(t.events, 'UnitBuffed')).toMatchObject([{ unit: warder }]);
    },
  });

  scenario(
    "rule 401: an opponent's triggered ability that chooses a unit with Deflect pays its cost to finalize",
    {
      rules: ['401', '400', '401.1', '383.3.b.1'],
      // B plays Warder on turn 2. Turn 3: A plays Sniper, "When you play me, deal 1 to an enemy
      // unit": Warder is the only enemy unit.
      setup: () => {
        let state = endTurn(
          start(['Sniper', v(1), v(2), v(3)], ['Warder', v(1), v(2), v(3)]),
        ).state;
        state = playAll(state, B, ['test:warder']);
        state = endTurn(state).state;
        return act(state, play(state, A, 'test:sniper')).state;
      },
      check: (t) => {
        const warder = unit(t.state, 'test:warder');
        t.expectDecision({ kind: 'FinalizeAbility', player: A });
        const choices = legalActions(t.state, A).filter((a) => a.type === 'FinalizeAbility');
        t.expect(choices.length).toBeGreaterThan(0);
        for (const choice of choices) {
          t.expect(choice).toMatchObject({ perform: true, targets: [warder] });
          t.expect(
            choice.type === 'FinalizeAbility' && (choice.payment ?? []).length,
          ).toBeGreaterThan(0);
        }
        t.expect(
          t.actIllegal(
            { type: 'FinalizeAbility', player: A, perform: true, targets: [warder] },
            'cannot-pay',
          ).rule,
        ).not.toBeNull();
        t.act(choices[0] as Action);
        t.expect(ofType(t.events, 'ChainItemFinalized')).toHaveLength(1);
      },
    },
  );
});
