import {
  type Cost,
  DOMAINS,
  type Domain,
  type PowerSymbol,
  type RunePool,
} from '@foilengine/types';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { payFromPool } from '../src/index.ts';

const pool = (energy: number, power: Partial<Record<Domain | 'any', number>> = {}): RunePool => ({
  energy,
  power: { fury: 0, calm: 0, mind: 0, body: 0, chaos: 0, order: 0, any: 0, ...power },
});

/** Brute force: can every power symbol be matched to a distinct unit of power in the pool? */
function canPay(p: RunePool, cost: Cost): boolean {
  if (p.energy < cost.energy) return false;
  const units: (Domain | 'any')[] = [...DOMAINS, 'any' as const].flatMap((key) =>
    Array(p.power[key]).fill(key),
  );
  const used = new Array(units.length).fill(false);
  const fits = (symbol: PowerSymbol, unit: Domain | 'any') =>
    symbol === 'any' || unit === 'any' || unit === symbol;
  const search = (i: number): boolean => {
    const symbol = cost.power[i];
    if (symbol === undefined) return true;
    for (let u = 0; u < units.length; u++) {
      if (!used[u] && fits(symbol, units[u] as Domain | 'any')) {
        used[u] = true;
        if (search(i + 1)) return true;
        used[u] = false;
      }
    }
    return false;
  };
  return search(0);
}

describe('payFromPool (163, 445)', () => {
  it('pays Energy with Energy and Power of a domain with that domain', () => {
    expect(payFromPool(pool(2, { fury: 1 }), { energy: 2, power: ['fury'] })?.pool).toEqual(
      pool(0),
    );
    expect(payFromPool(pool(1, { fury: 1 }), { energy: 2, power: ['fury'] })).toBeNull();
    expect(payFromPool(pool(0, { calm: 1 }), { energy: 0, power: ['fury'] })).toBeNull();
  });

  it('pays any domain with Power of any domain, and [A] with any Power (135.2.e.5)', () => {
    expect(payFromPool(pool(0, { any: 1 }), { energy: 0, power: ['fury'] })?.paid).toEqual({
      energy: 0,
      power: { any: 1 },
    });
    expect(payFromPool(pool(0, { calm: 1 }), { energy: 0, power: ['any'] })?.paid).toEqual({
      energy: 0,
      power: { calm: 1 },
    });
  });

  it('keeps universal Power for the symbols that need it', () => {
    // [A] then Fury, with one Fury and one universal: [A] must not take the universal one.
    expect(
      payFromPool(pool(0, { fury: 1, any: 1 }), { energy: 0, power: ['any', 'fury'] }),
    ).not.toBeNull();
    expect(
      payFromPool(pool(0, { calm: 1, any: 1 }), { energy: 0, power: ['any', 'fury'] }),
    ).not.toBeNull();
  });

  it('pays exactly when a payment exists (compared with a brute-force search)', () => {
    const domainOrAny = fc.constantFrom<Domain | 'any'>(...DOMAINS, 'any');
    fc.assert(
      fc.property(
        fc.nat(4),
        fc.dictionary(domainOrAny, fc.nat(2)),
        fc.nat(4),
        fc.array(domainOrAny, { maxLength: 4 }),
        (energy, power, costEnergy, symbols) => {
          const p = pool(energy, power);
          const cost: Cost = { energy: costEnergy, power: symbols };
          const result = payFromPool(p, cost);
          expect(result !== null).toBe(canPay(p, cost));
          if (result !== null) {
            const total = (x: RunePool) =>
              x.energy + Object.values(x.power).reduce((a, b) => a + b, 0);
            expect(total(result.pool)).toBe(total(p) - costEnergy - symbols.length);
          }
        },
      ),
    );
  });
});
