// No hidden information reaches a player (ADR 0006, root CLAUDE.md rule 4).
// Three checks on every state reached during setup, with distinct decks for A and B:
// - non-interference: changing what a player cannot see does not change their view;
// - no hidden card: the view names no card of an opponent's hand or of any deck;
// - no hidden object: the view holds no id of an object in a hidden zone.

import { apply, createGame, legalActions, pendingDecision, viewFor } from '@foilengine/rules';
import { testSetup } from '@foilengine/testkit';
import type { CardId, GameObject, GameState, ObjectId, PlayerId, Seed } from '@foilengine/types';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

/** The states of the first actions of a game (setup, mulligans, then turns), mulligans chosen by `picks`. */
const MAX_ACTIONS = 30;

function statesOf(seed: string, picks: readonly number[]): GameState[] {
  const created = createGame(testSetup({ distinctDecks: true }), seed as Seed);
  if (!created.ok) throw new Error('setup refused');
  const states = [created.state];
  let state = created.state;
  let i = 0;
  for (
    let decision = pendingDecision(state);
    decision !== null && states.length <= MAX_ACTIONS;
    decision = pendingDecision(state)
  ) {
    const actions = legalActions(state, decision.player).filter(
      (action) => action.type !== 'Concede',
    );
    const action = actions[(picks[i++] ?? 0) % actions.length];
    if (action === undefined) throw new Error('no legal action');
    state = apply(state, action).state;
    states.push(state);
  }
  return states;
}

/** Objects whose face `viewer` may not see: opponents' hands and every deck. */
function hiddenFrom(state: GameState, viewer: PlayerId): ObjectId[] {
  return state.players.flatMap((p) => [
    ...(p.id === viewer ? [] : p.zones.hand),
    ...p.zones.mainDeck,
    ...p.zones.runeDeck,
  ]);
}

const arbitraryGame = fc.record({
  seed: fc.string({ minLength: 1 }),
  picks: fc.array(fc.nat(), { minLength: 2, maxLength: 2 }),
});

describe('viewFor leaks no hidden information', () => {
  it('changing the hidden cards does not change the view (non-interference)', () => {
    fc.assert(
      fc.property(arbitraryGame, fc.nat(), ({ seed, picks }, salt) => {
        for (const state of statesOf(seed, picks)) {
          for (const viewer of state.turnOrder) {
            const hidden = hiddenFrom(state, viewer);
            // Give every hidden object the card of another hidden object (a rotation).
            const cards = hidden.map((id) => state.objects[id]?.card as CardId);
            const objects: Record<ObjectId, GameObject> = { ...state.objects };
            hidden.forEach((id, index) => {
              const object = objects[id] as GameObject;
              objects[id] = { ...object, card: cards[(index + 1 + salt) % cards.length] as CardId };
            });
            const altered: GameState = { ...state, objects };
            expect(viewFor(altered, viewer)).toEqual(viewFor(state, viewer));
          }
        }
      }),
      { numRuns: 30 },
    );
  });

  it("names no card of the opponent's hand or decks, unless a copy of it is public", () => {
    fc.assert(
      fc.property(arbitraryGame, ({ seed, picks }) => {
        for (const state of statesOf(seed, picks)) {
          for (const viewer of state.turnOrder) {
            const json = JSON.stringify(viewFor(state, viewer));
            const publicIds = state.players.flatMap((p) => [
              ...p.zones.base,
              ...p.zones.legendZone,
              ...p.zones.championZone,
              ...p.zones.trash,
              ...p.zones.banishment,
              ...(p.id === viewer ? p.zones.hand : []),
            ]);
            const publicCards = new Set([
              ...publicIds.map((id) => state.objects[id]?.card),
              ...state.battlefields.map((b) => state.objects[b.object]?.card),
            ]);
            // B plays test:b:… cards, so a card name in the view tells whose card it is.
            for (const id of hiddenFrom(state, viewer)) {
              const card = state.objects[id]?.card;
              if (card !== undefined && !publicCards.has(card))
                expect(json).not.toContain(`"${card}"`);
            }
          }
        }
      }),
      { numRuns: 30 },
    );
  });

  it('holds no id of a hidden object, nor any previous object id', () => {
    fc.assert(
      fc.property(arbitraryGame, ({ seed, picks }) => {
        for (const state of statesOf(seed, picks)) {
          for (const viewer of state.turnOrder) {
            const json = JSON.stringify(viewFor(state, viewer));
            for (const id of hiddenFrom(state, viewer)) {
              expect(json).not.toContain(`"${id}"`);
            }
            expect(json).not.toContain('previousObjectId');
          }
        }
      }),
      { numRuns: 30 },
    );
  });

  it('refuses a viewer who is not in the game', () => {
    const [state] = statesOf('stranger', [0, 0]);
    expect(() => viewFor(state as GameState, 'Z' as PlayerId)).toThrow('not a player');
  });
});
