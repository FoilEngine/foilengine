// Setup (113–115): where the battlefields and the decks go, and the turn order.

import { createGame } from '@foilengine/rules';
import { scenario, TEST_CARDS, testDeck, testSetup } from '@foilengine/testkit';
import type { GameState, PlayerId, Seed } from '@foilengine/types';
import { describe } from 'vitest';
import { endTurn } from '../../battlefields.ts';
import { A, B, keepAll, start } from '../../support.ts';

const battlefieldCards = new Set<string>(TEST_CARDS.battlefields.map((b) => b.id));

describe('113–115 Setup', () => {
  scenario(
    'rule 113: each player sets their battlefields aside; the 1v1 mode uses one of each (113.1)',
    {
      rules: ['113', '113.1'],
      setup: () => start().state,
      check: (t) => {
        // 487.5: one battlefield per player is in the Battlefield Zone; the two others are not used,
        // so they are in no zone at all.
        t.expect(t.state.battlefields.map((b) => t.state.objects[b.object]?.owner)).toEqual([A, B]);
        const battlefieldObjects = Object.values(t.state.objects).filter((o) =>
          battlefieldCards.has(o.card),
        );
        t.expect(battlefieldObjects).toHaveLength(2);
        for (const id of [A, B]) {
          for (const zone of Object.values(t.player(id).zones)) {
            for (const object of zone) {
              t.expect(battlefieldCards.has(t.state.objects[object]?.card as string)).toBe(false);
            }
          }
        }
      },
    },
  );

  scenario(
    'rule 114.1: the Main Deck goes to the Main Deck Zone, the Rune Deck to the Rune Deck Zone',
    {
      rules: ['114.1', '114.2', '161.2'],
      setup: () => start().state,
      check: (t) => {
        const deck = testDeck();
        const cardsIn = (ids: readonly string[]) =>
          ids.map((id) => t.state.objects[id as never]?.card as string).sort();
        for (const id of [A, B]) {
          const zones = t.player(id).zones;
          // The champion (once in the deck) went to the Champion Zone (112); four cards were drawn (116).
          t.expect(cardsIn([...zones.mainDeck, ...zones.hand])).toEqual(
            deck.mainDeck.filter((c) => c !== deck.champion).sort(),
          );
          t.expect(cardsIn(zones.runeDeck)).toEqual([...deck.runeDeck].sort());
        }
      },
    },
  );

  scenario(
    'rule 115.1: the turn order repeats: the First Player, then the other player (115.1.b)',
    {
      rules: ['115.1', '115.1.b', '115.1.b.1'],
      setup: () => keepAll(start(testSetup(), 'turn-order').state).state,
      check: (t) => {
        const [first, second] = t.state.turnOrder as [PlayerId, PlayerId];
        const turnPlayers: PlayerId[] = [];
        let state: GameState = t.state;
        for (let turn = 0; turn < 4; turn++) {
          if (state.stage.kind !== 'turn') throw new Error('no turn');
          turnPlayers.push(state.stage.turnPlayer);
          state = endTurn(state).state;
        }
        // 115.1.b.1: the First Player is the one who becomes the Turn Player first.
        t.expect(turnPlayers).toEqual([first, second, first, second]);
      },
    },
  );
});

describe('161 Runes', () => {
  scenario(
    'rule 161: runes are a card type of their own, kept in the Rune Deck, not the Main Deck',
    {
      rules: ['161', '161.1'],
      setup: () => start().state,
      check: (t) => {
        const categoryOf = (id: string) =>
          t.state.cards[t.state.objects[id as never]?.card as never]?.category;
        for (const id of [A, B]) {
          const zones = t.player(id).zones;
          t.expect(zones.runeDeck.every((o) => categoryOf(o) === 'rune')).toBe(true);
          t.expect([...zones.mainDeck, ...zones.hand].some((o) => categoryOf(o) === 'rune')).toBe(
            false,
          );
        }
        // A rune cannot be put in the Main Deck (133.4).
        const setup = testSetup({
          players: [
            { id: A, deck: testDeck({ mainDeck: [...testDeck().mainDeck, TEST_CARDS.rune.id] }) },
            { id: B, deck: testDeck() },
          ],
        });
        t.expect(createGame(setup, 'rune' as Seed).ok).toBe(false);
      },
    },
  );

  scenario('rule 161.2.a: the Rune Deck has exactly 12 runes', {
    rules: ['161.2.a'],
    setup: () => start().state,
    check: (t) => {
      const withRunes = (count: number) =>
        createGame(
          testSetup({
            players: [
              { id: A, deck: testDeck({ runeDeck: Array(count).fill(TEST_CARDS.rune.id) }) },
              { id: B, deck: testDeck() },
            ],
          }),
          'runes' as Seed,
        ).ok;
      t.expect([withRunes(11), withRunes(12), withRunes(13)]).toEqual([false, true, false]);
      t.expect(t.player(A).zones.runeDeck).toHaveLength(12);
    },
  });
});
