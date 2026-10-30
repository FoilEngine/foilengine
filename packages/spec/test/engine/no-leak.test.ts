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

/** Every state from creation to the end of setup, with mulligans chosen by `picks`. */
function statesOf(seed: string, picks: readonly number[]): GameState[] {
  const created = createGame(testSetup({ distinctDecks: true }), seed as Seed);
  if (!created.ok) throw new Error('setup refused');
  const states = [created.state];
  let state = created.state;
  let i = 0;
  for (
    let decision = pendingDecision(state);
    decision !== null;
    decision = pendingDecision(state)
  ) {
    const actions = legalActions(state, decision.player);
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

  it("names no card of the opponent's hand or decks", () => {
    fc.assert(
      fc.property(arbitraryGame, ({ seed, picks }) => {
        for (const state of statesOf(seed, picks)) {
          const json = JSON.stringify(viewFor(state, 'A' as PlayerId));
          // B plays test:b:… cards: their vanillas and runes are only ever in B's hand or decks.
          expect(json).not.toMatch(/test:b:(vanilla|rune)/);
          // A's own deck cards are only visible once in A's hand.
          const a = state.players.find((p) => p.id === 'A');
          for (const id of [...(a?.zones.mainDeck ?? []), ...(a?.zones.runeDeck ?? [])]) {
            expect(json).not.toContain(`"${id}"`);
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
