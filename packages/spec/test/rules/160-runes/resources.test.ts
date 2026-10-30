import { board, scenario, TEST_CARDS, testDeck, testSetup } from '@foilengine/testkit';
import type { GameEvent, ObjectId, PlayerId } from '@foilengine/types';
import { describe } from 'vitest';

const A = 'A' as PlayerId;
const v = (n: number) => `Vanilla ${n}`;
const ofType = <T extends GameEvent['type']>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);

/**
 * A's first Main Phase: two Fury runes in base, Vanilla 1–5 in hand.
 * Vanilla n costs 1 + (n-1) % 4 Energy, plus one Fury Power when n is a multiple of 5.
 */
const firstMainPhase = () =>
  board()
    .firstPlayer('A')
    .player('A', { hand: [v(1), v(2), v(3), v(4)], mainDeckTop: [v(5)] })
    .afterMulligans();

/** A deck with a Calm Unit, an Any Unit and Calm runes, and a first Main Phase with a Calm and a Fury rune. */
const twoDomains = () => {
  const vanillas = TEST_CARDS.vanillas.map((c) => c.id);
  const deck = testDeck({
    mainDeck: [
      TEST_CARDS.champion.id,
      TEST_CARDS.calmUnit.id,
      TEST_CARDS.anyUnit.id,
      ...vanillas.slice(2),
    ],
    runeDeck: [...Array(6).fill(TEST_CARDS.rune.id), ...Array(6).fill(TEST_CARDS.calmRune.id)],
  });
  return board()
    .setup(
      testSetup({
        players: [
          { id: A, deck },
          { id: 'B' as PlayerId, deck: testDeck() },
        ],
      }),
    )
    .firstPlayer('A')
    .player('A', {
      hand: ['Calm Unit', 'Any Unit', v(3), v(4)],
      mainDeckTop: [v(5)],
      runeDeckTop: ['Calm Rune', 'Fury Rune'],
    })
    .afterMulligans();
};

const runes = (t: { player: (id: string) => { zones: { base: readonly ObjectId[] } } }) =>
  t.player('A').zones.base as [ObjectId, ObjectId];
const handCard = (
  t: {
    player: (id: string) => { zones: { hand: readonly ObjectId[] } };
    state: { objects: Record<string, { card: string } | undefined> };
  },
  card: string,
) => t.player('A').zones.hand.find((id) => t.state.objects[id]?.card === card) as ObjectId;

describe('160–168 Runes and Rune Pools', () => {
  scenario("rule 164.2.a: exhausting a Basic Rune adds 1 Energy to its controller's Rune Pool", {
    rules: ['164.2.a', '163.1', '166.1', '430.1'],
    setup: firstMainPhase(),
    check: (t) => {
      const [r1, r2] = runes(t);
      t.act({
        type: 'PlayCard',
        player: A,
        card: handCard(t, 'test:vanilla-2'),
        location: { kind: 'base' },
        payment: [
          { rune: r1, use: 'exhaust' },
          { rune: r2, use: 'exhaust' },
        ],
      });
      t.expect(ofType(t.events, 'ObjectExhausted').map((e) => e.object)).toEqual([r1, r2]);
      t.expect(ofType(t.events, 'ResourcesAdded').map((e) => [e.rule, e.resources])).toEqual([
        ['164.2.a', { energy: 1, power: {} }],
        ['164.2.a', { energy: 1, power: {} }],
      ]);
      t.expect(t.state.objects[r1]?.exhausted && t.state.objects[r2]?.exhausted).toBe(true);
    },
  });

  scenario(
    'rule 164.2.b: recycling a Basic Rune adds 1 Power of its domain; it goes to the bottom of the Rune Deck',
    {
      rules: ['164.2.b', '164.2.b.1', '161.2.b', '417.1.b', '163.2', '163.2.a.1'],
      setup: firstMainPhase(),
      check: (t) => {
        const [r1, r2] = runes(t);
        t.act({
          type: 'PlayCard',
          player: A,
          card: handCard(t, 'test:vanilla-5'),
          location: { kind: 'base' },
          payment: [
            { rune: r1, use: 'exhaust' },
            { rune: r2, use: 'recycle' },
          ],
        });
        const [recycled] = ofType(t.events, 'CardRecycled');
        t.expect(recycled).toMatchObject({
          rule: '164.2.b',
          previousObject: r2,
          from: 'base',
          to: 'runeDeck',
        });
        t.expect(t.player('A').zones.runeDeck.at(-1)).toBe(recycled?.object);
        t.expect(t.player('A').zones.base).not.toContain(r2);
        t.expect(ofType(t.events, 'ResourcesAdded').at(-1)?.resources).toEqual({
          energy: 0,
          power: { fury: 1 },
        });
      },
    },
  );

  scenario('rule 164.2: a rune can be exhausted for Energy, then recycled for Power', {
    rules: ['164.2'],
    setup: firstMainPhase(),
    check: (t) => {
      const [r1] = runes(t);
      t.act({
        type: 'PlayCard',
        player: A,
        card: handCard(t, 'test:vanilla-5'),
        location: { kind: 'base' },
        payment: [
          { rune: r1, use: 'exhaust' },
          { rune: r1, use: 'recycle' },
        ],
      });
      t.expect(ofType(t.events, 'ResourcesPaid')).toMatchObject([
        { resources: { energy: 1, power: { fury: 1 } } },
      ]);
    },
  });

  scenario('rule 415.4: an exhausted rune cannot be exhausted again to pay', {
    rules: ['415.4'],
    setup: firstMainPhase(),
    check: (t) => {
      const [r1] = runes(t);
      const card = handCard(t, 'test:vanilla-2');
      t.actIllegal(
        {
          type: 'PlayCard',
          player: A,
          card,
          location: { kind: 'base' },
          payment: [
            { rune: r1, use: 'exhaust' },
            { rune: r1, use: 'exhaust' },
          ],
        },
        'invalid-payment',
      );
    },
  });

  scenario('rule 358.2: a card whose cost is not paid is not played, and nothing happens', {
    rules: ['358.2', '358.5', '357.1'],
    setup: firstMainPhase(),
    check: (t) => {
      const [r1, r2] = runes(t);
      const reason = t.actIllegal(
        {
          type: 'PlayCard',
          player: A,
          card: handCard(t, 'test:vanilla-3'),
          location: { kind: 'base' },
          payment: [
            { rune: r1, use: 'exhaust' },
            { rune: r2, use: 'exhaust' },
          ],
        },
        'cannot-pay',
      );
      t.expect(reason.rule).toBe('358.2');
      t.expect(t.state.objects[r1]?.exhausted).toBe(false);
    },
  });

  scenario(
    'rule 166.2: unspent resources stay in the Rune Pool, then are lost at the end of the turn',
    {
      rules: ['166.2', '167', '167.1', '317.2.d'],
      setup: firstMainPhase(),
      check: (t) => {
        const [r1, r2] = runes(t);
        t.act({
          type: 'PlayCard',
          player: A,
          card: handCard(t, 'test:vanilla-1'),
          location: { kind: 'base' },
          payment: [
            { rune: r1, use: 'exhaust' },
            { rune: r2, use: 'exhaust' },
          ],
        });
        t.expect(t.player('A').runePool.energy).toBe(1);
        t.act({ type: 'EndTurn', player: A });
        t.expect(ofType(t.events, 'RunePoolEmptied')).toMatchObject([
          { player: A, rule: '317.2.d', lost: { energy: 1, power: {} } },
        ]);
        t.expect(t.player('A').runePool.energy).toBe(0);
      },
    },
  );

  scenario('rule 163.2: Power of a domain pays costs of that domain only', {
    rules: ['163.2', '131.3.a'],
    setup: twoDomains(),
    check: (t) => {
      const [calm, fury] = runes(t);
      const calmUnit = handCard(t, 'test:calm-unit');
      t.actIllegal(
        {
          type: 'PlayCard',
          player: A,
          card: calmUnit,
          location: { kind: 'base' },
          payment: [
            { rune: calm, use: 'exhaust' },
            { rune: fury, use: 'recycle' },
          ],
        },
        'cannot-pay',
      );
      t.act({
        type: 'PlayCard',
        player: A,
        card: calmUnit,
        location: { kind: 'base' },
        payment: [
          { rune: fury, use: 'exhaust' },
          { rune: calm, use: 'recycle' },
        ],
      });
      t.expect(ofType(t.events, 'CardPlayed')).toHaveLength(1);
    },
  });

  scenario('rule 135.2.e.5.a: a [A] cost is paid with Power of any domain', {
    rules: ['135.2.e.5.a'],
    setup: twoDomains(),
    check: (t) => {
      const [, fury] = runes(t);
      t.act({
        type: 'PlayCard',
        player: A,
        card: handCard(t, 'test:any-unit'),
        location: { kind: 'base' },
        payment: [{ rune: fury, use: 'recycle' }],
      });
      t.expect(ofType(t.events, 'ResourcesPaid')).toMatchObject([
        { resources: { energy: 0, power: { fury: 1 } } },
      ]);
    },
  });

  scenario('rule 107.1.c: a player pays with the runes in their own base only', {
    rules: ['107.1.c'],
    setup: firstMainPhase(),
    check: (t) => {
      const deckRune = t.player('A').zones.runeDeck[0] as ObjectId;
      t.actIllegal(
        {
          type: 'PlayCard',
          player: A,
          card: handCard(t, 'test:vanilla-1'),
          location: { kind: 'base' },
          payment: [{ rune: deckRune, use: 'exhaust' }],
        },
        'invalid-payment',
      );
    },
  });
});
