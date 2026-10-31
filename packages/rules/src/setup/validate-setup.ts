// Structural checks of a game setup before it is created.
// Deckbuilding rules (Domain Identity, copies, Signature cards, format) belong to
// `codex` (docs/02-game-model.md, Setup); here we check what setup needs to run.

import type { CardCategory, CardId, GameSetup, PlayerSetup, SetupProblem } from '@foilengine/types';
import { DUEL_BATTLEFIELDS_PER_DECK, DUEL_PLAYERS } from '../modes/duel.ts';
import { RULES_VERSION } from '../version.ts';

/** The modes M1 can set up. */
export const SUPPORTED_MODES = ['1v1-duel'] as const;

/** 103.3: a Main Deck of at least 40 cards. */
const MAIN_DECK_MIN = 40;
/** 103.4.a: 12 runes. */
const RUNE_DECK_SIZE = 12;
/** 133.4: Main Deck cards are permanents (units, gear) and spells. */
const MAIN_DECK_CATEGORIES: readonly CardCategory[] = ['unit', 'gear', 'spell'];

export function validateSetup(setup: GameSetup): SetupProblem[] {
  const problems: SetupProblem[] = [];

  if (setup.rulesVersion !== RULES_VERSION) {
    problems.push({
      code: 'rules-version-mismatch',
      player: null,
      message: `The engine implements ${RULES_VERSION}, the setup asks for ${setup.rulesVersion}`,
      rule: null,
    });
  }
  if (!(SUPPORTED_MODES as readonly string[]).includes(setup.mode)) {
    problems.push({
      code: 'unsupported-mode',
      player: null,
      message: `Mode ${setup.mode} is not implemented yet (supported: ${SUPPORTED_MODES.join(', ')})`,
      rule: '483',
    });
    return problems;
  }
  if (setup.players.length !== DUEL_PLAYERS) {
    problems.push({
      code: 'wrong-player-count',
      player: null,
      message: `1v1 needs ${DUEL_PLAYERS} players, got ${setup.players.length}`,
      rule: '487.1',
    });
  }
  const ids = setup.players.map((player) => player.id);
  if (new Set(ids).size !== ids.length) {
    problems.push({
      code: 'duplicate-player',
      player: null,
      message: 'Two players have the same id',
      rule: null,
    });
  }

  const missing = missingTokens(setup);
  if (missing.length > 0) {
    problems.push({
      code: 'invalid-token',
      player: null,
      message: `Effects play tokens with no token definition: ${missing.join(', ')}`,
      rule: '185.1',
    });
  }
  for (const player of setup.players) {
    problems.push(...validateDeck(setup, player));
  }
  return problems;
}

/** The tokens an effect plays (`play-token`) that have no token definition in the setup. */
function missingTokens(setup: GameSetup): CardId[] {
  const missing = new Set<CardId>();
  for (const definition of Object.values(setup.cards)) {
    const lists = [
      definition.instructions ?? [],
      ...(definition.abilities ?? []).map((a) => (a.kind === 'passive' ? [] : a.instructions)),
    ];
    for (const instruction of lists.flat()) {
      if (instruction.kind === 'play-token' && setup.cards[instruction.token]?.token !== true) {
        missing.add(instruction.token);
      }
    }
  }
  return [...missing];
}

function validateDeck(setup: GameSetup, { id, deck }: PlayerSetup): SetupProblem[] {
  const problems: SetupProblem[] = [];
  const problem = (code: SetupProblem['code'], message: string, rule: SetupProblem['rule']) =>
    problems.push({ code, player: id, message, rule });

  const all = [deck.legend, ...deck.mainDeck, ...deck.runeDeck, ...deck.battlefields];
  const unknown = [...new Set(all.filter((card) => setup.cards[card] === undefined))];
  if (unknown.length > 0) {
    problem('unknown-card', `Unknown cards: ${unknown.join(', ')}`, null);
    return problems;
  }

  // 185: tokens are not cards; they are never in a deck.
  const tokens = [...new Set(all.filter((card) => setup.cards[card]?.token === true))];
  if (tokens.length > 0) {
    problem('invalid-token', `A deck cannot contain tokens: ${tokens.join(', ')}`, '185');
    return problems;
  }

  const categoryOf = (card: CardId) => setup.cards[card]?.category;
  const expectCategory = (
    cards: readonly CardId[],
    allowed: readonly CardCategory[],
    what: string,
    rule: SetupProblem['rule'],
  ) => {
    const wrong = cards.filter((card) => !allowed.includes(categoryOf(card) as CardCategory));
    if (wrong.length > 0) {
      problem('wrong-category', `${what} cannot contain ${[...new Set(wrong)].join(', ')}`, rule);
    }
  };

  expectCategory([deck.legend], ['legend'], 'The Champion Legend', '103.2');
  expectCategory(deck.mainDeck, MAIN_DECK_CATEGORIES, 'The Main Deck', '133.4');
  expectCategory(deck.runeDeck, ['rune'], 'The Rune Deck', '133.5');
  expectCategory(deck.battlefields, ['battlefield'], 'The battlefields', '133.6');

  // What the engine needs to play the cards: a cost for Main Deck cards (131.1), a might for
  // units (143), a single domain for runes (164.2.b.1).
  const incomplete = [...new Set([...deck.mainDeck, ...deck.runeDeck])].filter((card) => {
    const definition = setup.cards[card];
    if (definition === undefined) return false;
    if (definition.category === 'rune') return definition.domains.length > 1;
    return (
      definition.cost === undefined ||
      (definition.category === 'unit' && definition.might === undefined)
    );
  });
  if (incomplete.length > 0) {
    problem('incomplete-card', `Missing cost, might or domain: ${incomplete.join(', ')}`, '131.1');
  }

  const champion = setup.cards[deck.champion];
  if (
    champion === undefined ||
    champion.category !== 'unit' ||
    !champion.supertypes.includes('champion')
  ) {
    problem('not-a-champion', `${deck.champion} is not a champion unit`, '103.3.a.2');
  }
  if (!deck.mainDeck.includes(deck.champion)) {
    problem(
      'champion-not-in-main-deck',
      `The Chosen Champion ${deck.champion} must be in the Main Deck`,
      '103.3',
    );
  }
  if (deck.mainDeck.length < MAIN_DECK_MIN) {
    problem(
      'main-deck-too-small',
      `The Main Deck has ${deck.mainDeck.length} cards, at least ${MAIN_DECK_MIN} are required`,
      '103.3',
    );
  }
  if (deck.runeDeck.length !== RUNE_DECK_SIZE) {
    problem(
      'wrong-rune-count',
      `The Rune Deck has ${deck.runeDeck.length} runes, ${RUNE_DECK_SIZE} are required`,
      '103.4.a',
    );
  }
  if (deck.battlefields.length !== DUEL_BATTLEFIELDS_PER_DECK) {
    problem(
      'wrong-battlefield-count',
      `1v1 needs ${DUEL_BATTLEFIELDS_PER_DECK} battlefields, got ${deck.battlefields.length}`,
      '487.4.a',
    );
  }
  return problems;
}
