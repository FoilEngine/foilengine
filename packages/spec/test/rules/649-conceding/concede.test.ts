import { legalActions, outcome } from '@foilengine/rules';
import { board, scenario } from '@foilengine/testkit';
import type { GameState } from '@foilengine/types';
import { describe } from 'vitest';
import {
  A,
  act,
  B,
  battlefield,
  beforeCombat,
  move,
  ofType,
  unitsInBase,
} from '../../battlefields.ts';

/** B's units attacked; the Combat Damage Step waits for B's assignment. */
const combatDamageStep = (): GameState => {
  const state = beforeCombat('both');
  return act(
    state,
    move(B, unitsInBase(state, B), battlefield(state, 0)),
    { type: 'PassFocus', player: B },
    { type: 'PassFocus', player: A },
  ).state;
};

describe('649–652 Conceding', () => {
  scenario('rule 650: a player may concede at any time, even without a decision to make', {
    rules: ['650'],
    setup: board().firstPlayer('A'),
    check: (t) => {
      // During the mulligans, B is not the one deciding.
      t.expectDecision({ kind: 'Mulligan', player: A });
      t.expectLegal({ type: 'Concede', player: B });
      t.expect(legalActions(t.state, B)).toEqual([{ type: 'Concede', player: B }]);
    },
  });

  scenario('rule 650: a player may concede in the middle of a Combat', {
    rules: ['650'],
    setup: combatDamageStep,
    check: (t) => {
      t.expectDecision({ kind: 'AssignDamage', player: B });
      t.act({ type: 'Concede', player: A });
      t.expect(t.state.combat).toBeNull();
      t.expect(t.state.winner).toBe(B);
    },
  });

  scenario(
    'rule 651.1: when a player concedes and only one other player remains, that player wins',
    {
      rules: ['651.1', '651', '195'],
      setup: board().firstPlayer('A').afterMulligans(),
      act: (t) => t.act({ type: 'Concede', player: A }),
      check: (t) => {
        t.expectEvents(['PlayerConceded', 'GameWon']);
        t.expect(ofType(t.events, 'PlayerConceded')).toMatchObject([{ player: A, rule: '651' }]);
        t.expect(ofType(t.events, 'GameWon')).toMatchObject([{ player: B, rule: '651.1' }]);
        t.expect(outcome(t.state)).toEqual({ kind: 'won', winner: B });
      },
    },
  );

  scenario('rule 196: once a player has won after a concession, the game is over', {
    rules: ['196', '651.3'],
    setup: board().firstPlayer('A').afterMulligans(),
    act: (t) => t.act({ type: 'Concede', player: B }),
    check: (t) => {
      t.expect(t.state.stage).toEqual({ kind: 'ended' });
      t.expectDecision(null);
      t.expectIllegal({ type: 'Concede', player: A }, 'no-pending-decision');
      t.expectIllegal({ type: 'EndTurn', player: A }, 'no-pending-decision');
      t.expect(legalActions(t.state, A)).toEqual([]);
      t.expect(legalActions(t.state, B)).toEqual([]);
    },
  });
});
