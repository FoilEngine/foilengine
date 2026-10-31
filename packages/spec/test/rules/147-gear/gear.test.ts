// Gear (147–152), Equipment and Equip (150, 818), Attach and Detach (435, 436), Attachment
// (716–722), Effect Text (136) and Might Bonus (137), and the recall of gear (323.6, 456–459).

import { autoPayment, characteristics, viewFor } from '@foilengine/rules';
import { board, scenario, TEST_CARDS, testSetup } from '@foilengine/testkit';
import type { Action, CardId, GameState, ObjectId, PlayCard, PlayerId } from '@foilengine/types';
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

/** A goes first, with `handA`; both decks hold the test gear. */
const start = (handA: string[]) =>
  board()
    .setup(testSetup({ withAbilities: true }))
    .firstPlayer('A')
    .player('A', { hand: handA, mainDeckTop: [v(5), v(6), v(7), v(8)] })
    .player('B', { hand: [v(1), v(2), v(3), v(4)], mainDeckTop: [v(5), v(6), v(7), v(8)] })
    .afterMulligans()
    .build();

/** `player` plays `card` (a test card id), paid with autoPayment: a unit to the base. */
function play(state: GameState, player: PlayerId, card: string, targets?: ObjectId[]): Action {
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
    ...(targets === undefined ? {} : { targets }),
    ...(definition?.category === 'unit' ? { location: { kind: 'base' as const } } : {}),
  };
}

/** `player` activates ability 0 of `source`, paid with autoPayment. */
function activate(state: GameState, player: PlayerId, source: ObjectId, targets?: ObjectId[]) {
  const ability = state.cards[state.objects[source]?.card as CardId]?.abilities?.[0];
  if (ability?.kind !== 'activated') throw new Error(`${source} has no activated ability`);
  const payment = autoPayment(state, player, {
    energy: ability.cost.energy ?? 0,
    power: ability.cost.power ?? [],
  });
  if (payment === null) throw new Error(`${player} cannot pay for ${source}'s ability`);
  return {
    type: 'ActivateAbility' as const,
    player,
    source,
    ability: 0,
    payment,
    ...(targets === undefined ? {} : { targets }),
  };
}

/** Plays the cards one after the other, each paid from the state the previous one left. */
function playAll(state: GameState, player: PlayerId, cards: string[]): GameState {
  return cards.reduce((current, card) => act(current, play(current, player, card)).state, state);
}

const inBase = (state: GameState, player: PlayerId, card: CardId) =>
  (state.players.find((p) => p.id === player)?.zones.base ?? []).find(
    (id) => state.objects[id]?.card === card,
  ) as ObjectId;

/** Turn 1: A plays Vanilla 1 and Blade. Turn 3: A equips Vanilla 1 with Blade. */
function equipped(extra: string[] = []): GameState {
  let state = start([v(1), 'Blade', ...extra, v(2), v(3)].slice(0, 4));
  state = playAll(state, A, ['test:vanilla-1', 'test:blade']);
  state = endTurn(endTurn(state).state).state;
  const blade = inBase(state, A, TEST_CARDS.blade.id);
  const vanilla = inBase(state, A, 'test:vanilla-1' as CardId);
  return act(state, activate(state, A, blade, [vanilla]), pass(A), pass(B)).state;
}

describe('147–152 Gear', () => {
  scenario('rule 149.1: gear enter play ready, and their activated abilities use the Chain', {
    rules: [
      '149.1',
      '147',
      '148',
      '148.1',
      '148.1.a',
      '148.1.a.1',
      '149',
      '151',
      '151.1',
      '151.2.a',
      '151.2.a.1',
      '152',
      '152.1',
    ],
    // Turn 1: two runes. Lantern costs 1; its ability "[1], [E]: Draw 1" costs 1 more.
    setup: () => start(['Lantern', v(1), v(2), v(3)]),
    check: (t) => {
      t.act(play(t.state, A, 'test:lantern'));
      const lantern = inBase(t.state, A, TEST_CARDS.lantern.id);
      t.expect(t.state.objects[lantern]?.exhausted).toBe(false);
      t.act(activate(t.state, A, lantern));
      t.expect(t.state.chain?.items).toMatchObject([{ ability: { source: lantern } }]);
      t.act(pass(A), pass(B));
      t.expect(ofType(t.events, 'CardDrawn')).toMatchObject([{ player: A }]);
      t.expect(t.state.objects[lantern]?.exhausted).toBe(true);
    },
  });

  scenario("rule 149.2: gear can only be played to a player's base", {
    rules: ['149.2'],
    setup: () => start(['Lantern', v(1), v(2), v(3)]),
    check: (t) => {
      const action = play(t.state, A, 'test:lantern') as PlayCard;
      const reason = t.actIllegal(
        { ...action, location: { kind: 'battlefield', battlefield: battlefield(t.state, 0) } },
        'invalid-location',
      );
      t.expect(reason.rule).toBe('149.2');
    },
  });

  scenario("rule 151.2: a gear's ability is activated in the Main Phase, not in a Showdown", {
    rules: ['151.2'],
    // Turn 1: Lantern and Vanilla 1. Turn 3: Vanilla 1 moves to a battlefield: a Showdown.
    setup: () => {
      let state = start(['Lantern', v(1), v(2), v(3)]);
      state = playAll(state, A, ['test:lantern', 'test:vanilla-1']);
      state = endTurn(endTurn(state).state).state;
      return act(state, move(A, unitsInBase(state, A), battlefield(state, 0))).state;
    },
    check: (t) => {
      t.expect(t.state.showdown).not.toBeNull();
      const lantern = inBase(t.state, A, TEST_CARDS.lantern.id);
      const reason = t.actIllegal(activate(t.state, A, lantern), 'wrong-timing');
      t.expect(reason.rule).toBe('151.2');
    },
  });
});

describe('818 Equip, 716–719 Attachment', () => {
  scenario('rule 818.1.b: Equip attaches the gear to a chosen unit', {
    rules: [
      '818.1.b',
      '818',
      '818.1',
      '818.1.a',
      '818.1.b.1',
      '818.1.b.2',
      '818.1.c',
      '818.1.c.2',
      '818.2',
      '150',
      '150.1',
      '150.2',
      '150.3',
      '150.4',
      '435',
      '435.1',
      '435.1.a',
      '435.1.a.1',
      '435.1.c',
      '435.1.d',
      '435.2',
      '435.2.a',
      '716',
      '717',
      '718',
      '718.1',
      '718.3',
      '718.4',
      '719',
      '719.1',
      '136',
      '136.1',
      '136.2',
      '136.2.c',
      '137',
      '137.1',
      '137.3',
      '148.1.a.2',
    ],
    setup: () => {
      let state = start([v(1), 'Blade', v(2), v(3)]);
      state = playAll(state, A, ['test:vanilla-1', 'test:blade']);
      return endTurn(endTurn(state).state).state;
    },
    check: (t) => {
      const blade = inBase(t.state, A, TEST_CARDS.blade.id);
      const vanilla = inBase(t.state, A, 'test:vanilla-1' as CardId);
      t.expect(t.state.cards[TEST_CARDS.blade.id]?.tags).toContain('Equipment');
      // Equip [1]: "[1]: Attach this gear to a unit you control."
      t.act(activate(t.state, A, blade, [vanilla]), pass(A), pass(B));
      t.expect(ofType(t.events, 'GearAttached')).toMatchObject([
        { player: A, gear: blade, unit: vanilla },
      ]);
      t.expect(t.state.objects[vanilla]?.attached).toEqual([blade]);
      t.expect(t.state.players[0]?.zones.base).not.toContain(blade);
      // Might 1, +1 for Blade's Might Bonus; Blade's Effect Text, [Assault 2], is now Vanilla 1's.
      t.expect(characteristics(t.state, vanilla)).toMatchObject({ might: 2, assault: 2 });
      // Public, under the unit.
      const shown = viewFor(t.state, B).opponents[0]?.zones.base.find((o) => o.id === vanilla);
      t.expect(shown?.attached).toMatchObject([{ id: blade, card: TEST_CARDS.blade.id }]);
    },
  });

  scenario("rule 718.2: while Attached, a card's Rules Text is Inactive", {
    rules: ['718.2', '720', '721', '721.1', '721.2', '722', '722.1', '818.5', '818.5.a', '136.2.b'],
    // Vanilla 1 equipped with Blade on turn 3; A also played Vanilla 2.
    setup: () => {
      let state = start([v(1), 'Blade', v(2), v(3)]);
      state = playAll(state, A, ['test:vanilla-1', 'test:blade']);
      state = endTurn(endTurn(state).state).state;
      state = act(state, play(state, A, 'test:vanilla-2')).state;
      const blade = inBase(state, A, TEST_CARDS.blade.id);
      const vanilla = inBase(state, A, 'test:vanilla-1' as CardId);
      return act(state, activate(state, A, blade, [vanilla]), pass(A), pass(B)).state;
    },
    check: (t) => {
      const [vanilla] = unitsInBase(t.state, A).filter(
        (u) => t.state.objects[u]?.card === 'test:vanilla-1',
      ) as [ObjectId];
      const [blade] = t.state.objects[vanilla]?.attached ?? [];
      const other = inBase(t.state, A, 'test:vanilla-2' as CardId);
      // Its Equip cannot be activated again while it is Attached.
      t.expect(
        t.actIllegal(activate(t.state, A, blade as ObjectId, [other]), 'invalid-source').rule,
      ).toBe('721.2');
      // It still has Equip (722.1, 818.5.a); its own Effect Text does not apply to itself (136.2.b).
      t.expect(characteristics(t.state, blade as ObjectId)).toMatchObject({
        keywords: ['equip'],
        assault: 0,
      });
    },
  });

  scenario('rule 719.3.a: when the Top-Most Card changes locations, its Attached cards follow', {
    rules: ['719.3.a', '719.3', '719.4'],
    setup: () => equipped(),
    check: (t) => {
      const vanilla = inBase(t.state, A, 'test:vanilla-1' as CardId);
      const [blade] = t.state.objects[vanilla]?.attached ?? [];
      t.act(move(A, [vanilla], battlefield(t.state, 0)));
      const there = viewFor(t.state, A).battlefields[0]?.units.find((u) => u.id === vanilla);
      t.expect(there?.attached).toMatchObject([{ id: blade }]);
      // Moving exhausted the unit, not the gear (719.4).
      t.expect(t.state.objects[vanilla]?.exhausted).toBe(true);
      t.expect(t.state.objects[blade as ObjectId]?.exhausted).toBe(false);
    },
  });

  scenario(
    'rule 459.1: Equipment left at a battlefield by a unit that died is recalled in the next cleanup',
    {
      rules: [
        '459.1',
        '459',
        '323.6',
        '457',
        '458',
        '458.2',
        '719.5',
        '436',
        '436.1',
        '436.1.a',
        '436.1.b',
        '436.4',
        '436.4.a',
        '436.4.b',
      ],
      // Turn 3: Vanilla 1, equipped (Might 2), conquers a battlefield; then Bolt deals 2 to it.
      setup: () => {
        const state = equipped(['Bolt']);
        const vanilla = inBase(state, A, 'test:vanilla-1' as CardId);
        return act(
          state,
          move(A, [vanilla], battlefield(state, 0)),
          { type: 'PassFocus', player: A },
          { type: 'PassFocus', player: B },
        ).state;
      },
      check: (t) => {
        const [vanilla] = t.state.battlefields[0]?.units ?? [];
        const [blade] = t.state.objects[vanilla as ObjectId]?.attached ?? [];
        t.act(play(t.state, A, 'test:bolt', [vanilla as ObjectId]), pass(A), pass(B));
        t.expect(ofType(t.events, 'UnitKilled')).toMatchObject([{ unit: vanilla }]);
        t.expect(ofType(t.events, 'GearDetached')).toMatchObject([{ gear: blade, unit: vanilla }]);
        t.expect(ofType(t.events, 'GearRecalled')).toMatchObject([
          { player: A, gear: [blade], rule: '323.6' },
        ]);
        t.expect(ofType(t.events, 'UnitsMoved')).toEqual([]);
        t.expect(t.state.players[0]?.zones.base).toContain(blade);
        t.expect(t.state.battlefields[0]?.gear).toEqual([]);
      },
    },
  );
});
