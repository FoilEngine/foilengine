// board(): a readable builder of starting states (docs/06-testing.md).
//
// It always starts from a real createGame, then only changes what the rules leave to
// chance: who goes first (115) and the order of the shuffled decks (114). Any state it
// builds is therefore reachable, and goes through the same validations as createGame.
// It never invents an impossible state.

import { apply, createGame, pendingDecision } from '@foilengine/rules';
import type {
  CardDefinition,
  CardId,
  GameObject,
  GameSetup,
  GameState,
  ObjectId,
  PlayerId,
  Seed,
} from '@foilengine/types';
import { testSetup } from '../cards/test-cards.ts';

/** A card given by its id or its exact name. */
export type CardRef = string;

export type PlayerLayout = {
  /** The exact cards of the opening hand, as many as the hand holds (4 after 116). */
  readonly hand?: readonly CardRef[];
  /** Cards on top of the Main Deck, top first; the rest keeps its shuffled order. */
  readonly mainDeckTop?: readonly CardRef[];
};

export class BoardError extends Error {
  override readonly name = 'BoardError';
}

export class BoardBuilder {
  #setup: GameSetup = testSetup();
  #seed = 'board';
  #firstPlayer: PlayerId | undefined;
  #layouts = new Map<PlayerId, PlayerLayout>();
  #mulligans: 'pending' | 'kept' = 'pending';

  /** The game setup (default: `testSetup()`, a 1v1 Duel between A and B). */
  setup(setup: GameSetup): this {
    this.#setup = setup;
    return this;
  }

  seed(seed: string): this {
    this.#seed = seed;
    return this;
  }

  /** Who becomes the First Player (115); the others follow in seating order (115.1.b). */
  firstPlayer(player: string): this {
    this.#firstPlayer = player as PlayerId;
    return this;
  }

  /** Stacks a player's hand and the top of their Main Deck. */
  player(player: string, layout: PlayerLayout): this {
    this.#layouts.set(player as PlayerId, layout);
    return this;
  }

  /** Every player keeps their hand: the game is past setup, the First Player's turn begins (118). */
  afterMulligans(): this {
    this.#mulligans = 'kept';
    return this;
  }

  build(): GameState {
    const created = createGame(this.#setup, this.#seed as Seed);
    if (!created.ok) {
      throw new BoardError(
        `The setup is refused: ${created.problems.map((p) => p.message).join('; ')}`,
      );
    }
    let state = created.state;
    if (this.#firstPlayer !== undefined) state = withFirstPlayer(state, this.#firstPlayer);
    for (const [player, layout] of this.#layouts) state = withLayout(state, player, layout);
    if (this.#mulligans === 'kept') {
      for (
        let decision = pendingDecision(state);
        decision !== null;
        decision = pendingDecision(state)
      ) {
        state = apply(state, { type: 'Mulligan', player: decision.player, setAside: [] }).state;
      }
    }
    return state;
  }
}

export function board(): BoardBuilder {
  return new BoardBuilder();
}

/** Resolves a card id or an exact, unique card name among the game's cards. */
export function resolveCard(cards: Readonly<Record<CardId, CardDefinition>>, ref: CardRef): CardId {
  if (cards[ref as CardId] !== undefined) return ref as CardId;
  const named = Object.values(cards).filter((card) => card.name === ref);
  if (named.length === 1 && named[0] !== undefined) return named[0].id;
  throw new BoardError(
    named.length === 0
      ? `No card with id or name "${ref}"`
      : `Several cards are named "${ref}": use an id`,
  );
}

function withFirstPlayer(state: GameState, first: PlayerId): GameState {
  const seating = state.players.map((player) => player.id);
  const index = seating.indexOf(first);
  if (index === -1) throw new BoardError(`${first} is not a player`);
  const turnOrder = [...seating.slice(index), ...seating.slice(0, index)];
  return {
    ...state,
    turnOrder,
    stage: state.stage.kind === 'mulligan' ? { kind: 'mulligan', pending: turnOrder } : state.stage,
  };
}

/** Re-deals the cards of the hand and Main Deck (a different shuffle outcome, 114). */
function withLayout(state: GameState, playerId: PlayerId, layout: PlayerLayout): GameState {
  const player = state.players.find((p) => p.id === playerId);
  if (player === undefined) throw new BoardError(`${playerId} is not a player`);
  const slots: ObjectId[] = [...player.zones.hand, ...player.zones.mainDeck];
  const pool: CardId[] = slots.map((id) => state.objects[id]?.card as CardId);

  const take = (ref: CardRef): CardId => {
    const card = resolveCard(state.cards, ref);
    const index = pool.indexOf(card);
    if (index === -1) {
      throw new BoardError(`${playerId} has no more "${ref}" in their hand and Main Deck`);
    }
    pool.splice(index, 1);
    return card;
  };

  if (layout.hand !== undefined && layout.hand.length !== player.zones.hand.length) {
    throw new BoardError(
      `${playerId}'s hand holds ${player.zones.hand.length} cards, ${layout.hand.length} given`,
    );
  }
  // The hand (requested, or unchanged), then the top of the deck, then the rest in its current order.
  const currentHand = player.zones.hand.map((id) => state.objects[id]?.card as CardId);
  const hand = (layout.hand ?? currentHand).map(take);
  const top = (layout.mainDeckTop ?? []).map(take);
  const order = [...hand, ...top, ...pool];

  const objects: Record<ObjectId, GameObject> = { ...state.objects };
  slots.forEach((id, index) => {
    const object = objects[id] as GameObject;
    objects[id] = { ...object, card: order[index] as CardId };
  });
  return { ...state, objects };
}
