// Test cards: fictional cards to test a rule without depending on a real card
// (docs/06-testing.md). Ids start with `test:` and never collide with a riftbound_id.

import type {
  CardCategory,
  CardDefinition,
  CardId,
  DeckList,
  Domain,
  GameSetup,
  PlayerId,
  PlayerSetup,
  Supertype,
} from '@foilengine/types';

const card = (
  id: string,
  category: CardCategory,
  options: { supertypes?: Supertype[]; tags?: string[]; domains?: Domain[]; name?: string } = {},
): CardDefinition => ({
  id: id as CardId,
  name: options.name ?? id,
  category,
  supertypes: options.supertypes ?? [],
  tags: options.tags ?? [],
  domains: options.domains ?? ['fury'],
  text: '',
});

/** A vanilla unit per index, so that a 40-card deck has distinct, traceable cards. */
const vanilla = (index: number) =>
  card(`test:vanilla-${index}`, 'unit', { name: `Vanilla ${index}` });

export const TEST_CARDS = {
  legend: card('test:legend', 'legend', { tags: ['Tester'], name: 'Test Legend' }),
  champion: card('test:champion', 'unit', {
    supertypes: ['champion'],
    tags: ['Tester'],
    name: 'Test Champion',
  }),
  rune: card('test:rune-fury', 'rune', { name: 'Fury Rune' }),
  battlefields: [1, 2, 3].map((i) =>
    card(`test:battlefield-${i}`, 'battlefield', { name: `Battlefield ${i}` }),
  ),
  vanillas: Array.from({ length: 39 }, (_, i) => vanilla(i + 1)),
  gear: card('test:gear', 'gear'),
  spell: card('test:spell', 'spell'),
} as const;

/** Every test card, keyed by id. */
export const TEST_CARD_DEFINITIONS: Readonly<Record<CardId, CardDefinition>> = Object.fromEntries(
  [
    TEST_CARDS.legend,
    TEST_CARDS.champion,
    TEST_CARDS.rune,
    ...TEST_CARDS.battlefields,
    ...TEST_CARDS.vanillas,
    TEST_CARDS.gear,
    TEST_CARDS.spell,
  ].map((definition) => [definition.id, definition]),
);

/**
 * A legal 1v1 deck (103): the test legend, the test champion plus 39 vanilla units
 * (40 cards), 12 Fury runes and three battlefields.
 */
export function testDeck(overrides: Partial<DeckList> = {}): DeckList {
  return {
    legend: TEST_CARDS.legend.id,
    champion: TEST_CARDS.champion.id,
    mainDeck: [TEST_CARDS.champion.id, ...TEST_CARDS.vanillas.map((unit) => unit.id)],
    runeDeck: Array.from({ length: 12 }, () => TEST_CARDS.rune.id),
    battlefields: TEST_CARDS.battlefields.map((battlefield) => battlefield.id),
    ...overrides,
  };
}

/**
 * A copy of the test cards under other ids (`test:<variant>:…`), and the matching deck.
 * Gives each player cards of their own, so a test can tell whose card a view shows.
 */
export function testDeckVariant(variant: string): {
  deck: DeckList;
  cards: Readonly<Record<CardId, CardDefinition>>;
} {
  const rename = (id: CardId) => id.replace(/^test:/, `test:${variant}:`) as CardId;
  const cards = Object.fromEntries(
    Object.values(TEST_CARD_DEFINITIONS).map((definition) => {
      const id = rename(definition.id);
      return [id, { ...definition, id }];
    }),
  );
  const base = testDeck();
  return {
    deck: {
      legend: rename(base.legend),
      champion: rename(base.champion),
      mainDeck: base.mainDeck.map(rename),
      runeDeck: base.runeDeck.map(rename),
      battlefields: base.battlefields.map(rename),
    },
    cards,
  };
}

/**
 * A 1v1 Duel setup between players `A` and `B` (seating order A, B), both with `testDeck()`.
 * With `distinctDecks`, B plays `testDeckVariant('b')`: no card is shared between the players.
 */
export function testSetup(
  overrides: Partial<Omit<GameSetup, 'players'>> & {
    players?: readonly PlayerSetup[];
    distinctDecks?: boolean;
  } = {},
): GameSetup {
  const { distinctDecks = false, ...rest } = overrides;
  const b = distinctDecks ? testDeckVariant('b') : { deck: testDeck(), cards: {} };
  return {
    mode: '1v1-duel',
    rulesVersion: 'CR-2026-10-09',
    players: [
      { id: 'A' as PlayerId, deck: testDeck() },
      { id: 'B' as PlayerId, deck: b.deck },
    ],
    cards: { ...TEST_CARD_DEFINITIONS, ...b.cards },
    ...rest,
  };
}
