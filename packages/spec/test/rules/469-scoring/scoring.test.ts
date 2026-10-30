import { autoPayment } from '@foilengine/rules';
import { scenario } from '@foilengine/testkit';
import type { GameState, ObjectId } from '@foilengine/types';
import { describe } from 'vitest';
import {
  A,
  act,
  afterConquest,
  B,
  battlefield,
  endTurn,
  inHand,
  move,
  ofType,
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

/**
 * After A's conquest of the first battlefield on turn 3, A also plays Vanilla 6 to their base.
 * Returns B's turn 4, Main Phase.
 */
function turnFour(): GameState {
  const conquered = afterConquest().state;
  return endTurn(play(conquered, 'test:vanilla-6', { kind: 'base' }).state).state;
}

/** A's turn 5: two units at the first battlefield (Held this turn), Vanilla 6 ready in base. */
const turnFive = () => endTurn(turnFour()).state;

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
});
