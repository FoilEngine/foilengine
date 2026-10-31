// Setup Process (110–118) for the 1v1 Duel mode (487).
// Rules quoted in each step; the event of each step carries its rule number.

import {
  type CardId,
  type GameEvent,
  type GameSetup,
  type GameState,
  type ObjectId,
  type PlayerId,
  type Seed,
  type SetupProblem,
  STATE_VERSION,
} from '@foilengine/types';
import { drawCards } from '../actions/draw.ts';
import { createObject, type Draft, emit, emptyZones, playerOf, stateOf } from '../draft.ts';
import { emptyPool } from '../resources/rune-pool.ts';
import { createRng, nextInt, shuffle } from '../rng/xoshiro128.ts';
import { validateSetup } from './validate-setup.ts';

/** 116: players each draw 4. */
export const OPENING_HAND_SIZE = 4;

export type CreateGameResult =
  | { readonly ok: true; readonly state: GameState; readonly events: GameEvent[] }
  | { readonly ok: false; readonly problems: readonly SetupProblem[] };

/**
 * Creates a game: validates the setup, then runs the Setup Process up to the mulligans.
 * The game then waits for the first Mulligan decision (117). Same setup and seed, same game.
 */
export function createGame(setup: GameSetup, seed: Seed): CreateGameResult {
  const problems = validateSetup(setup);
  if (problems.length > 0) return { ok: false, problems };

  const draft: Draft = {
    cards: setup.cards,
    rng: createRng(seed),
    nextObjectId: 1,
    eventSeq: 0,
    baseObjects: {},
    changedObjects: new Map(),
    players: setup.players.map((player) => ({
      id: player.id,
      points: 0,
      turnsTaken: 0,
      runePool: emptyPool(),
      scoredThisTurn: [],
      zones: emptyZones(),
    })),
    battlefields: [],
    showdown: null,
    combat: null,
    chain: null,
    turnOrder: [],
    stage: { kind: 'mulligan', pending: [] },
    winner: null,
    events: [],
  };

  // 110: Setup Process.
  emit(draft, {
    type: 'GameCreated',
    rule: '110',
    visibility: { kind: 'public' },
    mode: setup.mode,
    rulesVersion: setup.rulesVersion,
    players: setup.players.map((player) => player.id),
  });

  for (const { id, deck } of setup.players) {
    const zones = playerOf(draft, id).zones;

    // 111: the Champion Legend goes to the Legend Zone.
    const legend = createObject(draft, deck.legend, id, null);
    zones.legendZone.push(legend.id);
    emit(draft, placed(id, legend.id, deck.legend, 'legendZone', '111'));

    // 112: the Chosen Champion goes to the Champion Zone (it is one of the Main Deck cards, 103.3).
    const champion = createObject(draft, deck.champion, id, null);
    zones.championZone.push(champion.id);
    emit(draft, placed(id, champion.id, deck.champion, 'championZone', '112'));
  }

  // 113, 487.4.a, 487.5: each player randomly selects one of their three battlefields;
  // the other two are not used in this game.
  for (const { id, deck } of setup.players) {
    const pick = nextInt(draft.rng, deck.battlefields.length);
    draft.rng = pick.rng;
    const card = deck.battlefields[pick.value] as CardId;
    const battlefield = createObject(draft, card, id, null);
    draft.battlefields.push({
      object: battlefield.id,
      controller: null,
      contestedBy: null,
      showdownStaged: false,
      combatStaged: false,
      units: [],
    });
    emit(draft, {
      type: 'BattlefieldSelected',
      rule: '487.5',
      visibility: { kind: 'public' },
      player: id,
      object: battlefield.id,
      card,
    });
  }

  // 114: each player shuffles their Main and Rune Decks separately, then places them in their zones.
  for (const { id, deck } of setup.players) {
    const zones = playerOf(draft, id).zones;
    const mainDeck = withoutOne(deck.mainDeck, deck.champion);
    for (const [zone, cards] of [
      ['mainDeck', mainDeck],
      ['runeDeck', deck.runeDeck],
    ] as const) {
      // Shuffle the cards first, then create the objects in deck order: ids reveal nothing.
      const shuffled = shuffle(draft.rng, cards);
      draft.rng = shuffled.rng;
      for (const card of shuffled.value) {
        zones[zone].push(createObject(draft, card, id, null).id);
      }
      emit(draft, {
        type: 'DeckShuffled',
        rule: '114',
        visibility: { kind: 'public' },
        player: id,
        zone,
        size: cards.length,
      });
    }
  }

  // 115: Turn Order by a fair random method. 487 does not say how to pick the First Player
  // (115.1.a), so it is drawn with the game's RNG; then seating order from the First Player (115.1.b).
  const first = nextInt(draft.rng, setup.players.length);
  draft.rng = first.rng;
  const seating = setup.players.map((player) => player.id);
  const turnOrder = [...seating.slice(first.value), ...seating.slice(0, first.value)];
  emit(draft, {
    type: 'TurnOrderDetermined',
    rule: '115',
    visibility: { kind: 'public' },
    order: turnOrder,
  });

  // 116: players each draw 4, in turn order.
  for (const id of turnOrder) {
    drawCards(draft, id, OPENING_HAND_SIZE, '116');
  }

  // 117: then players perform their Mulligan in turn order; the game waits for the first decision.
  draft.turnOrder = turnOrder;
  draft.stage = { kind: 'mulligan', pending: turnOrder };
  const base: GameState = {
    version: STATE_VERSION,
    rulesVersion: setup.rulesVersion,
    mode: setup.mode,
    rng: draft.rng,
    nextObjectId: draft.nextObjectId,
    eventSeq: draft.eventSeq,
    cards: setup.cards,
    objects: {},
    players: [],
    turnOrder,
    battlefields: [],
    showdown: null,
    combat: null,
    chain: null,
    stage: draft.stage,
    winner: null,
  };
  const state = stateOf(base, draft);
  return { ok: true, state, events: draft.events };
}

function placed(
  player: PlayerId,
  object: ObjectId,
  card: CardId,
  zone: 'legendZone' | 'championZone',
  rule: '111' | '112',
) {
  return {
    type: 'CardPlaced' as const,
    rule,
    visibility: { kind: 'public' as const },
    player,
    object,
    card,
    zone,
  };
}

/** Removes the first occurrence of `card`: the Chosen Champion is one card of the Main Deck. */
function withoutOne(cards: readonly CardId[], card: CardId): CardId[] {
  const index = cards.indexOf(card);
  return index === -1 ? [...cards] : [...cards.slice(0, index), ...cards.slice(index + 1)];
}
