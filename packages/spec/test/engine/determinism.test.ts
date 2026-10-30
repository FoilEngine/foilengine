// Engine properties (ADR 0003, 0004): not rules, so no rule number.

import { apply, createGame, legalActions, pendingDecision } from '@foilengine/rules';
import { testSetup } from '@foilengine/testkit';
import type { GameEvent, GameState, Seed } from '@foilengine/types';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

/** Plays the whole setup, choosing each mulligan with `pick`. */
function playSetup(
  seed: string,
  pick: (count: number) => number,
): { states: GameState[]; events: GameEvent[] } {
  const created = createGame(testSetup(), seed as Seed);
  if (!created.ok) throw new Error('setup refused');
  const states = [created.state];
  const events = [...created.events];
  let state = created.state;
  for (
    let decision = pendingDecision(state);
    decision !== null;
    decision = pendingDecision(state)
  ) {
    const actions = legalActions(state, decision.player).filter(
      (action) => action.type !== 'Concede',
    );
    const action = actions[pick(actions.length) % actions.length];
    if (action === undefined) throw new Error('no legal action');
    const result = apply(state, action);
    state = result.state;
    states.push(state);
    events.push(...result.events);
  }
  return { states, events };
}

describe('determinism', () => {
  it('same setup, seed and choices give the same game, event for event', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        fc.array(fc.nat(), { minLength: 2, maxLength: 2 }),
        (seed, picks) => {
          const run = () => {
            let i = 0;
            return playSetup(seed, () => picks[i++] ?? 0);
          };
          expect(JSON.stringify(run())).toBe(JSON.stringify(run()));
        },
      ),
      // Each run plays two full games: 20 runs keep the test under a few seconds until the
      // engine meets its performance budgets (M2 benchmarks).
      { numRuns: 20 },
    );
  }, 20_000);

  it('events are numbered 1, 2, 3… without gaps', () => {
    const { events } = playSetup('numbering', () => 5);
    expect(events.map((e) => e.seq)).toEqual(events.map((_, i) => i + 1));
  });
});

describe('state', () => {
  it('is pure JSON at every step', () => {
    for (const state of playSetup('json', () => 7).states) {
      expect(JSON.parse(JSON.stringify(state))).toEqual(state);
    }
  });

  it('is never modified by apply', () => {
    const created = createGame(testSetup(), 'immutable' as Seed);
    if (!created.ok) throw new Error('setup refused');
    const copy = JSON.parse(JSON.stringify(created.state));
    const [action] = legalActions(created.state, created.state.turnOrder[0] as never).filter(
      (a) => a.type !== 'Concede',
    );
    if (action === undefined) throw new Error('no action');
    apply(created.state, action);
    expect(created.state).toEqual(copy);
  });

  it('every card is in exactly one zone, and every object in a zone exists', () => {
    for (const state of playSetup('zones', () => 3).states) {
      const located = [
        ...state.players.flatMap((p) => Object.values(p.zones).flat()),
        ...state.battlefields.flatMap((b) => [b.object, ...b.units]),
      ];
      expect(new Set(located).size).toBe(located.length);
      expect(new Set(located)).toEqual(new Set(Object.keys(state.objects)));
    }
  });
});
