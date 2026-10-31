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
  ValuedKeyword,
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
    keywords?: (Keyword | ValuedKeyword)[];
    targets?: TargetSpec[];
    instructions?: Instruction[];
    abilities?: Ability[];
    effectText?: CardDefinition['effectText'];
    mightBonus?: number;
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
  ...(options.effectText === undefined ? {} : { effectText: options.effectText }),
  ...(options.mightBonus === undefined ? {} : { mightBonus: options.mightBonus }),
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
  /** Deathknell (808): "When I die, draw 1." */
  martyr: card('test:martyr', 'unit', {
    name: 'Martyr',
    cost: { energy: 1, power: [] },
    might: 1,
    keywords: ['deathknell'],
    abilities: [
      { kind: 'triggered', trigger: { kind: 'dies' }, instructions: [{ kind: 'draw', amount: 1 }] },
    ],
    text: '[Deathknell][>] Draw 1.',
  }),
  /** An optional cost within a triggered ability (383.3.a, 383.3.b). */
  bounty: card('test:bounty', 'unit', {
    name: 'Bounty',
    cost: { energy: 2, power: [] },
    might: 2,
    abilities: [
      {
        kind: 'triggered',
        trigger: { kind: 'conquer' },
        optional: true,
        cost: { energy: 1 },
        instructions: [{ kind: 'draw', amount: 1 }],
      },
    ],
    text: 'When I conquer, you may pay [1] to draw 1.',
  }),
  /** A mandatory cost within a triggered ability (383.3.b, 383.3.b.1). */
  toll: card('test:toll', 'unit', {
    name: 'Toll',
    cost: { energy: 1, power: [] },
    might: 1,
    abilities: [
      {
        kind: 'triggered',
        trigger: { kind: 'played' },
        cost: { energy: 1 },
        instructions: [{ kind: 'draw', amount: 1 }],
      },
    ],
    text: 'When you play me, pay [1] to draw 1.',
  }),
  /** Accelerate (805): a Fury unit; pay [1][C] more to have it enter ready. */
  sprinter: card('test:sprinter', 'unit', {
    name: 'Sprinter',
    cost: { energy: 1, power: [] },
    might: 2,
    keywords: ['accelerate'],
    text: '[Accelerate]',
  }),
  /** Temporary (816): killed at the start of its controller's Beginning Phase, before scoring. */
  sprite: card('test:sprite', 'unit', {
    name: 'Sprite',
    cost: { energy: 1, power: [] },
    might: 3,
    keywords: ['temporary'],
    abilities: [
      {
        kind: 'triggered',
        trigger: { kind: 'beginning' },
        instructions: [{ kind: 'kill', target: 'self' }],
      },
    ],
    text: '[Temporary]',
  }),
  /** A token (187.1): a domainless 1 [M] unit token with the Recruit tag. Never in a deck. */
  recruit: {
    ...card('test:recruit', 'unit', { name: 'Recruit', tags: ['Recruit'], domains: [], might: 1 }),
    token: true,
  },
  /** Plays a token from a spell, then affects it with a linked instruction (359.3.e.14). */
  muster: card('test:muster', 'spell', {
    name: 'Muster',
    cost: { energy: 2, power: [] },
    instructions: [
      { kind: 'play-token', token: 'test:recruit' as CardId },
      { kind: 'buff', target: 'token' },
    ],
    text: 'Play a 1 [M] Recruit unit token into your base, then buff it.',
  }),
  /** Plays a token from a Play Effect (383.4.a). */
  summoner: card('test:summoner', 'unit', {
    name: 'Summoner',
    cost: { energy: 2, power: [] },
    might: 1,
    abilities: [
      {
        kind: 'triggered',
        trigger: { kind: 'played' },
        instructions: [{ kind: 'play-token', token: 'test:recruit' as CardId }],
      },
    ],
    text: 'When you play me, play a 1 [M] Recruit unit token into your base.',
  }),
  /** Ganking (810): may move from a battlefield to another battlefield. */
  ganker: card('test:ganker', 'unit', {
    name: 'Ganker',
    cost: { energy: 1, power: [] },
    might: 2,
    keywords: ['ganking'],
    text: '[Ganking]',
  }),
  /** Ambush (822): may be played, with Reaction, to a battlefield where you control units. */
  ambusher: card('test:ambusher', 'unit', {
    name: 'Ambusher',
    cost: { energy: 1, power: [] },
    might: 2,
    keywords: ['ambush'],
    text: '[Ambush]',
  }),
  /** Deflect 1 (809): opponents' spells and abilities that target it cost [A] more. */
  warder: card('test:warder', 'unit', {
    name: 'Warder',
    cost: { energy: 1, power: [] },
    might: 2,
    keywords: [{ keyword: 'deflect', value: 1 }],
    text: '[Deflect]',
  }),
  /** Vision (817): "When this is played, Predict." */
  seer: card('test:seer', 'unit', {
    name: 'Seer',
    cost: { energy: 1, power: [] },
    might: 1,
    keywords: ['vision'],
    abilities: [
      {
        kind: 'triggered',
        trigger: { kind: 'played' },
        instructions: [{ kind: 'predict', amount: 1 }],
      },
    ],
    text: '[Vision]',
  }),
  /** A choice in the middle of a resolution (ADR 0020), then an instruction after it. */
  glimpse: card('test:glimpse', 'spell', {
    name: 'Glimpse',
    cost: { energy: 1, power: [] },
    instructions: [
      { kind: 'predict', amount: 2 },
      { kind: 'draw', amount: 1 },
    ],
    text: 'Predict 2, then draw 1.',
  }),
  /** Hunt 1 (823): "When I conquer or hold, my controller gains 1 XP." */
  tracker: card('test:tracker', 'unit', {
    name: 'Tracker',
    cost: { energy: 1, power: [] },
    might: 2,
    keywords: [{ keyword: 'hunt', value: 1 }],
    abilities: [
      {
        kind: 'triggered',
        trigger: { kind: 'conquer' },
        instructions: [{ kind: 'gain-xp', amount: 1 }],
      },
      {
        kind: 'triggered',
        trigger: { kind: 'hold' },
        instructions: [{ kind: 'gain-xp', amount: 1 }],
      },
    ],
    text: '[Hunt]',
  }),
  /** Level (824), a passive Dependent Ability: "[Level 1][>] I have +2 [M]." */
  veteran: card('test:veteran', 'unit', {
    name: 'Veteran',
    cost: { energy: 1, power: [] },
    might: 1,
    keywords: ['level'],
    abilities: [
      { kind: 'passive', affects: 'self', might: 2, requires: [{ kind: 'level', xp: 1 }] },
    ],
    text: '[Level 1][>] I have +2 [M].',
  }),
  /**
   * Level (824), a triggered and an activated Dependent Ability: "[Level 1][>] When you play me,
   * draw 1." and "[Level 1][>] [1], [E]: Draw 1."
   */
  mentor: card('test:mentor', 'unit', {
    name: 'Mentor',
    cost: { energy: 1, power: [] },
    might: 1,
    keywords: ['level'],
    abilities: [
      {
        kind: 'triggered',
        requires: [{ kind: 'level', xp: 1 }],
        trigger: { kind: 'played' },
        instructions: [{ kind: 'draw', amount: 1 }],
      },
      {
        kind: 'activated',
        requires: [{ kind: 'level', xp: 1 }],
        cost: { energy: 1, exhaustSelf: true },
        instructions: [{ kind: 'draw', amount: 1 }],
      },
    ],
    text: '[Level 1][>] When you play me, draw 1. [Level 1][>] [1], [E]: Draw 1.',
  }),
  /** A gear with an activated ability (151): "[1], [E]: Draw 1." It must enter ready (149.1). */
  lantern: card('test:lantern', 'gear', {
    name: 'Lantern',
    cost: { energy: 1, power: [] },
    abilities: [
      {
        kind: 'activated',
        cost: { energy: 1, exhaustSelf: true },
        instructions: [{ kind: 'draw', amount: 1 }],
      },
    ],
    text: '[1], [E]: Draw 1.',
  }),
  /** Equipment (150) with Equip [1] (818), a Might Bonus of +1 (137) and [Assault 2] as Effect Text (136). */
  blade: card('test:blade', 'gear', {
    name: 'Blade',
    tags: ['Equipment'],
    cost: { energy: 1, power: [] },
    keywords: ['equip'],
    abilities: [
      {
        kind: 'activated',
        cost: { energy: 1 },
        targets: [{ kind: 'unit', controller: 'friendly' }],
        instructions: [{ kind: 'attach', target: 0 }],
      },
    ],
    effectText: { keywords: [{ keyword: 'assault', value: 2 }] },
    mightBonus: 1,
    text: 'Equip [1]',
  }),
  /** Assault 2 (807): +2 [M] while it is an attacker. */
  bruiser: card('test:bruiser', 'unit', {
    name: 'Bruiser',
    cost: { energy: 1, power: [] },
    might: 2,
    keywords: [{ keyword: 'assault', value: 2 }],
    text: '[Assault 2]',
  }),
  /** Shield 2 (814): +2 [M] while it is a defender. */
  wall: card('test:wall', 'unit', {
    name: 'Wall',
    cost: { energy: 1, power: [] },
    might: 2,
    keywords: [{ keyword: 'shield', value: 2 }],
    text: '[Shield 2]',
  }),
  /** Tank (815). */
  guardian: card('test:guardian', 'unit', {
    name: 'Guardian',
    cost: { energy: 1, power: [] },
    might: 2,
    keywords: ['tank'],
    text: '[Tank]',
  }),
  /** Backline (826). */
  archer: card('test:archer', 'unit', {
    name: 'Archer',
    cost: { energy: 1, power: [] },
    might: 2,
    keywords: ['backline'],
    text: '[Backline]',
  }),
  /** Tank and Backline: its controller's opponent chooses which applies (467.2.c.8). */
  fickle: card('test:fickle', 'unit', {
    name: 'Fickle',
    cost: { energy: 1, power: [] },
    might: 2,
    keywords: ['tank', 'backline'],
    text: '[Tank] [Backline]',
  }),
  /** A Passive Ability of a permanent (363–365): "Other friendly units have +1 [M]." */
  banner: card('test:banner', 'unit', {
    name: 'Banner',
    cost: { energy: 2, power: [] },
    might: 1,
    abilities: [{ kind: 'passive', affects: 'other-friendly-units', might: 1 }],
    text: 'Other friendly units have +1 [M].',
  }),
  /** An Arithmetic effect for this turn (479.4). */
  rally: card('test:rally', 'spell', {
    name: 'Rally',
    cost: { energy: 1, power: [] },
    keywords: ['action'],
    targets: [{ kind: 'unit' }],
    instructions: [{ kind: 'give-might', amount: 2, target: 0 }],
    text: '[Action] Give a unit +2 [M] this turn.',
  }),
  /** A decrease, for this turn (479.4). */
  wither: card('test:wither', 'spell', {
    name: 'Wither',
    cost: { energy: 1, power: [] },
    targets: [{ kind: 'unit' }],
    instructions: [{ kind: 'give-might', amount: -2, target: 0 }],
    text: 'Give a unit -2 [M] this turn.',
  }),
  /** A buff (702.2.a). */
  bless: card('test:bless', 'spell', {
    name: 'Bless',
    cost: { energy: 1, power: [] },
    targets: [{ kind: 'unit', controller: 'friendly' }],
    instructions: [{ kind: 'buff', target: 0 }],
    text: 'Buff a friendly unit.',
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
  TEST_CARDS.martyr,
  TEST_CARDS.bounty,
  TEST_CARDS.toll,
  TEST_CARDS.banner,
  TEST_CARDS.bruiser,
  TEST_CARDS.wall,
  TEST_CARDS.guardian,
  TEST_CARDS.archer,
  TEST_CARDS.fickle,
  TEST_CARDS.sprinter,
  TEST_CARDS.sprite,
  TEST_CARDS.summoner,
  TEST_CARDS.ganker,
  TEST_CARDS.ambusher,
  TEST_CARDS.warder,
  TEST_CARDS.seer,
  TEST_CARDS.tracker,
  TEST_CARDS.veteran,
  TEST_CARDS.mentor,
];

/** The test gear, for decks that exercise them. */
export const TEST_GEAR = [TEST_CARDS.lantern, TEST_CARDS.blade];

/** The test spells, for decks that exercise the Chain. */
export const TEST_SPELLS = [
  TEST_CARDS.insight,
  TEST_CARDS.bolt,
  TEST_CARDS.snap,
  TEST_CARDS.smite,
  TEST_CARDS.rally,
  TEST_CARDS.wither,
  TEST_CARDS.bless,
  TEST_CARDS.muster,
  TEST_CARDS.glimpse,
];

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
    ...TEST_GEAR,
    TEST_CARDS.recruit,
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
 * A legal 1v1 deck with spells: the test champion, Vanilla 1 to 31, and two of each test spell.
 * For scenarios and fuzzing that need the Chain.
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
 * A legal 1v1 deck with spells and units with abilities: the test champion, Vanilla 1 to 11, one
 * of each test spell, two of each test unit with abilities and two of each test gear.
 */
export function testDeckWithAbilities(): DeckList {
  return testDeck({
    mainDeck: [
      TEST_CARDS.champion.id,
      ...TEST_CARDS.vanillas.slice(0, 11).map((unit) => unit.id),
      ...TEST_SPELLS.map((spell) => spell.id),
      ...TEST_ABILITY_UNITS.flatMap((c) => [c.id, c.id]),
      ...TEST_GEAR.flatMap((c) => [c.id, c.id]),
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
