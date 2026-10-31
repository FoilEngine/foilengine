// Empower (827, 442), Empowered (828) and Disarm (831).

import { autoPayment, characteristics, legalActions, viewFor } from '@foilengine/rules';
import { board, scenario, testSetup } from '@foilengine/testkit';
import type { Action, CardId, GameState, ObjectId, PlayerId } from '@foilengine/types';
import { describe } from 'vitest';
import { A, act, B, battlefield, endTurn, inHand, move, ofType, v } from '../../battlefields.ts';

const pass = (player: PlayerId): Action => ({ type: 'PassPriority', player });

const start = (handA: string[], handB: string[] = [v(1), v(2), v(3), v(4)]) =>
  board()
    .setup(testSetup({ withAbilities: true }))
    .firstPlayer('A')
    .player('A', { hand: handA, mainDeckTop: [v(5), v(6), v(7), v(8)] })
    .player('B', { hand: handB, mainDeckTop: [v(5), v(6), v(7), v(8)] })
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

describe('827 Empower, 828 Empowered', () => {
  scenario('rule 827.1.c.1: Empower: "[Cost]: Empower this. Play only if not Empowered."', {
    rules: [
      '827.1.c.1',
      '827',
      '827.1',
      '827.1.a',
      '827.1.b',
      '827.1.b.1',
      '827.1.c',
      '827.2',
      '827.2.a',
      '827.4',
      '442',
      '442.1',
      '442.1.a',
      '442.1.b',
      '442.2',
      '442.2.a',
      '442.3',
      '442.3.a',
      '828',
      '828.1',
      '828.1.a',
      '828.1.b',
      '828.1.b.1',
      '828.1.b.2',
      '828.1.c',
      '828.1.d',
      '828.2',
    ],
    // Turn 1, two runes: Adept, then its Empower [1].
    setup: () => playAll(start(['Adept', v(1), v(2), v(3)]), A, ['test:adept']),
    check: (t) => {
      const adept = unit(t.state, 'test:adept');
      const empower = (state: GameState): Action => ({
        type: 'ActivateAbility',
        player: A,
        source: adept,
        ability: 0,
        payment: autoPayment(state, A, { energy: 1, power: [] }) ?? [],
      });
      t.expect(characteristics(t.state, adept).might).toBe(1);
      t.act(empower(t.state), pass(A), pass(B));
      t.expect(ofType(t.events, 'ObjectEmpowered')).toMatchObject([{ object: adept }]);
      t.expect(
        viewFor(t.state, B).opponents[0]?.zones.base.find((o) => o.id === adept),
      ).toMatchObject({
        empowered: true,
        might: 3,
      });
      // "When I become Empowered, draw 1" triggered as it became Empowered.
      t.expect(ofType(t.events, 'AbilityAdded').filter((e) => e.triggered)).toMatchObject([
        { source: adept, triggered: true },
      ]);
      t.act(pass(A), pass(B));
      t.expect(ofType(t.events, 'CardDrawn')).toMatchObject([{ player: A }]);
      // Once Empowered, it cannot be Empowered again.
      const reason = t.actIllegal(empower(t.state), 'invalid-source');
      t.expect(reason.rule).toBe('827.1.c.1');
    },
  });
});

describe('831 Disarm', () => {
  scenario('rule 831.1.d: Disarm: "When I attack, give an enemy unit here -X [M] this turn"', {
    rules: [
      '831.1.d',
      '831',
      '831.1',
      '831.1.a',
      '831.1.b',
      '831.1.c',
      '831.1.c.1',
      '831.1.c.2',
      '831.3',
    ],
    // A: Vanilla 2 on turn 1; Vanilla 1 on turn 3, when Vanilla 2 conquers the first battlefield.
    // B: Disarmer on turn 2, which attacks there on turn 4.
    setup: () => {
      let state = playAll(start([v(2), v(1), v(3), v(4)], ['Disarmer', v(1), v(2), v(3)]), A, [
        'test:vanilla-2',
      ]);
      state = endTurn(state).state;
      state = playAll(state, B, ['test:disarmer']);
      state = endTurn(state).state;
      state = playAll(state, A, ['test:vanilla-1']);
      state = act(
        state,
        move(A, [unit(state, 'test:vanilla-2')], battlefield(state, 0)),
        { type: 'PassFocus', player: A },
        { type: 'PassFocus', player: B },
      ).state;
      state = endTurn(state).state;
      return act(state, move(B, [unit(state, 'test:disarmer')], battlefield(state, 0))).state;
    },
    check: (t) => {
      const disarmer = unit(t.state, 'test:disarmer');
      const defender = unit(t.state, 'test:vanilla-2');
      t.expect(characteristics(t.state, disarmer).disarm).toBe(1);
      // Its attack ability chooses an enemy unit here: not Vanilla 1, in A's base.
      t.expectDecision({ kind: 'FinalizeAbility', player: B });
      const choices = legalActions(t.state, B).filter((a) => a.type === 'FinalizeAbility');
      t.expect(choices).toMatchObject([{ targets: [defender] }]);
      t.act(choices[0] as Action, pass(B), pass(A));
      t.expect(ofType(t.events, 'MightGiven')).toMatchObject([{ unit: defender, amount: -1 }]);
      t.expect(characteristics(t.state, defender).might).toBe(1);
    },
  });
});
