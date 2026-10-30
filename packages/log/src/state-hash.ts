// The fingerprint of a game state: equal states give equal fingerprints, whatever the order in
// which their keys were written (packages/log/CLAUDE.md).

import type { GameState } from '@foilengine/types';
import { hash128 } from './hash.ts';

/** JSON with the keys of every object sorted: the same value always gives the same text. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(',')}}`;
}

export function stateHash(state: GameState): string {
  return hash128(canonicalJson(state));
}
