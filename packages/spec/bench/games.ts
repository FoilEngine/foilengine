// Deterministic games for the engine benchmarks (docs/03-rules-engine.md, Performance).

import { apply, createGame, legalActions, pendingDecision } from '@foilengine/rules';
import { testSetup } from '@foilengine/testkit';
import type { Action, GameState, Seed } from '@foilengine/types';

/** A small linear congruential generator: the benchmarks must not depend on Math.random. */
export function picker(seed: number): (count: number) => number {
  let x = seed >>> 0;
  return (count) => {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    return x % count;
  };
}

const SETUP = testSetup({ distinctDecks: true });

/** Plays a full game with random choices, never conceding. Returns the number of actions. */
export function playRandomGame(seed: number, onState?: (state: GameState) => void): number {
  const created = createGame(SETUP, `bench-${seed}` as Seed);
  if (!created.ok) throw new Error('setup refused');
  const pick = picker(seed);
  let state = created.state;
  let count = 0;
  for (
    let decision = pendingDecision(state);
    decision !== null;
    decision = pendingDecision(state)
  ) {
    onState?.(state);
    const actions = legalActions(state, decision.player);
    // Concede is always last while the game goes on.
    const action = actions[pick(actions.length - 1)] as Action;
    state = apply(state, action).state;
    count += 1;
    if (count > 2000) throw new Error('the game does not end');
  }
  return count;
}

/**
 * A mid-game state: the first state of a random game, from turn 5 on, where the Turn Player is
 * in their Main Phase with at least four cards in hand.
 */
export function midGame(seed = 1): GameState {
  let found: GameState | null = null;
  playRandomGame(seed, (state) => {
    if (found !== null || state.stage.kind !== 'turn' || state.showdown !== null) return;
    const { turnPlayer, turnNumber, phase } = state.stage;
    const player = state.players.find((p) => p.id === turnPlayer);
    if (phase === 'main' && turnNumber >= 5 && (player?.zones.hand.length ?? 0) >= 4) {
      found = state;
    }
  });
  if (found === null) throw new Error(`no mid-game state with seed ${seed}`);
  return found;
}
