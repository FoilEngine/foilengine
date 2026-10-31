// The Chain (325–340), spells (153–159) and their timing: Action (806) and Reaction (813).

import { autoPayment } from '@foilengine/rules';
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
  ofType,
  unitsInBase,
  v,
} from '../../battlefields.ts';

/** Plays `card` (a test card id) from `player`'s hand, paid with autoPayment. */
function play(
  state: GameState,
  player: PlayerId,
  card: string,
  options: { targets?: ObjectId[]; location?: 'base' } = {},
): Action {
  const object = inHand(state, player, card);
  const cost = state.cards[state.objects[object]?.card as never]?.cost;
  const payment = cost === undefined ? null : autoPayment(state, player, cost);
  if (payment === null) throw new Error(`${player} cannot pay for ${card}`);
  return {
    type: 'PlayCard',
    player,
    card: object,
    payment,
    ...(options.targets === undefined ? {} : { targets: options.targets }),
    ...(options.location === undefined ? {} : { location: { kind: 'base' } }),
  };
}

const pass = (player: PlayerId): Action => ({ type: 'PassPriority', player });

/**
 * Both decks hold spells. A goes first with Vanilla 1, Insight, Bolt and Vanilla 2; B holds
 * Snap, Insight, Vanilla 1 and Vanilla 2. Returns A's turn 3, Main Phase: A has 4 runes,
 * B has 3, all ready; A played Vanilla 1 on turn 1, it is ready now.
 */
function turnThree(): GameState {
  let state = board()
    .setup(testSetup({ withSpells: true }))
    .firstPlayer('A')
    .player('A', { hand: [v(1), 'Insight', 'Bolt', v(2)], mainDeckTop: [v(3), v(4), v(5)] })
    .player('B', { hand: ['Snap', 'Insight', v(1), v(2)], mainDeckTop: [v(3), v(4)] })
    .afterMulligans()
    .build();
  state = act(state, play(state, A, 'test:vanilla-1', { location: 'base' })).state;
  return endTurn(endTurn(state).state).state;
}

/** turnThree, then A plays Insight: it waits on the Chain, A has Priority. */
const insightOnChain = () => {
  const state = turnThree();
  return act(state, play(state, A, 'test:insight')).state;
};

describe('327–340 The Chain', () => {
  scenario(
    'rule 354: a played spell goes on the Chain; once finalized it waits there, and its controller gains Priority',
    {
      rules: [
        '354',
        '354.1',
        '328',
        '329',
        '329.1',
        '329.3',
        '359.1',
        '359.3',
        '359.3.a',
        '337.1.a',
        '337.4',
        '312.2.c',
        '330',
        '329.2',
        '331',
        '331.1',
        '309.1',
        '310.2',
        '155',
      ],
      setup: turnThree,
      check: (t) => {
        const card = inHand(t.state, A, 'test:insight');
        t.act(play(t.state, A, 'test:insight'));
        const [added] = ofType(t.events, 'ChainItemAdded');
        t.expect(added).toMatchObject({ player: A, previousObject: card, card: 'test:insight' });
        t.expect(ofType(t.events, 'ChainItemFinalized')).toMatchObject([{ object: added?.object }]);
        // 329.2: Pending until legality is checked, after the payment.
        const types = t.events.map((e) => e.type);
        t.expect(types.indexOf('ChainItemAdded')).toBeLessThan(types.indexOf('ResourcesPaid'));
        t.expect(types.indexOf('ResourcesPaid')).toBeLessThan(types.indexOf('ChainItemFinalized'));
        t.expect(t.state.chain).toEqual({
          items: [
            {
              object: added?.object,
              controller: A,
              status: 'finalized',
              targets: [],
              ability: null,
            },
          ],
          priority: A,
          passes: 0,
          triggered: false,
        });
        // Nothing resolved yet: no card was drawn.
        t.expect(ofType(t.events, 'CardDrawn')).toEqual([]);
        t.expectDecision({ kind: 'Priority', player: A, rule: '312.2.c' });
      },
    },
  );

  scenario(
    'rule 331.1.a: in a Closed State, cards without Reaction cannot be played, units cannot move and the turn cannot end',
    {
      rules: ['331.1.a', '309.1.a', '338.1.a.1', '144.1.b', '305'],
      setup: insightOnChain,
      check: (t) => {
        const [unit] = unitsInBase(t.state, A) as [ObjectId];
        t.expect(
          t.actIllegal(play(t.state, A, 'test:vanilla-2', { location: 'base' }), 'wrong-timing')
            .rule,
        ).toBe('309.1.a');
        t.expect(t.actIllegal(move(A, [unit], battlefield(t.state, 0)), 'wrong-timing').rule).toBe(
          '144.1.b',
        );
        t.expect(t.actIllegal({ type: 'EndTurn', player: A }, 'wrong-timing').rule).toBe('305');
      },
    },
  );

  scenario(
    'rule 339.1: when every player has passed Priority in sequence, the newest item resolves',
    {
      rules: [
        '339.1',
        '339.2',
        '338.1.b',
        '338.1.b.1',
        '312.2.d',
        '340.1',
        '340.2',
        '331.2',
        '309.2',
        '156',
        '157',
        '158',
        '158.1',
        '414.2.b',
        '335',
        '338',
        '339',
        '340',
      ],
      setup: insightOnChain,
      check: (t) => {
        // A passes: B, next in turn order, gains Priority (339.2, 312.2.d).
        t.act(pass(A));
        t.expect(ofType(t.events, 'PriorityPassed')).toMatchObject([{ player: A, next: B }]);
        t.expectDecision({ kind: 'Priority', player: B, rule: '312.2.d' });
        const hand = t.player('A').zones.hand.length;
        // B passes too: everyone passed in sequence, Insight resolves: its controller draws 1.
        t.act(pass(B));
        t.expect(ofType(t.events, 'CardDrawn')).toMatchObject([{ player: A, rule: '414.2.b' }]);
        const [resolved] = ofType(t.events, 'ChainItemResolved');
        t.expect(resolved).toMatchObject({ player: A, card: 'test:insight', rule: '340.1' });
        // 157: the spell goes to its owner's trash; 340.2: the Chain is gone, the turn is Open.
        t.expect(t.player('A').zones.trash).toContain(resolved?.trashed);
        t.expect(t.player('A').zones.hand).toHaveLength(hand + 1);
        t.expect(t.state.chain).toBeNull();
        // 335: no Chain, Main Phase: the Turn Player has Priority again.
        t.expectDecision({ kind: 'Priority', player: A, rule: '312.2.a' });
      },
    },
  );

  scenario(
    "rule 813.1.c.1: a Reaction can be played on a Chain, on another player's turn, and resolves first",
    {
      rules: [
        '813.1.c.1',
        '813',
        '813.1',
        '813.1.b',
        '813.1.c',
        '159.2.b',
        '159.2.b.2',
        '159.2.b.3',
        '338.1.a',
        '338.1.a.2',
        '338.1.a.4',
        '338.1.a.7',
        '330.2',
        '330.1',
        '340.4',
        '418.1.b',
        '321.1',
        '326',
        '326.1',
      ],
      setup: () => act(insightOnChain(), pass(A)).state,
      check: (t) => {
        // B has Priority on A's turn: B plays Snap on A's Vanilla 1 (Might 1).
        const [unit] = unitsInBase(t.state, A) as [ObjectId];
        t.act(play(t.state, B, 'test:snap', { targets: [unit] }));
        t.expect(t.state.chain?.items.map((i) => i.controller)).toEqual([A, B]);
        t.expectDecision({ kind: 'Priority', player: B });
        // Both pass: Snap, the newest, resolves first; the cleanup after it kills the unit.
        t.act(pass(B), pass(A));
        t.expect(ofType(t.events, 'ChainItemResolved').map((e) => e.card)).toEqual(['test:snap']);
        t.expect(ofType(t.events, 'DamageDealt')).toMatchObject([
          { damage: [{ unit, amount: 1 }], rule: '418.1.b' },
        ]);
        t.expect(ofType(t.events, 'UnitKilled')).toMatchObject([{ unit }]);
        // 340.4: Insight remains; its controller gains Priority, with a new sequence of passes.
        t.expect(t.state.chain).toMatchObject({ priority: A, passes: 0 });
        t.act(pass(A), pass(B));
        t.expect(ofType(t.events, 'ChainItemResolved').map((e) => e.card)).toEqual([
          'test:insight',
        ]);
        t.expect(t.state.chain).toBeNull();
      },
    },
  );
});

describe('806 Action, and spells in Showdowns', () => {
  /** turnThree, then A moves Vanilla 1 to the empty first battlefield: a Showdown, A has Focus. */
  const showdown = () => {
    const state = turnThree();
    return act(state, move(A, unitsInBase(state, A), battlefield(state, 0))).state;
  };

  scenario(
    'rule 806.1.c.1: a spell with Action can be played in a Showdown by the player with Focus',
    {
      rules: [
        '806.1.c.1',
        '806',
        '806.1',
        '806.1.b',
        '806.1.c',
        '159.2.a',
        '159.2.a.1',
        '308.1.a',
        '313.1.a',
        '347.1.a',
        '326.2',
      ],
      setup: showdown,
      check: (t) => {
        const [unit] = t.state.battlefields[0]?.units ?? [];
        // Without Action, a spell cannot be played in a Showdown (308.1.a).
        t.expect(t.actIllegal(play(t.state, A, 'test:insight'), 'wrong-timing').rule).toBe(
          '308.1.a',
        );
        t.act(play(t.state, A, 'test:bolt', { targets: [unit as ObjectId] }));
        t.expect(t.state.chain?.items).toHaveLength(1);
        t.expect(t.state.showdown).toMatchObject({ focus: A });
      },
    },
  );

  scenario('rule 340.2.a: when the Chain of a Showdown is empty, Focus passes to the next player', {
    rules: ['340.2.a', '346', '347.1.b', '313.3', '335.1'],
    setup: () => {
      const state = showdown();
      const [unit] = state.battlefields[0]?.units ?? [];
      return act(state, play(state, A, 'test:bolt', { targets: [unit as ObjectId] })).state;
    },
    check: (t) => {
      // 313.3: passing Priority on the Chain, A keeps Focus.
      t.act(pass(A));
      t.expect(t.state.showdown).toMatchObject({ focus: A });
      t.act(pass(B));
      t.expect(t.state.chain).toBeNull();
      t.expect(ofType(t.events, 'FocusPassed')).toMatchObject([
        { player: A, next: B, rule: '340.2.a' },
      ]);
      t.expectDecision({ kind: 'Focus', player: B });
    },
  });
});

describe('355 Targets', () => {
  /** A conquers the first battlefield with Vanilla 1 on turn 3; B's turn 4, B holds Smite. */
  const enemyAtBattlefield = () => {
    let state = board()
      .setup(testSetup({ withSpells: true }))
      .firstPlayer('A')
      .player('A', { hand: [v(1), v(2), v(3), v(4)], mainDeckTop: [v(5), v(6), v(7)] })
      .player('B', { hand: ['Smite', 'Bolt', v(1), v(2)], mainDeckTop: [v(3), v(4)] })
      .afterMulligans()
      .build();
    state = act(state, play(state, A, 'test:vanilla-1', { location: 'base' })).state;
    state = endTurn(state).state;
    state = act(state, play(state, B, 'test:vanilla-1', { location: 'base' })).state;
    state = endTurn(state).state;
    state = act(
      state,
      move(A, unitsInBase(state, A), battlefield(state, 0)),
      { type: 'PassFocus', player: A },
      { type: 'PassFocus', player: B },
    ).state;
    return endTurn(state).state;
  };

  scenario('rule 355.9.b: a target must meet the restrictions of the spell', {
    rules: ['355.9.b', '355.9', '355.9.a', '355.9.a.1', '355.5', '355.7', '358.1'],
    setup: enemyAtBattlefield,
    check: (t) => {
      const [enemy] = t.state.battlefields[0]?.units ?? [];
      const [own] = unitsInBase(t.state, B) as [ObjectId];
      // Smite: "an enemy unit at a battlefield". B's own unit, in B's base, is neither.
      t.actIllegal(play(t.state, B, 'test:smite', { targets: [own] }), 'invalid-target');
      // A card in a hand is not a unit on the board (355.9.a.1).
      const card = t.player('A').zones.hand[0] as ObjectId;
      t.actIllegal(play(t.state, B, 'test:bolt', { targets: [card] }), 'invalid-target');
      t.act(play(t.state, B, 'test:smite', { targets: [enemy as ObjectId] }));
      t.expect(t.state.chain?.items[0]?.targets).toEqual([enemy]);
    },
  });

  scenario('rule 355.8: a spell with a target cannot be played without one', {
    rules: ['355.8'],
    setup: enemyAtBattlefield,
    check: (t) => {
      t.actIllegal(play(t.state, B, 'test:smite'), 'invalid-target');
    },
  });
});
