// Rune Pools (165–167) and paying from them (445, 357.1).

import { type Cost, DOMAINS, type Domain, type Resources, type RunePool } from '@foilengine/types';

type MutablePool = { energy: number; power: { [D in Domain | 'any']: number } };

const POWER_KEYS: readonly (Domain | 'any')[] = [...DOMAINS, 'any'];

export function emptyPool(): MutablePool {
  return { energy: 0, power: { fury: 0, calm: 0, mind: 0, body: 0, chaos: 0, order: 0, any: 0 } };
}

export function copyPool(pool: RunePool): MutablePool {
  return { energy: pool.energy, power: { ...pool.power } };
}

export function isEmptyPool(pool: RunePool): boolean {
  return pool.energy === 0 && POWER_KEYS.every((key) => pool.power[key] === 0);
}

/** The pool as a Resources value, without the zero entries. */
export function asResources(pool: RunePool): Resources {
  const power: { [D in Domain | 'any']?: number } = {};
  for (const key of POWER_KEYS) if (pool.power[key] > 0) power[key] = pool.power[key];
  return { energy: pool.energy, power };
}

/**
 * Pays `cost` from `pool` (445.1), or returns null when the pool does not cover it.
 * Energy pays the Energy cost (163.1). A domain symbol is paid by Power of that domain, else by
 * Power of any domain (163.2, 135.2.e.5.b); a [A] symbol by Power of any domain (135.2.e.5.a),
 * using domain Power first so that the flexible [A] Power stays for symbols that need it.
 * Returns the remaining pool and what was paid.
 */
export function payFromPool(
  pool: RunePool,
  cost: Cost,
): { pool: MutablePool; paid: Resources } | null {
  const next = copyPool(pool);
  if (next.energy < cost.energy) return null;
  next.energy -= cost.energy;
  const paidPower: { [D in Domain | 'any']?: number } = {};
  const take = (key: Domain | 'any') => {
    next.power[key] -= 1;
    paidPower[key] = (paidPower[key] ?? 0) + 1;
  };

  const specific = cost.power.filter((symbol): symbol is Domain => symbol !== 'any');
  const anySymbols = cost.power.length - specific.length;
  for (const domain of specific) {
    if (next.power[domain] > 0) take(domain);
    else if (next.power.any > 0) take('any');
    else return null;
  }
  for (let i = 0; i < anySymbols; i++) {
    const domain = DOMAINS.find((d) => next.power[d] > 0);
    if (domain !== undefined) take(domain);
    else if (next.power.any > 0) take('any');
    else return null;
  }
  return { pool: next, paid: { energy: cost.energy, power: paidPower } };
}
