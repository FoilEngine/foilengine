// Characteristics and layers (475–482): Might changed by continuous effects (476, 479.4), passive
// abilities (363–365) and buffs (701–705). Might (143.2).

import { autoPayment, characteristics, mightOf, viewFor } from '@foilengine/rules';
import { board, scenario, testSetup } from '@foilengine/testkit';
import type { Action, GameState, ObjectId, PlayerId } from '@foilengine/types';
import { describe } from 'vitest';
import { A, act, B, endTurn, inHand, ofType, unitsInBase, v } from '../../battlefields.ts';

const pass = (player: PlayerId): Action => ({ type: 'PassPriority', player });

/** Plays `card` (a test card id) from the hand, paid with autoPayment; spells resolve at once. */
function play(state: GameState, player: PlayerId, card: string, targets?: ObjectId[]): GameState {
  const object = inHand(state, player, card);
  const definition = state.cards[state.objects[object]?.card as never];
  const payment =
    definition?.cost === undefined ? null : autoPayment(state, player, definition.cost);
  if (payment === null) throw new Error(`${player} cannot pay for ${card}`);
  const action: Action = {
    type: 'PlayCard',
    player,
    card: object,
    payment,
    ...(targets === undefined ? {} : { targets }),
    ...(definition?.category === 'unit' ? { location: { kind: 'base' as const } } : {}),
  };
  const played = act(state, action).state;
  const other = player === A ? B : A;
  return definition?.category === 'spell' ? act(played, pass(player), pass(other)).state : played;
}

/** A goes first; both decks hold spells (two of each), or spells and units with abilities. */
const start = (handA: string[], handB: string[], deck: 'spells' | 'abilities' = 'spells') =>
  board()
    .setup(testSetup(deck === 'spells' ? { withSpells: true } : { withAbilities: true }))
    .firstPlayer('A')
    .player('A', { hand: handA, mainDeckTop: [v(5), v(6), v(7), v(8)] })
    .player('B', { hand: handB, mainDeckTop: [v(5), v(6), v(7), v(8)] })
    .afterMulligans()
    .build();

const unit = (state: GameState, player: PlayerId, card: string) =>
  unitsInBase(state, player).find((u) => state.objects[u]?.card === card) as ObjectId;

describe('475–482 Layers: Might', () => {
  scenario(
    'rule 479.4: a spell gives a unit +2 [M] this turn; the effect expires at the end of the turn',
    {
      rules: ['479.4', '479.4.a', '476', '477', '479', '317.2.c', '143.2.a'],
      setup: () => start([v(1), 'Rally', v(2), v(3)], [v(1), v(2), v(3), v(4)]),
      check: (t) => {
        let state = play(t.state, A, 'test:vanilla-1');
        const vanilla = unit(state, A, 'test:vanilla-1');
        state = play(state, A, 'test:rally', [vanilla]);
        // Printed Might 1, Effective Might 3: what the view shows too (143.2.a).
        t.expect(characteristics(state, vanilla).might).toBe(3);
        t.expect(
          viewFor(state, B).opponents[0]?.zones.base.find((o) => o.id === vanilla)?.might,
        ).toBe(3);
        const ended = endTurn(state);
        t.expect(ofType(ended.events, 'EffectsExpired')).toMatchObject([
          { count: 1, rule: '317.2.c' },
        ]);
        t.expect(characteristics(ended.state, vanilla).might).toBe(1);
      },
    },
  );

  scenario("rule 143.2.c: below 0, a unit's Might is treated as 0, though it is not 0", {
    rules: ['143.2.c', '143.2.c.1'],
    setup: () => start([v(1), 'Wither', v(2), v(3)], [v(1), v(2), v(3), v(4)]),
    check: (t) => {
      let state = play(t.state, A, 'test:vanilla-1');
      const vanilla = unit(state, A, 'test:vanilla-1');
      state = play(state, A, 'test:wither', [vanilla]);
      t.expect(characteristics(state, vanilla).might).toBe(-1);
      t.expect(mightOf(state, vanilla)).toBe(0);
      // Not killed: its damage is 0, and lethal damage is non-zero (142.4.b).
      t.expect(state.objects[vanilla]).toBeDefined();
    },
  });

  scenario(
    'rule 142.4.b: a unit whose Might drops to its damage or less dies in the next cleanup',
    {
      rules: ['142.4.b', '143.2.b'],
      // B plays Vanilla 3 (Might 3) on turn 2; A's turn 3: Bolt deals 2 to it, then Wither.
      setup: () => {
        let state = start([v(1), 'Bolt', 'Wither', v(2)], [v(3), v(1), v(2), v(4)]);
        state = endTurn(state).state;
        state = play(state, B, 'test:vanilla-3');
        return endTurn(state).state;
      },
      check: (t) => {
        const target = unit(t.state, B, 'test:vanilla-3');
        let state = play(t.state, A, 'test:bolt', [target]);
        t.expect(state.objects[target]?.damage).toBe(2);
        const before = state;
        const object = inHand(before, A, 'test:wither');
        const payment = autoPayment(before, A, { energy: 1, power: [] }) ?? [];
        const played = act(before, {
          type: 'PlayCard',
          player: A,
          card: object,
          payment,
          targets: [target],
        });
        const resolved = act(played.state, pass(A), pass(B));
        t.expect(ofType(resolved.events, 'UnitKilled')).toMatchObject([{ unit: target }]);
        state = resolved.state;
        t.expect(state.objects[target]).toBeUndefined();
      },
    },
  );
});

describe('701–705 Buffs', () => {
  scenario('rule 702.2.a: a buffed unit has +1 [M] for its buff, and never more than one buff', {
    rules: ['702.2.a', '701', '702', '702.2', '702.3', '702.3.a', '703'],
    // Turn 1: Vanilla 1 and Bless on it; turn 3: Bless again.
    setup: () => {
      let state = start([v(1), 'Bless', 'Bless', v(2)], [v(1), v(2), v(3), v(4)]);
      state = play(state, A, 'test:vanilla-1');
      state = play(state, A, 'test:bless', [unit(state, A, 'test:vanilla-1')]);
      return endTurn(endTurn(state).state).state;
    },
    check: (t) => {
      const vanilla = unit(t.state, A, 'test:vanilla-1');
      t.expect(t.state.objects[vanilla]?.buffs).toBe(1);
      t.expect(characteristics(t.state, vanilla).might).toBe(2);
      const object = inHand(t.state, A, 'test:bless');
      const payment = autoPayment(t.state, A, { energy: 1, power: [] }) ?? [];
      t.act(
        { type: 'PlayCard', player: A, card: object, payment, targets: [vanilla] },
        pass(A),
        pass(B),
      );
      t.expect(ofType(t.events, 'UnitBuffed')).toEqual([]);
      t.expect(t.state.objects[vanilla]?.buffs).toBe(1);
    },
  });

  scenario('rule 705: a unit that leaves play loses its buffs', {
    rules: ['705'],
    // Turn 1: Vanilla 1; turn 3: Bless on it, then Bolt (2 damage) kills it.
    setup: () => {
      let state = start([v(1), 'Bless', 'Bolt', v(2)], [v(1), v(2), v(3), v(4)]);
      state = play(state, A, 'test:vanilla-1');
      return endTurn(endTurn(state).state).state;
    },
    check: (t) => {
      const vanilla = unit(t.state, A, 'test:vanilla-1');
      let state = play(t.state, A, 'test:bless', [vanilla]);
      t.expect(characteristics(state, vanilla).might).toBe(2);
      state = play(state, A, 'test:bolt', [vanilla]);
      const [dead] =
        state.players
          .find((p) => p.id === A)
          ?.zones.trash.filter((id) => state.objects[id]?.card === 'test:vanilla-1') ?? [];
      t.expect(state.objects[dead as ObjectId]?.buffs).toBe(0);
    },
  });
});

describe('363–365 Passive abilities', () => {
  scenario('rule 365.1: a passive ability of a permanent applies while it is on the board', {
    rules: ['365.1', '363', '364', '364.2', '365'],
    // Turn 1: Banner; turn 3: Vanilla 1, then Bolt kills Banner.
    setup: () => {
      let state = start(['Banner', v(1), 'Bolt', v(2)], [v(1), v(2), v(3), v(4)], 'abilities');
      state = play(state, A, 'test:banner');
      state = endTurn(endTurn(state).state).state;
      return play(state, A, 'test:vanilla-1');
    },
    check: (t) => {
      const banner = unit(t.state, A, 'test:banner');
      const vanilla = unit(t.state, A, 'test:vanilla-1');
      // "Other friendly units have +1 [M]": not Banner itself.
      t.expect(characteristics(t.state, vanilla).might).toBe(2);
      t.expect(characteristics(t.state, banner).might).toBe(1);
      const state = play(t.state, A, 'test:bolt', [banner]);
      t.expect(state.objects[banner]).toBeUndefined();
      t.expect(characteristics(state, vanilla).might).toBe(1);
    },
  });
});

describe('317.2.b Healing at the end of the turn', () => {
  scenario('rule 317.2.b: units are healed in the Expiration Step', {
    rules: ['317.2.b', '143.3.b', '143.3.b.1'],
    // B plays Vanilla 3 (Might 3) on turn 2; A's turn 3: Bolt deals 2 to it, and it survives.
    setup: () => {
      let state = start([v(1), 'Bolt', v(2), v(3)], [v(3), v(1), v(2), v(4)]);
      state = endTurn(state).state;
      state = play(state, B, 'test:vanilla-3');
      return endTurn(state).state;
    },
    check: (t) => {
      const target = unit(t.state, B, 'test:vanilla-3');
      const state = play(t.state, A, 'test:bolt', [target]);
      t.expect(state.objects[target]?.damage).toBe(2);
      const ended = endTurn(state);
      t.expect(ofType(ended.events, 'UnitsHealed')).toMatchObject([
        { units: [target], rule: '317.2.b' },
      ]);
      t.expect(ended.state.objects[target]?.damage).toBe(0);
    },
  });
});
