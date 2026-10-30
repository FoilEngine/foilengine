import { apply, legalActions } from '@foilengine/rules';
import { board, scenario } from '@foilengine/testkit';
import type { CardId, ObjectId, PlayerId } from '@foilengine/types';
import { describe, expect, it } from 'vitest';

const v = (n: number) => `Vanilla ${n}`;
const id = (n: number) => `test:vanilla-${n}` as CardId;
const A = 'A' as PlayerId;
const B = 'B' as PlayerId;

/** A goes first, with Vanilla 1–4 in hand and Vanilla 5, 6 on top of their deck. */
const stacked = () =>
  board()
    .firstPlayer('A')
    .player('A', { hand: [v(1), v(2), v(3), v(4)], mainDeckTop: [v(5), v(6)] });

describe('117 Mulligan', () => {
  scenario('rule 117: players perform their Mulligan in turn order', {
    rules: ['117'],
    setup: board().firstPlayer('B'),
    check: (t) => {
      t.expectDecision({ kind: 'Mulligan', player: B, max: 2, rule: '117.1' });
      t.actIllegal(t.mulligan('A', []), 'not-your-decision');
      t.act(t.mulligan('B', []));
      t.expectDecision({ kind: 'Mulligan', player: A });
    },
  });

  scenario('rule 117.1: a player may set aside up to two cards', {
    rules: ['117.1'],
    setup: stacked(),
    check: (t) => {
      t.expectLegal(t.mulligan('A', [v(1), v(2)]));
      t.expectIllegal(t.mulligan('A', [v(1), v(2), v(3)]), 'too-many-cards');
    },
  });

  scenario('rule 117.1: the cards set aside come from the hand, each once', {
    rules: ['117.1'],
    setup: stacked(),
    check: (t) => {
      const deckCard = t.player('A').zones.mainDeck[0] as ObjectId;
      t.expectIllegal({ type: 'Mulligan', player: A, setAside: [deckCard] }, 'card-not-in-hand');
      const [first] = t.player('A').zones.hand as ObjectId[];
      t.expectIllegal(
        { type: 'Mulligan', player: A, setAside: [first as ObjectId, first as ObjectId] },
        'duplicate-card',
      );
    },
  });

  scenario('rule 117.1: keeping the hand is setting aside no card', {
    rules: ['117.1'],
    setup: stacked(),
    act: (t) => t.act(t.mulligan('A', [])),
    check: (t) => {
      t.expectEvents(['MulliganTaken']);
      t.expect(t.events[0]).toMatchObject({ rule: '117', count: 0 });
      t.expect(t.hand('A')).toEqual([id(1), id(2), id(3), id(4)]);
    },
  });

  scenario('rule 117.2: the player draws as many cards as they set aside', {
    rules: ['117.2'],
    setup: stacked(),
    act: (t) => t.act(t.mulligan('A', [v(1), v(3)])),
    check: (t) => {
      t.expect(t.hand('A')).toEqual([id(2), id(4), id(5), id(6)]);
      const draws = t.events.filter((e) => e.type === 'CardDrawn');
      t.expect(draws.map((e) => e.rule)).toEqual(['117.2', '117.2']);
    },
  });

  scenario('rule 117.3: the cards set aside are recycled to the bottom of the Main Deck', {
    rules: ['117.3', '417.1.a'],
    setup: stacked(),
    act: (t) => t.act(t.mulligan('A', [v(1), v(3)])),
    check: (t) => {
      t.expectEvents(['MulliganTaken', 'CardDrawn', 'CardDrawn', 'CardRecycled', 'CardRecycled']);
      t.expect(t.mainDeck('A')).toHaveLength(35);
      t.expect([...t.mainDeck('A').slice(-2)].sort()).toEqual([id(1), id(3)]);
      const recycled = t.events.filter((e) => e.type === 'CardRecycled');
      t.expect(
        recycled.every((e) => e.rule === '117.3' && e.from === 'hand' && e.to === 'mainDeck'),
      ).toBe(true);
    },
  });

  it('rule 417.5: two cards recycled together go to the bottom in a random order', () => {
    const bottoms = new Set<string>();
    for (let i = 0; i < 30; i++) {
      const state = stacked().seed(`recycle-${i}`).build();
      const hand = state.players.find((p) => p.id === A)?.zones.hand ?? [];
      const setAside = [hand[0], hand[2]] as ObjectId[];
      const after = apply(state, { type: 'Mulligan', player: A, setAside }).state;
      const deck = after.players.find((p) => p.id === A)?.zones.mainDeck ?? [];
      bottoms.add(
        deck
          .slice(-2)
          .map((o) => after.objects[o]?.card)
          .join(','),
      );
    }
    expect(bottoms).toEqual(new Set([`${id(1)},${id(3)}`, `${id(3)},${id(1)}`]));
  });

  scenario('rule 124: a recycled card becomes a new object; its identity stays private (108.7.c)', {
    rules: ['124', '108.7.c'],
    setup: stacked(),
    check: (t) => {
      const [first] = t.player('A').zones.hand as ObjectId[];
      t.act({ type: 'Mulligan', player: A, setAside: [first as ObjectId] });
      const recycled = t.events.find((e) => e.type === 'CardRecycled');
      t.expect(recycled).toMatchObject({
        previousObject: first,
        visibility: { kind: 'private', to: [A] },
      });
      t.expect(recycled?.type === 'CardRecycled' && recycled.object).not.toBe(first);
      t.expect(t.state.objects[first as ObjectId]).toBeUndefined();
    },
  });

  scenario('rule 117.1: the legal mulligans are every choice of up to two cards of the hand', {
    rules: ['117.1'],
    setup: stacked(),
    check: (t) => {
      // 1 (keep) + 4 (one card) + 6 (two cards) for a hand of 4, then conceding (650).
      const mulligans = legalActions(t.state, A).filter((a) => a.type === 'Mulligan');
      t.expect(mulligans).toHaveLength(11);
      for (const action of legalActions(t.state, A)) t.expectLegal(action);
      t.expect(legalActions(t.state, B)).toEqual([{ type: 'Concede', player: B }]);
    },
  });

  scenario('rule 118: after the last mulligan, the First Player takes their first turn', {
    rules: ['118'],
    setup: stacked(),
    act: (t) => t.act(t.mulligan('A', []), t.mulligan('B', [])),
    check: (t) => {
      t.expect(t.events.find((e) => e.type === 'SetupCompleted')).toMatchObject({ firstPlayer: A });
      t.expect(t.events.find((e) => e.type === 'TurnStarted')).toMatchObject({
        player: A,
        turnNumber: 1,
      });
      t.expectDecision({ kind: 'Priority', player: A });
      t.expectIllegal(t.mulligan('A', []), 'wrong-action');
    },
  });
});
