// Quick-Draw (819) and Weaponmaster (821), and attaching a card that is already attached (435.1.f).

import { autoPayment, characteristics } from '@foilengine/rules';
import { board, scenario, TEST_CARDS, testSetup } from '@foilengine/testkit';
import type { Action, CardId, GameState, ObjectId, PlayerId } from '@foilengine/types';
import { describe } from 'vitest';
import { A, act, B, endTurn, inHand, ofType, v } from '../../battlefields.ts';

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
  return {
    type: 'PlayCard',
    player,
    card: object,
    payment,
    ...(definition?.category === 'unit' ? { location: { kind: 'base' as const } } : {}),
  };
}

function playAll(state: GameState, player: PlayerId, cards: string[]): GameState {
  return cards.reduce((current, card) => act(current, play(current, player, card)).state, state);
}

/** The permanent of `card` (a test card id) in a base. */
const inBase = (state: GameState, card: string) =>
  state.players
    .flatMap((p) => p.zones.base)
    .find((id) => state.objects[id]?.card === card) as ObjectId;

describe('819 Quick-Draw', () => {
  scenario(
    'rule 819.1.d: a card with Quick-Draw is played with Reaction, and attaches itself to a unit you control',
    {
      rules: ['819.1.d', '819', '819.1', '819.1.a', '819.1.b', '819.1.c', '819.3'],
      // Turn 1: Vanilla 1. Turn 3: A plays Insight, then Holster as a Reaction on the Chain.
      setup: () => {
        const state = playAll(start([v(1), 'Insight', 'Holster', v(2)]), A, ['test:vanilla-1']);
        return endTurn(endTurn(state).state).state;
      },
      check: (t) => {
        const vanilla = inBase(t.state, 'test:vanilla-1');
        t.act(play(t.state, A, 'test:insight'));
        t.expect(t.state.chain).not.toBeNull();
        t.act(play(t.state, A, 'test:holster'));
        const holster = inBase(t.state, TEST_CARDS.holster.id);
        t.expect(characteristics(t.state, holster).keywords).toContain('quick-draw');
        // Its Play Effect chooses the unit as it is finalized, then resolves.
        t.expectDecision({ kind: 'FinalizeAbility', player: A });
        t.act({ type: 'FinalizeAbility', player: A, perform: true, targets: [vanilla] });
        t.act(pass(A), pass(B));
        t.expect(ofType(t.events, 'GearAttached')).toMatchObject([
          { gear: holster, unit: vanilla },
        ]);
        t.expect(characteristics(t.state, vanilla).might).toBe(2);
      },
    },
  );
});

describe('821 Weaponmaster', () => {
  scenario(
    'rule 821.1.c: Weaponmaster may attach an Equipment you control, paying its Equip cost reduced by [A]',
    {
      rules: ['821.1.c', '821', '821.1', '821.1.a', '821.1.b', '821.1.c.3', '821.1.c.6', '821.3'],
      // Turn 1: Blade (Equip [1]) and Holster (Equip [A]); Holster's Play Effect has no unit to
      // choose. Turn 3: Armsman.
      setup: () => {
        const state = playAll(start(['Blade', 'Holster', 'Armsman', v(1)]), A, [
          'test:blade',
          'test:holster',
        ]);
        return endTurn(endTurn(state).state).state;
      },
      check: (t) => {
        const blade = inBase(t.state, TEST_CARDS.blade.id);
        const holster = inBase(t.state, TEST_CARDS.holster.id);
        t.act(play(t.state, A, 'test:armsman'), pass(A), pass(B));
        const armsman = inBase(t.state, TEST_CARDS.armsman.id);
        // [1] has no [A] to reduce (821.1.c.3); [A] is reduced to nothing.
        t.expectDecision({
          kind: 'Weaponmaster',
          player: A,
          unit: armsman,
          options: [
            { gear: blade, cost: { energy: 1, power: [] } },
            { gear: holster, cost: { energy: 0, power: [] } },
          ],
        });
        t.expectLegal({ type: 'Weaponmaster', player: A, gear: null });
        t.act({ type: 'Weaponmaster', player: A, gear: holster });
        t.expect(t.state.objects[armsman]?.attached).toEqual([holster]);
        // The Equip ability was not activated (821.1.c.6).
        t.expect(ofType(t.events, 'AbilityAdded')).toEqual([]);
        t.expect(t.state.resolving).toBeNull();
        t.expect(t.state.chain).toBeNull();
      },
    },
  );

  scenario(
    'rule 435.1.f: attaching a card to a new Top-Most Card detaches it from the current one',
    {
      rules: ['435.1.f', '725', '725.3'],
      // Turn 1: Vanilla 1 and Blade. Turn 3: Blade is equipped to Vanilla 1, then Armsman's
      // Weaponmaster takes it.
      setup: () => {
        let state = playAll(start([v(1), 'Blade', 'Armsman', v(2)]), A, [
          'test:vanilla-1',
          'test:blade',
        ]);
        state = endTurn(endTurn(state).state).state;
        const blade = inBase(state, TEST_CARDS.blade.id);
        const vanilla = inBase(state, 'test:vanilla-1');
        const equip: Action = {
          type: 'ActivateAbility',
          player: A,
          source: blade,
          ability: 0,
          targets: [vanilla],
          payment: autoPayment(state, A, { energy: 1, power: [] }) ?? [],
        };
        return act(state, equip, pass(A), pass(B)).state;
      },
      check: (t) => {
        const vanilla = inBase(t.state, 'test:vanilla-1');
        const [blade] = t.state.objects[vanilla]?.attached ?? [];
        t.act(play(t.state, A, 'test:armsman'), pass(A), pass(B));
        const armsman = inBase(t.state, TEST_CARDS.armsman.id);
        t.act({
          type: 'Weaponmaster',
          player: A,
          gear: blade as ObjectId,
          payment: autoPayment(t.state, A, { energy: 1, power: [] }) ?? [],
        });
        t.expect(ofType(t.events, 'GearDetached')).toMatchObject([{ gear: blade, unit: vanilla }]);
        t.expect(t.state.objects[vanilla]?.attached).toBeUndefined();
        t.expect(t.state.objects[armsman]?.attached).toEqual([blade]);
        t.expect(t.state.players[0]?.zones.base).not.toContain(blade);
      },
    },
  );
});
