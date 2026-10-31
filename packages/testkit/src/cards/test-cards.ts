// Test cards: fictional cards to test a rule without depending on a real card
// (docs/06-testing.md). Ids start with `test:` and never collide with a riftbound_id.

import type {
  Ability,
  CardCategory,
  CardDefinition,
  CardId,
  Cost,
  DeckList,
  Domain,
  GameSetup,
  Instruction,
  Keyword,
  PlayerId,
  PlayerSetup,
  Supertype,
  TargetSpec,
} from '@foilengine/types';

const card = (
  id: string,
  category: CardCategory,
  options: {
    supertypes?: Supertype[];
    tags?: string[];
    domains?: Domain[];
    name?: string;
    cost?: Cost;
    might?: number;
    keywords?: Keyword[];
    targets?: TargetSpec[];
    instructions?: Instruction[];
    abilities?: Ability[];
    text?: string;
  } = {},
): CardDefinition => ({
  id: id as CardId,
  name: options.name ?? id,
  category,
  supertypes: options.supertypes ?? [],
  tags: options.tags ?? [],
  domains: options.domains ?? ['fury'],
  ...(options.cost === undefined ? {} : { cost: options.cost }),
  ...(options.might === undefined ? {} : { might: options.might }),
  ...(options.keywords === undefined ? {} : { keywords: options.keywords }),
  ...(options.targets === undefined ? {} : { targets: options.targets }),
  ...(options.instructions === undefined ? {} : { instructions: options.instructions }),
  ...(options.abilities === undefined ? {} : { abilities: options.abilities }),
  text: options.text ?? '',
});

/**
 * A vanilla unit per index, so that a 40-card deck has distinct, traceable cards.
 * Energy cost 1 to 4 in turn; every fifth one also costs one Fury Power. Might 1 to 5 in turn.
 */
const vanilla = (index: number) =>
  card(`test:vanilla-${index}`, 'unit', {
    name: `Vanilla ${index}`,
    cost: { energy: 1 + ((index - 1) % 4), power: index % 5 === 0 ? ['fury'] : [] },
    might: 1 + ((index - 1) % 5),
  });

export const TEST_CARDS = {
  legend: card('test:legend', 'legend', { tags: ['Tester'], name: 'Test Legend' }),
  champion: card('test:champion', 'unit', {
    supertypes: ['champion'],
    tags: ['Tester'],
    name: 'Test Champion',
    cost: { energy: 3, power: ['fury'] },
    might: 4,
  }),
  rune: card('test:rune-fury', 'rune', { name: 'Fury Rune' }),
  calmRune: card('test:rune-calm', 'rune', { name: 'Calm Rune', domains: ['calm'] }),
  /** No domain: recycling it adds [A], Power of any domain (164.2.b, 135.2.e.6.b). Not a Basic Rune. */
  domainlessRune: card('test:rune-domainless', 'rune', { name: 'Domainless Rune', domains: [] }),
  /** Costs one Calm Power: needs a Calm rune. */
  calmUnit: card('test:calm-unit', 'unit', {
    name: 'Calm Unit',
    domains: ['calm'],
    cost: { energy: 1, power: ['calm'] },
    might: 2,
  }),
  /** Costs [A], one Power of any domain (135.2.e.5.a). */
  anyUnit: card('test:any-unit', 'unit', {
    name: 'Any Unit',
    domains: [],
    cost: { energy: 0, power: ['any'] },
    might: 1,
  }),
  battlefields: [1, 2, 3].map((i) =>
    card(`test:battlefield-${i}`, 'battlefield', { name: `Battlefield ${i}` }),
  ),
  vanillas: Array.from({ length: 39 }, (_, i) => vanilla(i + 1)),
  gear: card('test:gear', 'gear', { cost: { energy: 1, power: [] } }),
  spell: card('test:spell', 'spell', { cost: { energy: 1, power: [] } }),
  /** No keyword: on its controller's turn, in a Neutral Open State only (155). */
  insight: card('test:insight', 'spell', {
    name: 'Insight',
    cost: { energy: 1, power: [] },
    instructions: [{ kind: 'draw', amount: 1 }],
    text: 'Draw 1.',
  }),
  /** Action (806): also in Showdowns. */
  bolt: card('test:bolt', 'spell', {
    name: 'Bolt',
    cost: { energy: 1, power: [] },
    keywords: ['action'],
    targets: [{ kind: 'unit' }],
    instructions: [{ kind: 'deal', amount: 2, target: 0 }],
    text: '[Action] Deal 2 to a unit.',
  }),
  /** Reaction (813): also on a Chain, on any player's turn. */
  snap: card('test:snap', 'spell', {
    name: 'Snap',
    cost: { energy: 1, power: [] },
    keywords: ['reaction'],
    targets: [{ kind: 'unit' }],
    instructions: [{ kind: 'deal', amount: 1, target: 0 }],
    text: '[Reaction] Deal 1 to a unit.',
  }),
  /** Targeting restrictions (355.9.b). */
  smite: card('test:smite', 'spell', {
    name: 'Smite',
    cost: { energy: 2, power: [] },
    targets: [{ kind: 'unit', at: 'battlefield', controller: 'enemy' }],
    instructions: [
      { kind: 'deal', amount: 3, target: 0 },
      { kind: 'draw', amount: 1 },
    ],
    text: 'Deal 3 to an enemy unit at a battlefield. Draw 1.',
  }),
  /** A Play Effect (383.4.a). */
  scout: card('test:scout', 'unit', {
    name: 'Scout',
    cost: { energy: 2, power: [] },
    might: 2,
    abilities: [
      {
        kind: 'triggered',
        trigger: { kind: 'played' },
        instructions: [{ kind: 'draw', amount: 1 }],
      },
    ],
    text: 'When you play me, draw 1.',
  }),
  /** A Conquer ability (383.4.c). */
  raider: card('test:raider', 'unit', {
    name: 'Raider',
    cost: { energy: 2, power: [] },
    might: 2,
    abilities: [
      {
        kind: 'triggered',
        trigger: { kind: 'conquer' },
        instructions: [{ kind: 'draw', amount: 1 }],
      },
    ],
    text: 'When I conquer, draw 1.',
  }),
  /** A Hold ability (383.4.d). */
  keeper: card('test:keeper', 'unit', {
    name: 'Keeper',
    cost: { energy: 2, power: [] },
    might: 3,
    abilities: [
      { kind: 'triggered', trigger: { kind: 'hold' }, instructions: [{ kind: 'draw', amount: 1 }] },
    ],
    text: 'When I hold, draw 1.',
  }),
  /** An activated ability with [E] in its cost (377.1). */
  slinger: card('test:slinger', 'unit', {
    name: 'Slinger',
    cost: { energy: 2, power: [] },
    might: 1,
    abilities: [
      {
        kind: 'activated',
        cost: { exhaustSelf: true },
        targets: [{ kind: 'unit' }],
        instructions: [{ kind: 'deal', amount: 1, target: 0 }],
      },
    ],
    text: '[E]: Deal 1 to a unit.',
  }),
  /** An activated ability with Reaction (813.1.c.2). */
  sage: card('test:sage', 'unit', {
    name: 'Sage',
    cost: { energy: 2, power: [] },
    might: 1,
    abilities: [
      {
        kind: 'activated',
        cost: { energy: 1 },
        keywords: ['reaction'],
        instructions: [{ kind: 'draw', amount: 1 }],
      },
    ],
    text: '[Reaction][>] [1]: Draw 1.',
  }),
  /** A Play Effect with a target, chosen as it is finalized (355.5). */
  sniper: card('test:sniper', 'unit', {
    name: 'Sniper',
    cost: { energy: 2, power: [] },
    might: 1,
    abilities: [
      {
        kind: 'triggered',
        trigger: { kind: 'played' },
        targets: [{ kind: 'unit', controller: 'enemy' }],
        instructions: [{ kind: 'deal', amount: 1, target: 0 }],
      },
    ],
    text: 'When you play me, deal 1 to an enemy unit.',
  }),
  /** A Play Effect that says "you may" first (383.3.a). */
  scholar: card('test:scholar', 'unit', {
    name: 'Scholar',
    cost: { energy: 2, power: [] },
    might: 1,
    abilities: [
      {
        kind: 'triggered',
        trigger: { kind: 'played' },
        optional: true,
        instructions: [{ kind: 'draw', amount: 1 }],
      },
    ],
    text: 'When you play me, you may draw 1.',
  }),
  /** An Attack trigger (383.4.e). */
  charger: card('test:charger', 'unit', {
    name: 'Charger',
    cost: { energy: 2, power: [] },
    might: 3,
    abilities: [
      {
        kind: 'triggered',
        trigger: { kind: 'attack' },
        instructions: [{ kind: 'draw', amount: 1 }],
      },
    ],
    text: 'When I attack, draw 1.',
  }),
  /** A Defend trigger (383.4.f). */
  guard: card('test:guard', 'unit', {
    name: 'Guard',
    cost: { energy: 2, power: [] },
    might: 3,
    abilities: [
      {
        kind: 'triggered',
        trigger: { kind: 'defend' },
        instructions: [{ kind: 'draw', amount: 1 }],
      },
    ],
    text: 'When I defend, draw 1.',
  }),
} as const;

/** The test units with abilities, for decks that exercise them. */
export const TEST_ABILITY_UNITS = [
  TEST_CARDS.scout,
  TEST_CARDS.raider,
  TEST_CARDS.keeper,
  TEST_CARDS.slinger,
  TEST_CARDS.sage,
  TEST_CARDS.sniper,
  TEST_CARDS.scholar,
  TEST_CARDS.charger,
  TEST_CARDS.guard,
];

/** The test spells, for decks that exercise the Chain. */
export const TEST_SPELLS = [TEST_CARDS.insight, TEST_CARDS.bolt, TEST_CARDS.snap, TEST_CARDS.smite];

/** Every test card, keyed by id. */
export const TEST_CARD_DEFINITIONS: Readonly<Record<CardId, CardDefinition>> = Object.fromEntries(
  [
    TEST_CARDS.legend,
    TEST_CARDS.champion,
    TEST_CARDS.rune,
    TEST_CARDS.calmRune,
    TEST_CARDS.domainlessRune,
    TEST_CARDS.calmUnit,
    TEST_CARDS.anyUnit,
    ...TEST_CARDS.battlefields,
    ...TEST_CARDS.vanillas,
    TEST_CARDS.gear,
    TEST_CARDS.spell,
    ...TEST_SPELLS,
    ...TEST_ABILITY_UNITS,
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
 * A legal 1v1 deck with spells: the test champion, Vanilla 1 to 31, and two of each test spell
 * (40 cards). For scenarios and fuzzing that need the Chain.
 */
export function testDeckWithSpells(): DeckList {
  return testDeck({
    mainDeck: [
      TEST_CARDS.champion.id,
      ...TEST_CARDS.vanillas.slice(0, 31).map((unit) => unit.id),
      ...TEST_SPELLS.flatMap((spell) => [spell.id, spell.id]),
    ],
  });
}

/**
 * A legal 1v1 deck with spells and units with abilities: the test champion, Vanilla 1 to 13, and
 * two of each test spell and each test unit with abilities (40 cards).
 */
export function testDeckWithAbilities(): DeckList {
  return testDeck({
    mainDeck: [
      TEST_CARDS.champion.id,
      ...TEST_CARDS.vanillas.slice(0, 13).map((unit) => unit.id),
      ...[...TEST_SPELLS, ...TEST_ABILITY_UNITS].flatMap((c) => [c.id, c.id]),
    ],
  });
}

/**
 * A copy of the test cards under other ids (`test:<variant>:…`), and the matching deck.
 * Gives each player cards of their own, so a test can tell whose card a view shows.
 */
export function testDeckVariant(
  variant: string,
  base: DeckList = testDeck(),
): {
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
 * A 1v1 Duel setup between players `A` and `B` (seating order A, B), both with `testDeck()`,
 * or `testDeckWithSpells()` with `withSpells`. With `distinctDecks`, B plays a variant of the
 * same deck (`testDeckVariant('b')`): no card is shared between the players.
 */
export function testSetup(
  overrides: Partial<Omit<GameSetup, 'players'>> & {
    players?: readonly PlayerSetup[];
    distinctDecks?: boolean;
    withSpells?: boolean;
    withAbilities?: boolean;
  } = {},
): GameSetup {
  const { distinctDecks = false, withSpells = false, withAbilities = false, ...rest } = overrides;
  const deck = withAbilities
    ? testDeckWithAbilities()
    : withSpells
      ? testDeckWithSpells()
      : testDeck();
  const b = distinctDecks ? testDeckVariant('b', deck) : { deck, cards: {} };
  return {
    mode: '1v1-duel',
    rulesVersion: 'CR-2026-10-09',
    players: [
      { id: 'A' as PlayerId, deck },
      { id: 'B' as PlayerId, deck: b.deck },
    ],
    cards: { ...TEST_CARD_DEFINITIONS, ...b.cards },
    ...rest,
  };
}
