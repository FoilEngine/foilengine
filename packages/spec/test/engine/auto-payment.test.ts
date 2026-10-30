// autoPayment is a help, not a rule (docs/02-game-model.md): it must only propose legal payments.

import { apply, autoPayment, createGame, legalActions, pendingDecision } from '@foilengine/rules';
import { board, testSetup } from '@foilengine/testkit';
import type { GameState, PlayerId, Seed } from '@foilengine/types';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

const A = 'A' as PlayerId;

describe('autoPayment', () => {
  const state = board().firstPlayer('A').afterMulligans().build();

  it('exhausts runes for Energy and recycles nothing when no Power is needed', () => {
    const payment = autoPayment(state, A, { energy: 2, power: [] });
    expect(payment?.map((use) => use.use)).toEqual(['exhaust', 'exhaust']);
  });

  it('exhausts a rune for Energy before recycling it for Power', () => {
    const payment = autoPayment(state, A, { energy: 1, power: ['fury'] });
    expect(payment).toHaveLength(2);
    expect(payment?.[0]?.use).toBe('exhaust');
    expect(payment?.[1]).toEqual({ rune: payment?.[0]?.rune, use: 'recycle' });
  });

  it('returns null when the runes cannot pay', () => {
    expect(autoPayment(state, A, { energy: 3, power: [] })).toBeNull();
    expect(autoPayment(state, A, { energy: 0, power: ['calm'] })).toBeNull();
  });

  it('every PlayCard offered by legalActions is legal and plays the card', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        fc.array(fc.nat(), { minLength: 40, maxLength: 40 }),
        (seed, picks) => {
          const created = createGame(testSetup(), seed as Seed);
          if (!created.ok) throw new Error('setup refused');
          let current: GameState = created.state;
          for (const pick of picks) {
            const decision = pendingDecision(current);
            if (decision === null) break;
            const actions = legalActions(current, decision.player);
            const action = actions[pick % actions.length];
            if (action === undefined) break;
            const result = apply(current, action);
            if (action.type === 'PlayCard') {
              expect(result.events.some((e) => e.type === 'CardPlayed')).toBe(true);
            }
            current = result.state;
          }
        },
      ),
      { numRuns: 25 },
    );
  });
});
