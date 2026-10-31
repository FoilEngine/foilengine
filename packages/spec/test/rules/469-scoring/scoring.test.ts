import { autoPayment } from '@foilengine/rules';
import { scenario } from '@foilengine/testkit';
import type { GameState, ObjectId } from '@foilengine/types';
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
  turnFive,
  turnFour,
  turnThree,
  unitsInBase,
} from '../../battlefields.ts';
import { withPoints } from '../../support.ts';

/** Plays `card` from A's hand to `location`, paid with autoPayment. */
function play(
  state: GameState,
  card: string,
  location: { kind: 'base' } | { kind: 'battlefield'; battlefield: ObjectId },
) {
  const object = inHand(state, A, card);
  const cost = state.cards[state.objects[object]?.card as never]?.cost;
  const payment = cost === undefined ? null : autoPayment(state, A, cost);
  if (payment === null) throw new Error(`A cannot pay for ${card}`);
  return act(state, { type: 'PlayCard', player: A, card: object, location, payment });
}

describe('469–474 Scoring', () => {
  scenario(
    'rule 471.2: in their Beginning Phase, the Turn Player Holds the battlefields they control',
    {
      rules: ['471.2', '315.2.b.2', '315.2'],
      setup: turnFour,
      check: (t) => {
        t.act({ type: 'EndTurn', player: B });
        const target = battlefield(t.state, 0);
        t.expect(ofType(t.events, 'BattlefieldScored')).toMatchObject([
          { player: A, battlefield: target, method: 'hold', rule: '471.2' },
        ]);
        t.expect(t.player('A').points).toBe(2);
      },
    },
  );

  scenario(
    'rule 315.1.b: in their Awaken Phase, the Turn Player readies their units at battlefields too',
    {
      rules: ['315.1.b', '416.3.a'],
      setup: turnFour,
      check: (t) => {
        const units = [...(t.state.battlefields[0]?.units ?? [])];
        for (const unit of units) t.expect(t.state.objects[unit]?.exhausted).toBe(true);
        t.act({ type: 'EndTurn', player: B });
        for (const unit of units) t.expect(t.state.objects[unit]?.exhausted).toBe(false);
      },
    },
  );

  scenario('rule 323.5: a player loses Control of a battlefield where they have no units left', {
    rules: ['323.5', '190.4.c', '190.4.a'],
    setup: turnFive,
    check: (t) => {
      const target = battlefield(t.state, 0);
      t.act(move(A, [...(t.state.battlefields[0]?.units ?? [])], 'base'));
      t.expect(ofType(t.events, 'ControlLost')).toMatchObject([
        { player: A, battlefield: target, rule: '323.5' },
      ]);
      t.expect(t.state.battlefields[0]?.controller).toBeNull();
    },
  });

  scenario('rule 472: a player Scores a battlefield only once per turn', {
    rules: ['472'],
    setup: turnFive,
    check: (t) => {
      // A Held the first battlefield this turn, leaves it (Control is lost, 323.5), then comes back
      // with Vanilla 6 and establishes Control again: no second Score, no second point.
      const target = battlefield(t.state, 0);
      const points = t.player('A').points;
      const [fresh] = unitsInBase(t.state, A).filter(
        (u) => t.state.objects[u]?.exhausted === false,
      ) as [ObjectId];
      t.act(
        move(A, [...(t.state.battlefields[0]?.units ?? [])], 'base'),
        move(A, [fresh], target),
        { type: 'PassFocus', player: A },
        { type: 'PassFocus', player: B },
      );
      t.expect(ofType(t.events, 'ControlEstablished')).toMatchObject([
        { player: A, battlefield: target },
      ]);
      t.expect(ofType(t.events, 'BattlefieldScored')).toEqual([]);
      t.expect(t.player('A').points).toBe(points);
    },
  });

  scenario(
    'rule 355.2.a: a unit can be played to a battlefield its controller controls, without Contesting it',
    {
      rules: ['355.2.a', '190.3.a.1'],
      setup: turnFive,
      check: (t) => {
        const target = battlefield(t.state, 0);
        const { state, events } = play(t.state, 'test:vanilla-7', {
          kind: 'battlefield',
          battlefield: target,
        });
        const [played] = ofType(events, 'CardPlayed');
        t.expect(played?.battlefield).toBe(target);
        t.expect(state.battlefields[0]?.units).toContain(played?.object);
        t.expect(ofType(events, 'BattlefieldContested')).toEqual([]);
        t.expect(state.showdown).toBeNull();
      },
    },
  );

  scenario(
    'rule 473.1.b.1: a Conquer for the Final Point without having Scored every battlefield draws a card instead',
    {
      rules: ['473.1.b.1', '473.1.b', '473.1.a'],
      setup: () => withPoints(turnThree(), A, 7),
      check: (t) => {
        const hand = t.player('A').zones.hand.length;
        t.act(
          move(A, unitsInBase(t.state, A), battlefield(t.state, 0)),
          { type: 'PassFocus', player: A },
          { type: 'PassFocus', player: B },
        );
        t.expect(ofType(t.events, 'BattlefieldScored')).toMatchObject([{ method: 'conquer' }]);
        t.expect(ofType(t.events, 'PointsGained')).toEqual([]);
        t.expect(ofType(t.events, 'CardDrawn')).toMatchObject([{ player: A, rule: '473.1.b.1' }]);
        t.expect(t.player('A').points).toBe(7);
        t.expect(t.player('A').zones.hand).toHaveLength(hand + 1);
      },
    },
  );

  scenario('rule 473.1.a.1: a Hold is not restricted by the Final Point', {
    rules: ['473.1.a.1'],
    setup: () => withPoints(turnFour(), A, 7),
    check: (t) => {
      t.act({ type: 'EndTurn', player: B });
      t.expect(ofType(t.events, 'BattlefieldScored')).toMatchObject([
        { player: A, method: 'hold' },
      ]);
      t.expect(ofType(t.events, 'GameWon')).toMatchObject([{ player: A, rule: '323.1' }]);
    },
  });

  scenario(
    'rule 473.1.b.1: a Conquer after Scoring every other battlefield this turn gains the Final Point',
    {
      rules: ['473.1.b.1', '194.2'],
      // 6 points before turn 5: the Hold of the first battlefield brings A to 7.
      setup: () => endTurn(withPoints(turnFour(), A, 6)).state,
      check: (t) => {
        t.expect(t.player('A').points).toBe(7);
        const [fresh] = unitsInBase(t.state, A).filter(
          (u) => t.state.objects[u]?.exhausted === false,
        ) as [ObjectId];
        t.act(
          move(A, [fresh], battlefield(t.state, 1)),
          { type: 'PassFocus', player: A },
          { type: 'PassFocus', player: B },
        );
        t.expect(ofType(t.events, 'PointsGained')).toMatchObject([{ player: A, total: 8 }]);
        t.expect(ofType(t.events, 'GameWon')).toMatchObject([{ player: A }]);
        t.expect(t.state.stage).toEqual({ kind: 'ended' });
      },
    },
  );

  scenario('rule 194: players gain points by Holding and by Conquering battlefields', {
    rules: ['194', '194.1.a', '194.1.b', '471', '471.1.b'],
    setup: turnThree,
    check: (t) => {
      // Conquer: A moves to the empty first battlefield; once the showdown closes, A establishes
      // Control (471.1.b) and that Conquer gains a point.
      const target = battlefield(t.state, 0);
      t.act(
        move(A, unitsInBase(t.state, A), target),
        { type: 'PassFocus', player: A },
        { type: 'PassFocus', player: B },
      );
      t.expect(
        t.events
          .map((e) => e.type)
          .filter((type) =>
            ['ControlEstablished', 'BattlefieldScored', 'PointsGained'].includes(type),
          ),
      ).toEqual(['ControlEstablished', 'BattlefieldScored', 'PointsGained']);
      t.expect(ofType(t.events, 'BattlefieldScored')).toMatchObject([{ method: 'conquer' }]);
      t.expect(t.player('A').points).toBe(1);
      // Hold: at the start of A's next turn, A still controls it.
      t.act({ type: 'EndTurn', player: A }, { type: 'EndTurn', player: B });
      t.expect(ofType(t.events, 'BattlefieldScored')).toMatchObject([
        { player: A, method: 'hold' },
      ]);
      t.expect(t.player('A').points).toBe(2);
    },
  });

  scenario(
    'rule 470.1: Scoring is not Gaining a Point: a Conquer short of the Final Point scores without a point',
    {
      rules: ['470.1', '470'],
      setup: () => withPoints(turnThree(), A, 7),
      check: (t) => {
        t.act(
          move(A, unitsInBase(t.state, A), battlefield(t.state, 0)),
          { type: 'PassFocus', player: A },
          { type: 'PassFocus', player: B },
        );
        t.expect(ofType(t.events, 'BattlefieldScored')).toHaveLength(1);
        t.expect(ofType(t.events, 'PointsGained')).toEqual([]);
        t.expect(t.player('A').scoredThisTurn).toEqual([battlefield(t.state, 0)]);
      },
    },
  );

  scenario(
    'rule 194.2.a: when both players are at the Victory Score, the one with more points wins',
    {
      rules: ['194.2.a', '319.6'],
      setup: () => withPoints(withPoints(turnThree(), A, 9), B, 8),
      check: (t) => {
        // A unit entering the board makes a Cleanup outstanding (319.6), which checks victory (323.1).
        const { events } = play(t.state, 'test:vanilla-2', { kind: 'base' });
        const types = events.map((e) => e.type);
        t.expect(types.indexOf('CardPlayed')).toBeLessThan(types.indexOf('GameWon'));
        t.expect(ofType(events, 'GameWon')).toMatchObject([{ player: A }]);
      },
    },
  );

  scenario(
    'rule 194.2.b: tied at the Victory Score, play continues until a player has more points in a cleanup',
    {
      rules: ['194.2.b', '474', '319.2'],
      setup: () => withPoints(withPoints(turnFour(), A, 8), B, 8),
      check: (t) => {
        // B's turn 4: tied at 8. Ending the turn goes through several cleanups without a winner,
        // until A Holds the first battlefield in their Beginning Phase and has 9.
        t.expect(t.state.winner).toBeNull();
        t.act({ type: 'EndTurn', player: B });
        const types = t.events.map((e) => e.type);
        const won = types.indexOf('GameWon');
        t.expect(types.indexOf('BattlefieldScored')).toBeLessThan(won);
        t.expect(ofType(t.events, 'GameWon')).toMatchObject([{ player: A }]);
        // 319.2: the Cleanup after the Beginning Phase ends the game: A does not channel.
        t.expect(types.slice(won)).not.toContain('RuneChanneled');
        t.expect(t.player('A').points).toBe(9);
      },
    },
  );
});

describe('315 Start of Turn tasks', () => {
  scenario('rule 315.1.a: each phase of the Start of Turn makes its task outstanding, in order', {
    rules: ['315.1.a', '315.2.b', '315.2.b.1', '315.3.a', '315.4.a', '316.1'],
    setup: turnFour,
    check: (t) => {
      // A's turn 5: ready (Awaken), Hold (Scoring Step of the Beginning Phase), channel, draw,
      // then the Main Phase begins (316.1).
      t.act({ type: 'EndTurn', player: B });
      const start = t.events.findIndex((e) => e.type === 'TurnStarted');
      const steps = t.events
        .slice(start)
        .filter((e) =>
          [
            'PhaseStarted',
            'ObjectsReadied',
            'BattlefieldScored',
            'RuneChanneled',
            'CardDrawn',
          ].includes(e.type),
        )
        .map((e) => (e.type === 'PhaseStarted' ? e.phase : e.type));
      t.expect(steps).toEqual([
        'awaken',
        'ObjectsReadied',
        'beginning',
        'BattlefieldScored',
        'channel',
        'RuneChanneled',
        'RuneChanneled',
        'draw',
        'CardDrawn',
        'main',
      ]);
    },
  });
});
