// Engine benchmarks against the budgets of docs/03-rules-engine.md (Performance).
// Run with `pnpm bench`. On a pull request, the CI also compares them with the base branch
// (scripts/compare-bench.ts).

import { apply, legalActions } from '@foilengine/rules';
import type { Action, PlayerId } from '@foilengine/types';
import { describe, expect, test } from 'vitest';
import { midGame, playRandomGame } from './games.ts';

const state = midGame();
const turnPlayer = (state.stage.kind === 'turn' ? state.stage.turnPlayer : null) as PlayerId;
const actions = legalActions(state, turnPlayer);
const first = (type: Action['type']): Action => {
  const action = actions.find((a) => a.type === type);
  if (action === undefined) throw new Error(`no ${type} in the mid-game state`);
  return action;
};

/** Budgets in milliseconds, per call. */
const BUDGET = { legalActions: 0.2, apply: 0.2, game: 20 } as const;

describe('engine budgets', () => {
  test('legalActions, mid-game', async ({ bench }) => {
    const result = await bench('legalActions, mid-game', () => {
      legalActions(state, turnPlayer);
    }).run();
    expect(result.latency.mean).toBeLessThan(BUDGET.legalActions);
  });

  test('apply PlayCard, mid-game', async ({ bench }) => {
    const action = first('PlayCard');
    const result = await bench('apply PlayCard, mid-game', () => {
      apply(state, action);
    }).run();
    expect(result.latency.mean).toBeLessThan(BUDGET.apply);
  });

  test('apply EndTurn, mid-game', async ({ bench }) => {
    const action = first('EndTurn');
    const result = await bench('apply EndTurn, mid-game', () => {
      apply(state, action);
    }).run();
    expect(result.latency.mean).toBeLessThan(BUDGET.apply);
  });

  test('full random game', async ({ bench }) => {
    let seed = 0;
    const result = await bench('full random game', () => {
      seed = (seed % 50) + 1;
      playRandomGame(seed);
    }).run();
    expect(result.latency.mean).toBeLessThan(BUDGET.game);
  });
});
