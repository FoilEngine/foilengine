// Activated (376–381, 399–407) and triggered (382–386) abilities, and the Outstanding Tasks
// that wait for the Chain they create (332–336).

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

const pass = (player: PlayerId): Action => ({ type: 'PassPriority', player });

/** Plays `card` from the hand to the base (a unit) or without location (a spell). */
function play(state: GameState, player: PlayerId, card: string): Action {
  const object = inHand(state, player, card);
  const definition = state.cards[state.objects[object]?.card as never];
  const payment =
    definition?.cost === undefined ? null : autoPayment(state, player, definition.cost);
  if (payment === null) throw new Error(`${player} cannot pay for ${card}`);
  return {
    type: 'PlayCard',
    player,
    card: object,
    payment,
    ...(definition?.category === 'unit' ? { location: { kind: 'base' as const } } : {}),
  };
}

/** A goes first with the decks with abilities; the hands are given, then turns run. */
const start = (handA: string[], handB: string[] = [v(1), v(2), v(3), v(4)]) =>
  board()
    .setup(testSetup({ withAbilities: true }))
    .firstPlayer('A')
    .player('A', { hand: handA, mainDeckTop: [v(5), v(6), v(7), v(8)] })
    .player('B', { hand: handB, mainDeckTop: [v(5), v(6), v(7), v(8)] })
    .afterMulligans()
    .build();

/** Plays `card` on A's turn 1 and ends turns until A's turn 3: the unit is ready. */
function readyOnTurnThree(card: string, handB?: string[]): GameState {
  let state = start([card, v(1), v(2), v(3)], handB);
  state = act(state, play(state, A, `test:${card.toLowerCase()}`)).state;
  return endTurn(endTurn(state).state).state;
}

/** A moves their units in base to the empty first battlefield and both pass: A conquers it. */
const conquer = (state: GameState) =>
  act(
    state,
    move(A, unitsInBase(state, A), battlefield(state, 0)),
    { type: 'PassFocus', player: A },
    { type: 'PassFocus', player: B },
  );

describe('382–386 Triggered abilities', () => {
  scenario('rule 383.4.a: a Play Effect goes on the Chain once its unit has entered the board', {
    rules: [
      '383.4.a',
      '383.4.a.1',
      '383.4.a.2',
      '383.4.a.3',
      '382',
      '383',
      '383.2',
      '383.2.a',
      '383.2.b',
      '383.3',
      '377.3.a.1',
    ],
    setup: () => start(['Scout', v(1), v(2), v(3)]),
    check: (t) => {
      t.act(play(t.state, A, 'test:scout'));
      const types = t.events.map((e) => e.type);
      t.expect(types.indexOf('CardPlayed')).toBeLessThan(types.indexOf('AbilityAdded'));
      const [added] = ofType(t.events, 'AbilityAdded');
      const [played] = ofType(t.events, 'CardPlayed');
      t.expect(added).toMatchObject({ player: A, source: played?.object, triggered: true });
      t.expect(t.state.chain).toMatchObject({ priority: A, triggered: true });
      // It resolves like a spell: everyone passes, then its controller draws 1. An ability has no
      // card: it goes to no trash (377.3.a.1).
      const hand = t.player('A').zones.hand.length;
      t.act(pass(A), pass(B));
      t.expect(ofType(t.events, 'ChainItemResolved')).toMatchObject([
        { object: added?.object, trashed: null },
      ]);
      t.expect(t.player('A').zones.hand).toHaveLength(hand + 1);
      t.expect(t.state.chain).toBeNull();
      t.expectDecision({ kind: 'Priority', player: A, rule: '312.2.a' });
    },
  });

  scenario('rule 383.4.c: when its unit conquers, a Conquer ability triggers', {
    rules: [
      '383.4.c',
      '383.4.c.1',
      '383.4.c.2',
      '383.4.c.2.a',
      '383.4.c.3',
      '473',
      '473.2',
      '473.2.a',
    ],
    setup: () => readyOnTurnThree('Raider'),
    check: (t) => {
      const [raider] = unitsInBase(t.state, A) as [ObjectId];
      t.act(
        move(A, [raider], battlefield(t.state, 0)),
        { type: 'PassFocus', player: A },
        { type: 'PassFocus', player: B },
      );
      const types = t.events.map((e) => e.type);
      t.expect(types.indexOf('BattlefieldScored')).toBeLessThan(types.indexOf('AbilityAdded'));
      // 473: Scoring does two things: the point (473.1), and the Score abilities (473.2).
      t.expect(ofType(t.events, 'PointsGained')).toMatchObject([{ player: A, total: 1 }]);
      t.expect(ofType(t.events, 'AbilityAdded')).toMatchObject([
        { source: raider, triggered: true },
      ]);
      t.act(pass(A), pass(B));
      t.expect(ofType(t.events, 'CardDrawn')).toMatchObject([{ player: A }]);
    },
  });

  scenario(
    'rule 383.4.d: a Hold ability triggers in the Beginning Phase, and the turn waits for its Chain',
    {
      rules: [
        '383.4.d',
        '383.4.d.1',
        '383.4.d.2',
        '383.4.d.2.a',
        '383.4.d.3',
        '473.2.b',
        '332',
        '333',
        '333.1',
        '334',
        '334.1',
        '334.2',
        '335',
        '336',
      ],
      // A conquers with Keeper on turn 3; B's turn 4.
      setup: () => endTurn(conquer(readyOnTurnThree('Keeper')).state).state,
      check: (t) => {
        t.act({ type: 'EndTurn', player: B });
        // A's turn 5: the Hold, then its ability on the Chain; the turn stops in the Beginning
        // Phase, before the Channel Phase.
        t.expect(ofType(t.events, 'BattlefieldScored')).toMatchObject([{ method: 'hold' }]);
        t.expect(ofType(t.events, 'AbilityAdded')).toMatchObject([{ triggered: true }]);
        t.expect(ofType(t.events, 'RuneChanneled')).toEqual([]);
        t.expect(t.state.stage).toMatchObject({ turnPlayer: A, phase: 'beginning' });
        t.expectDecision({ kind: 'Priority', player: A });
        // Once it has resolved, the turn goes on: Channel, Draw, Main Phase (335).
        t.act(pass(A), pass(B));
        const steps = t.events
          .filter((e) => ['ChainItemResolved', 'RuneChanneled', 'PhaseStarted'].includes(e.type))
          .map((e) => (e.type === 'PhaseStarted' ? e.phase : e.type));
        t.expect(steps).toEqual([
          'ChainItemResolved',
          'channel',
          'RuneChanneled',
          'RuneChanneled',
          'draw',
          'main',
        ]);
        t.expectDecision({ kind: 'Priority', player: A, rule: '312.2.a' });
      },
    },
  );

  scenario(
    'rule 383.3.d: a player orders the abilities they control that trigger at the same time',
    {
      rules: ['383.3.d', '337', '337.1', '337.1.b', '337.3'],
      // Two Raiders, played on turns 1 and 3, both ready on turn 5, conquer together.
      setup: () => {
        let state = start(['Raider', 'Raider', v(1), v(2)]);
        state = act(state, play(state, A, 'test:raider')).state;
        state = endTurn(endTurn(state).state).state;
        state = act(state, play(state, A, 'test:raider')).state;
        return endTurn(endTurn(state).state).state;
      },
      check: (t) => {
        const raiders = unitsInBase(t.state, A).filter(
          (u) => t.state.objects[u]?.card === 'test:raider',
        );
        t.act(
          move(A, raiders, battlefield(t.state, 0)),
          { type: 'PassFocus', player: A },
          { type: 'PassFocus', player: B },
        );
        const decision = t.state.triggered;
        t.expectDecision({ kind: 'OrderTriggers', player: A });
        t.actIllegal({ type: 'OrderTriggers', player: A, order: [0, 0] }, 'invalid-order');
        t.act({ type: 'OrderTriggers', player: A, order: [1, 0] });
        t.expect(ofType(t.events, 'AbilityAdded').map((e) => e.source)).toEqual([
          decision[1]?.source,
          decision[0]?.source,
        ]);
        // 337.1, 337.1.b, 337.3: both are Pending, then finalized in the order they were added.
        const added = ofType(t.events, 'AbilityAdded').map((e) => e.object);
        t.expect(
          t.events
            .filter((e) => e.type === 'AbilityAdded' || e.type === 'ChainItemFinalized')
            .map((e) => [e.type, e.object]),
        ).toEqual([
          ['AbilityAdded', added[0]],
          ['AbilityAdded', added[1]],
          ['ChainItemFinalized', added[0]],
          ['ChainItemFinalized', added[1]],
        ]);
        t.expect(t.state.chain?.items.every((i) => i.status === 'finalized')).toBe(true);
      },
    },
  );
});

describe('376–381, 399–407 Activated abilities', () => {
  scenario('rule 377.3: an activated ability goes on the Chain and resolves like a spell', {
    rules: [
      '377.3',
      '376',
      '377',
      '377.1',
      '377.3.a',
      '377.3.b',
      '377.3.b.1',
      '377.3.b.2',
      '377.3.b.3',
      '378',
      '379',
      '380',
      '399',
      '400',
      '401',
      '402',
      '403',
      '404',
      '405',
      '406',
      '407',
    ],
    // A's Slinger is ready on turn 3; B played Vanilla 1 on turn 2.
    setup: () => {
      let state = start(['Slinger', v(1), v(2), v(3)]);
      state = act(state, play(state, A, 'test:slinger')).state;
      state = endTurn(state).state;
      state = act(state, play(state, B, 'test:vanilla-1')).state;
      return endTurn(state).state;
    },
    check: (t) => {
      const [slinger] = unitsInBase(t.state, A) as [ObjectId];
      const [target] = unitsInBase(t.state, B) as [ObjectId];
      const activate: Action = {
        type: 'ActivateAbility',
        player: A,
        source: slinger,
        ability: 0,
        targets: [target],
        payment: [],
      };
      t.act(activate);
      // [E]: Slinger is exhausted to pay; the ability waits on the Chain, A has Priority.
      t.expect(ofType(t.events, 'ObjectExhausted')).toMatchObject([
        { object: slinger, rule: '405' },
      ]);
      t.expect(ofType(t.events, 'AbilityAdded')).toMatchObject([
        { source: slinger, triggered: false, targets: [target], rule: '377.3.a' },
      ]);
      t.expectDecision({ kind: 'Priority', player: A });
      // B may respond (377.3.b.2); both pass: it deals 1, and B's Vanilla 1 (Might 1) dies.
      t.act(pass(A), pass(B));
      t.expect(ofType(t.events, 'DamageDealt')).toMatchObject([
        { damage: [{ unit: target, amount: 1 }] },
      ]);
      t.expect(ofType(t.events, 'UnitKilled')).toMatchObject([{ unit: target }]);
      // Exhausted, Slinger cannot pay its cost again.
      t.actIllegal({ ...activate, targets: [slinger] }, 'cannot-pay');
    },
  });

  scenario('rule 381.1: an ability without Action cannot be activated in a Showdown', {
    rules: ['381.1', '381'],
    setup: () => {
      // Slinger on turn 1, Vanilla 1 on turn 3; on turn 5, Vanilla 1 moves to the empty first
      // battlefield and a Showdown begins.
      let state = start(['Slinger', v(1), v(2), v(3)]);
      state = act(state, play(state, A, 'test:slinger')).state;
      state = endTurn(endTurn(state).state).state;
      state = act(state, play(state, A, 'test:vanilla-1')).state;
      state = endTurn(endTurn(state).state).state;
      const vanilla = unitsInBase(state, A).find(
        (u) => state.objects[u]?.card === 'test:vanilla-1',
      ) as ObjectId;
      return act(state, move(A, [vanilla], battlefield(state, 0))).state;
    },
    check: (t) => {
      const slinger = unitsInBase(t.state, A).find(
        (u) => t.state.objects[u]?.card === 'test:slinger',
      ) as ObjectId;
      const reason = t.actIllegal(
        {
          type: 'ActivateAbility',
          player: A,
          source: slinger,
          ability: 0,
          targets: [slinger],
          payment: [],
        },
        'wrong-timing',
      );
      t.expect(reason.rule).toBe('308.1.a');
    },
  });

  scenario(
    "rule 813.1.c.2: an ability with Reaction can be activated on a Chain, on another player's turn",
    {
      rules: ['813.1.c.2'],
      // B plays Sage on turn 2 with two of their three runes; A's turn 3: A plays Insight.
      setup: () => {
        let state = start([v(1), 'Insight', v(2), v(3)], ['Sage', v(1), v(2), v(3)]);
        state = endTurn(state).state;
        state = act(state, play(state, B, 'test:sage')).state;
        state = endTurn(state).state;
        return act(state, play(state, A, 'test:insight'), pass(A)).state;
      },
      check: (t) => {
        const [sage] = unitsInBase(t.state, B) as [ObjectId];
        const payment = autoPayment(t.state, B, { energy: 1, power: [] });
        t.expect(payment).not.toBeNull();
        t.act({
          type: 'ActivateAbility',
          player: B,
          source: sage,
          ability: 0,
          payment: payment ?? [],
        });
        t.expect(t.state.chain?.items.map((i) => i.controller)).toEqual([A, B]);
        // Both pass: Sage's ability resolves first (B draws), then Insight (A draws).
        t.act(pass(B), pass(A));
        t.expect(ofType(t.events, 'CardDrawn').map((e) => e.player)).toEqual([B]);
        t.act(pass(A), pass(B));
        t.expect(ofType(t.events, 'CardDrawn').map((e) => e.player)).toEqual([A]);
        t.expect(t.state.chain).toBeNull();
      },
    },
  );

  scenario('rule 331.1.b: by default, an ability cannot be activated in a Closed State', {
    rules: ['331.1.b'],
    // Slinger on turn 1; on turn 3, A plays Insight: it waits on the Chain.
    setup: () => {
      let state = start(['Slinger', 'Insight', v(1), v(2)]);
      state = act(state, play(state, A, 'test:slinger')).state;
      state = endTurn(endTurn(state).state).state;
      return act(state, play(state, A, 'test:insight')).state;
    },
    check: (t) => {
      const [slinger] = unitsInBase(t.state, A) as [ObjectId];
      const reason = t.actIllegal(
        {
          type: 'ActivateAbility',
          player: A,
          source: slinger,
          ability: 0,
          targets: [slinger],
          payment: [],
        },
        'wrong-timing',
      );
      t.expect(reason.rule).toBe('309.1.a');
    },
  });
});
