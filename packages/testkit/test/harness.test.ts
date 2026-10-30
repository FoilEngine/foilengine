import { createGame } from '@foilengine/rules';
import type { CardId, GameState, Seed } from '@foilengine/types';
import { describe, expect, it } from 'vitest';
import {
  BoardError,
  board,
  checkScenarioDefinition,
  scenario,
  TEST_CARDS,
  testSetup,
} from '../src/index.ts';

const cardsIn = (state: GameState, player: string, zone: 'hand' | 'mainDeck'): CardId[] => {
  const ids = state.players.find((p) => p.id === player)?.zones[zone] ?? [];
  return ids.map((id) => state.objects[id]?.card as CardId);
};
const sorted = (cards: readonly string[]) => [...cards].sort();
const vanilla = (n: number) => `Vanilla ${n}`;

describe('board()', () => {
  it('without options, is the game createGame builds from the same setup and seed', () => {
    const created = createGame(testSetup(), 'board' as Seed);
    expect(created.ok && created.state).toEqual(board().build());
  });

  it('chooses the First Player; the other follows in seating order', () => {
    const state = board().firstPlayer('B').build();
    expect(state.turnOrder).toEqual(['B', 'A']);
    expect(state.stage).toEqual({ kind: 'mulligan', pending: ['B', 'A'] });
  });

  it('stacks the hand and the top of the Main Deck, keeping the same cards', () => {
    const plain = board().build();
    const state = board()
      .player('A', {
        hand: [vanilla(1), vanilla(2), vanilla(3), vanilla(4)],
        mainDeckTop: [vanilla(5), 'test:vanilla-6'],
      })
      .build();
    expect(cardsIn(state, 'A', 'hand')).toEqual([
      'test:vanilla-1',
      'test:vanilla-2',
      'test:vanilla-3',
      'test:vanilla-4',
    ]);
    expect(cardsIn(state, 'A', 'mainDeck').slice(0, 2)).toEqual([
      'test:vanilla-5',
      'test:vanilla-6',
    ]);
    // Same cards, same objects: only the outcome of the shuffle changed.
    expect(sorted([...cardsIn(state, 'A', 'hand'), ...cardsIn(state, 'A', 'mainDeck')])).toEqual(
      sorted([...cardsIn(plain, 'A', 'hand'), ...cardsIn(plain, 'A', 'mainDeck')]),
    );
    expect(Object.keys(state.objects)).toEqual(Object.keys(plain.objects));
    expect(cardsIn(state, 'B', 'hand')).toEqual(cardsIn(plain, 'B', 'hand'));
  });

  it('only stacks the top of the deck when the hand is not given', () => {
    const plain = board().build();
    const inHand = cardsIn(plain, 'A', 'hand');
    const notInHand = TEST_CARDS.vanillas
      .map((c) => c.id)
      .find((id) => !inHand.includes(id)) as CardId;
    const state = board()
      .player('A', { mainDeckTop: [notInHand] })
      .build();
    expect(cardsIn(state, 'A', 'hand')).toEqual(inHand);
    expect(cardsIn(state, 'A', 'mainDeck')[0]).toBe(notInHand);
  });

  it('can go past the mulligans', () => {
    const state = board().firstPlayer('A').afterMulligans().build();
    expect(state.stage).toEqual({ kind: 'turn', turnPlayer: 'A', turnNumber: 1, phase: 'main' });
  });

  it('refuses what the deck cannot provide', () => {
    expect(() =>
      board()
        .player('A', { mainDeckTop: ['Test Legend'] })
        .build(),
    ).toThrow(BoardError);
    expect(() =>
      board()
        .player('A', { mainDeckTop: [vanilla(1), vanilla(1)] })
        .build(),
    ).toThrow('no more "Vanilla 1"');
    expect(() =>
      board()
        .player('A', { hand: [vanilla(1)] })
        .build(),
    ).toThrow('hand holds 4 cards');
    expect(() =>
      board()
        .player('A', { hand: ['Nobody', 'a', 'b', 'c'] })
        .build(),
    ).toThrow('No card');
    expect(() => board().firstPlayer('Z').build()).toThrow('Z is not a player');
  });

  it('asks for an id when a name is ambiguous', () => {
    const builder = board().setup(testSetup({ distinctDecks: true }));
    expect(() => builder.player('B', { mainDeckTop: [vanilla(1)] }).build()).toThrow('use an id');
  });

  it('refuses an invalid setup, like createGame', () => {
    expect(() =>
      board()
        .setup(testSetup({ mode: 'ffa3' }))
        .build(),
    ).toThrow('The setup is refused');
  });
});

describe('scenario()', () => {
  it('requires the title to start with the first declared rule', () => {
    expect(checkScenarioDefinition('rule 117.2: draws', ['117.2'])).toEqual([]);
    expect(checkScenarioDefinition('draws', ['117.2'])).toEqual([
      'The title must start with "rule 117.2: " (the first declared rule)',
    ]);
    expect(checkScenarioDefinition('rule 117: draws', ['117.2', '117'])).toHaveLength(1);
    expect(checkScenarioDefinition('rule 117: draws', [])).toEqual([
      'A scenario declares at least one rule',
    ]);
  });

  it('only accepts rules that exist in the current Core Rules', () => {
    expect(checkScenarioDefinition('rule 999.9: nothing', ['999.9'])).toEqual([
      'Rule 999.9 does not exist in the current Core Rules',
    ]);
  });

  it('refuses an invalid scenario when it is declared', () => {
    expect(() =>
      scenario('no rule here', { rules: ['117'], setup: board(), check: () => {} }),
    ).toThrow('Invalid scenario');
  });
});

// A real scenario, as written in @foilengine/spec.
describe('scenario() in use', () => {
  scenario('rule 117.2: the player draws as many cards as they set aside', {
    rules: ['117.2'],
    setup: board()
      .firstPlayer('A')
      .player('A', {
        hand: [vanilla(1), vanilla(2), vanilla(3), vanilla(4)],
        mainDeckTop: [vanilla(5), vanilla(6)],
      }),
    act: (t) => t.act(t.mulligan('A', [vanilla(1), vanilla(2)])),
    check: (t) => {
      t.expectEvents(['MulliganTaken', 'CardDrawn', 'CardDrawn', 'CardRecycled', 'CardRecycled']);
      t.expect(t.hand('A')).toEqual([
        'test:vanilla-3',
        'test:vanilla-4',
        'test:vanilla-5',
        'test:vanilla-6',
      ]);
      t.expectDecision({ kind: 'Mulligan', player: 'B' as never });
      t.actIllegal(t.mulligan('A', []), 'not-your-decision');
    },
  });
});
