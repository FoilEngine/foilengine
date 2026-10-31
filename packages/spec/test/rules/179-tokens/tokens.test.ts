// Tokens (179–187). When a token played by a resolving effect enters the board is Q-003
// (docs/rules/questions.md): the engine's provisional decision is that it enters at once, so a
// later linked instruction of the same effect affects it. The rules of that question are not
// cited here: they stay `question` in the coverage report.

import { autoPayment, characteristics, createGame } from '@foilengine/rules';
import { board, scenario, TEST_CARDS, testDeck, testSetup } from '@foilengine/testkit';
import type { Action, CardId, GameState, ObjectId, PlayerId, Seed } from '@foilengine/types';
import { describe, expect, it } from 'vitest';
import { A, act, B, endTurn, inHand, ofType, unitsInBase, v } from '../../battlefields.ts';

const pass = (player: PlayerId): Action => ({ type: 'PassPriority', player });

const start = (handA: string[]) =>
  board()
    .setup(testSetup({ withAbilities: true }))
    .firstPlayer('A')
    .player('A', { hand: handA, mainDeckTop: [v(5), v(6), v(7), v(8)] })
    .player('B', { hand: [v(1), v(2), v(3), v(4)], mainDeckTop: [v(5), v(6), v(7), v(8)] })
    .afterMulligans()
    .build();

/** `player` plays `card` (a test card id), paid with autoPayment; a unit goes to the base. */
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

const recruits = (state: GameState, player: PlayerId) =>
  unitsInBase(state, player).filter((u) => state.objects[u]?.card === TEST_CARDS.recruit.id);

describe('179–187 Tokens', () => {
  scenario('rule 185.2.d: a token unit is a unit: it enters exhausted, and effects affect it', {
    rules: ['185.2.d', '179', '180', '185', '185.1', '185.2', '185.2.b', '185.2.c'],
    // Turn 1: two runes, Muster costs 2: "Play a 1 [M] Recruit unit token into your base,
    // then buff it."
    setup: () => start(['Muster', v(1), v(2), v(3)]),
    check: (t) => {
      t.act(play(t.state, A, 'test:muster'), pass(A), pass(B));
      const [recruit] = recruits(t.state, A) as [ObjectId];
      t.expect(ofType(t.events, 'TokenPlayed')).toMatchObject([
        { player: A, object: recruit, card: TEST_CARDS.recruit.id },
      ]);
      t.expect(t.state.objects[recruit]).toMatchObject({ exhausted: true, buffs: 1 });
      // Might 1, and +1 for its buff (702.2.a); the Recruit tag.
      t.expect(characteristics(t.state, recruit).might).toBe(2);
      t.expect(t.state.cards[TEST_CARDS.recruit.id]?.tags).toEqual(['Recruit']);
    },
  });

  scenario("rule 183: a token's owner is the player who controlled the effect that created it", {
    rules: ['183', '182'],
    // Turn 1: A plays Summoner; its Play Effect plays a Recruit.
    setup: () => start(['Summoner', v(1), v(2), v(3)]),
    check: (t) => {
      t.act(play(t.state, A, 'test:summoner'));
      t.expect(recruits(t.state, A)).toEqual([]);
      t.act(pass(A), pass(B));
      const [recruit] = recruits(t.state, A) as [ObjectId];
      t.expect(t.state.objects[recruit]?.owner).toBe(A);
      t.expect(recruits(t.state, B)).toEqual([]);
    },
  });

  scenario('rule 186.1: a token put into a Non-Board Zone ceases to exist there', {
    rules: ['186.1', '186'],
    // Turn 1: Summoner plays a Recruit. Turn 3: Bolt deals 2 to it.
    setup: () => {
      let state = start(['Summoner', 'Bolt', v(1), v(2)]);
      state = act(state, play(state, A, 'test:summoner'), pass(A), pass(B)).state;
      return endTurn(endTurn(state).state).state;
    },
    check: (t) => {
      const [recruit] = recruits(t.state, A) as [ObjectId];
      t.act(play(t.state, A, 'test:bolt', [recruit]), pass(A), pass(B));
      const [killed] = ofType(t.events, 'UnitKilled');
      t.expect(killed).toMatchObject({ unit: recruit, player: A });
      t.expect(ofType(t.events, 'TokenCeasedToExist')).toMatchObject([
        { object: killed?.object, rule: '186.1' },
      ]);
      t.expect(t.state.objects[killed?.object as ObjectId]).toBeUndefined();
      t.expect(t.state.players.find((p) => p.id === A)?.zones.trash).not.toContain(killed?.object);
    },
  });
});

describe('185 Tokens in a setup', () => {
  it('rule 185: tokens are not cards: a deck cannot contain one', () => {
    const mainDeck = [...testDeck().mainDeck, TEST_CARDS.recruit.id];
    const setup = testSetup({
      players: [
        { id: A, deck: testDeck({ mainDeck }) },
        { id: B, deck: testDeck() },
      ],
    });
    const result = createGame(setup, 'seed' as Seed);
    expect(result.ok ? [] : result.problems).toMatchObject([
      { code: 'invalid-token', player: A, rule: '185' },
    ]);
  });

  it('rule 185.1: an effect can only play a token that has a token definition', () => {
    const { [TEST_CARDS.recruit.id]: _, ...cards } = testSetup().cards;
    const result = createGame(testSetup({ cards }), 'seed' as Seed);
    expect(result.ok ? [] : result.problems).toMatchObject([
      { code: 'invalid-token', player: null, rule: '185.1' },
    ]);
  });
});
