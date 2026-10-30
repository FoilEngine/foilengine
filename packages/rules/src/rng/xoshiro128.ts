// Seeded PRNG of the engine (ADR 0003): xoshiro128** 1.1 by David Blackman and
// Sebastiano Vigna (public domain, https://prng.di.unimi.it/xoshiro128starstar.c).
// Only 32-bit integer operations, so Node and browsers give the same sequence.
// Every function is pure: it takes a state and returns the next one.

import type { RngState, Seed } from '@foilengine/types';

export const RNG_ALGORITHM = 'xoshiro128**';

/** A drawn value and the state to use for the next draw. */
export type Drawn<T> = { readonly value: T; readonly rng: RngState };

type Words = readonly [number, number, number, number];

const UINT32_RANGE = 0x1_0000_0000;

const rotl = (x: number, k: number): number => ((x << k) | (x >>> (32 - k))) >>> 0;

function wordsOf(rng: RngState): Words {
  const [a, b, c, d] = rng.state;
  if (
    rng.algorithm !== RNG_ALGORITHM ||
    rng.state.length !== 4 ||
    a === undefined ||
    b === undefined ||
    c === undefined ||
    d === undefined
  ) {
    throw new RangeError(`Not a ${RNG_ALGORITHM} state: ${JSON.stringify(rng)}`);
  }
  if ((a | b | c | d) === 0) {
    throw new RangeError(`A ${RNG_ALGORITHM} state must not be all zeros`);
  }
  return [a, b, c, d];
}

/** Builds a state from four 32-bit words (not all zero). */
export function rngFromWords(words: Words): RngState {
  const state: Words = [words[0] >>> 0, words[1] >>> 0, words[2] >>> 0, words[3] >>> 0];
  const rng = { algorithm: RNG_ALGORITHM, state };
  wordsOf(rng);
  return rng;
}

/** Next 32-bit unsigned integer: the `next()` function of the reference implementation. */
export function nextUint32(rng: RngState): Drawn<number> {
  let [s0, s1, s2, s3] = wordsOf(rng);
  const value = Math.imul(rotl(Math.imul(s1, 5) >>> 0, 7), 9) >>> 0;
  const t = (s1 << 9) >>> 0;
  s2 = (s2 ^ s0) >>> 0;
  s3 = (s3 ^ s1) >>> 0;
  s1 = (s1 ^ s2) >>> 0;
  s0 = (s0 ^ s3) >>> 0;
  s2 = (s2 ^ t) >>> 0;
  s3 = rotl(s3, 11);
  return { value, rng: { algorithm: RNG_ALGORITHM, state: [s0, s1, s2, s3] } };
}

/** Uniform integer in [0, bound), without modulo bias (rejection sampling). */
export function nextInt(rng: RngState, bound: number): Drawn<number> {
  if (!Number.isInteger(bound) || bound < 1 || bound > UINT32_RANGE) {
    throw new RangeError(`bound must be an integer between 1 and 2^32, got ${bound}`);
  }
  const limit = UINT32_RANGE - (UINT32_RANGE % bound);
  let current = rng;
  for (;;) {
    const drawn = nextUint32(current);
    if (drawn.value < limit) return { value: drawn.value % bound, rng: drawn.rng };
    current = drawn.rng;
  }
}

/** Uniform random permutation (Fisher–Yates). The input array is not modified. */
export function shuffle<T>(rng: RngState, items: readonly T[]): Drawn<T[]> {
  const result = [...items];
  let current = rng;
  for (let i = result.length - 1; i > 0; i--) {
    const drawn = nextInt(current, i + 1);
    current = drawn.rng;
    const j = drawn.value;
    const a = result[i] as T;
    result[i] = result[j] as T;
    result[j] = a;
  }
  return { value: result, rng: current };
}

/** Murmur3 finalizer: spreads the bits of a 32-bit hash. */
function fmix32(h: number): number {
  let x = h >>> 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x85eb_ca6b) >>> 0;
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2_ae35) >>> 0;
  x ^= x >>> 16;
  return x >>> 0;
}

/** FNV-1a over the UTF-16 code units of the seed, one independent lane per state word. */
function hashLane(seed: string, lane: number): number {
  let h = (0x811c_9dc5 ^ Math.imul(lane + 1, 0x9e37_79b9)) >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 0x0100_0193) >>> 0;
  }
  return fmix32(h ^ seed.length);
}

/**
 * Derives the initial state from a seed. Part of the replay contract: changing this
 * function changes every game created from a seed (docs/03-rules-engine.md).
 */
export function createRng(seed: Seed): RngState {
  if (seed.length === 0) throw new RangeError('The seed must not be empty');
  const words: Words = [hashLane(seed, 0), hashLane(seed, 1), hashLane(seed, 2), hashLane(seed, 3)];
  return rngFromWords((words[0] | words[1] | words[2] | words[3]) === 0 ? [1, 0, 0, 0] : words);
}
