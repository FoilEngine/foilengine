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

const digests = new WeakMap<object, string>();

/**
 * A Merkle fingerprint of a JSON value: the digest of an object or an array hashes the digests
 * of its items (keys sorted, undefined entries left out), and is cached by reference.
 * A state never changes once built (ADR 0004) and shares most of its objects with the previous
 * one, so fingerprinting each step of a game only hashes what that step changed.
 * Never mutate a value after fingerprinting it: its cached digest would be stale.
 */
export function digestOf(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  const cached = digests.get(value);
  if (cached !== undefined) return cached;
  let text: string;
  if (Array.isArray(value)) {
    text = '[';
    for (let i = 0; i < value.length; i++) text += (i === 0 ? '' : ',') + digestOf(value[i]);
    text += ']';
  } else {
    const record = value as Record<string, unknown>;
    text = '{';
    for (const key of Object.keys(record).sort()) {
      const item = record[key];
      if (item === undefined) continue;
      text += `${text.length === 1 ? '' : ','}${JSON.stringify(key)}:${digestOf(item)}`;
    }
    text += '}';
  }
  const digest = `#${hash128(text)}`;
  digests.set(value, digest);
  return digest;
}

/** 32 hexadecimal characters. */
export function stateHash(state: GameState): string {
  return digestOf(state).slice(1);
}
