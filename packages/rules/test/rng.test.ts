import type { RngState, Seed } from '@foilengine/types';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  createRng,
  type Drawn,
  nextInt,
  nextUint32,
  RNG_ALGORITHM,
  rngFromWords,
  shuffle,
} from '../src/index.ts';

const seed = (value: string) => value as Seed;

/** Draws `count` uint32 values, returning them with the final state. */
function draw(rng: RngState, count: number): Drawn<number[]> {
  const values: number[] = [];
  let current = rng;
  for (let i = 0; i < count; i++) {
    const next = nextUint32(current);
    values.push(next.value);
    current = next.rng;
  }
  return { value: values, rng: current };
}

describe('xoshiro128** 1.1', () => {
  // Expected values computed by a separate Python port of the official C source
  // (https://prng.di.unimi.it/xoshiro128starstar.c). The [1, 2, 3, 4] sequence also
  // matches the values published for this generator.
  it('matches the reference implementation from [1, 2, 3, 4]', () => {
    const { value, rng } = draw(rngFromWords([1, 2, 3, 4]), 12);
    expect(value).toEqual([
      11520, 0, 5927040, 70819200, 2031721883, 1637235492, 1287239034, 3734860849, 3729100597,
      4258142804, 337829053, 2142557243,
    ]);
    expect(rng.state).toEqual([732694577, 3850432822, 1098276040, 1542782851]);
  });

  it('matches the reference implementation with high bits set', () => {
    const start = rngFromWords([0xdeadbeef, 0x01234567, 0x89abcdef, 0xfedcba98]);
    const { value, rng } = draw(start, 12);
    expect(value).toEqual([
      2576977298, 1162350735, 558593417, 7144843, 2523195487, 3129381430, 3688772568, 1727139565,
      2138660864, 1116707375, 170318514, 2399004742,
    ]);
    expect(rng.state).toEqual([4054990819, 292339951, 1142438788, 276994701]);
  });

  it('refuses an all-zero or malformed state', () => {
    expect(() => rngFromWords([0, 0, 0, 0])).toThrow(RangeError);
    expect(() => nextUint32({ algorithm: 'pcg32', state: [1, 2, 3, 4] })).toThrow(RangeError);
    expect(() => nextUint32({ algorithm: RNG_ALGORITHM, state: [1, 2, 3] })).toThrow(RangeError);
  });
});

describe('determinism (ADR 0003)', () => {
  it('the same seed gives the same sequence', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (s) => {
        expect(draw(createRng(seed(s)), 8)).toEqual(draw(createRng(seed(s)), 8));
      }),
    );
  });

  it('different seeds give different sequences', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), fc.string({ minLength: 1 }), (a, b) => {
        fc.pre(a !== b);
        expect(draw(createRng(seed(a)), 4).value).not.toEqual(draw(createRng(seed(b)), 4).value);
      }),
    );
  });

  it('seeds that differ by one character are unrelated', () => {
    expect(draw(createRng(seed('game-1')), 4).value).not.toEqual(
      draw(createRng(seed('game-2')), 4).value,
    );
  });

  // Regression lock: createRng is part of the replay contract. If this test fails,
  // every game recorded from a seed would replay differently.
  it('derives the same state from a seed as before', () => {
    expect(createRng(seed('foil'))).toEqual({
      algorithm: 'xoshiro128**',
      state: expect.any(Array),
    });
    expect(draw(createRng(seed('foil')), 4).value).toMatchInlineSnapshot(`
      [
        1271802816,
        2218848408,
        4009194429,
        2015904979,
      ]
    `);
  });

  it('refuses an empty seed', () => {
    expect(() => createRng(seed(''))).toThrow(RangeError);
  });
});

describe('state', () => {
  it('is pure JSON and resumes identically after a round trip', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), fc.nat(20), (s, skip) => {
        const middle = draw(createRng(seed(s)), skip).rng;
        const restored = JSON.parse(JSON.stringify(middle)) as RngState;
        expect(draw(restored, 8)).toEqual(draw(middle, 8));
      }),
    );
  });

  it('is never modified by a draw', () => {
    const rng = createRng(seed('immutable'));
    const copy = JSON.parse(JSON.stringify(rng)) as RngState;
    nextUint32(rng);
    nextInt(rng, 6);
    shuffle(rng, [1, 2, 3, 4, 5]);
    expect(rng).toEqual(copy);
  });
});

describe('nextInt', () => {
  it('stays in [0, bound)', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), fc.integer({ min: 1, max: 2 ** 32 }), (s, bound) => {
        const { value } = nextInt(createRng(seed(s)), bound);
        expect(Number.isInteger(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(bound);
      }),
    );
  });

  it('is uniform (chi-square on a six-sided die)', () => {
    const counts = [0, 0, 0, 0, 0, 0];
    let rng = createRng(seed('dice'));
    const rolls = 60_000;
    for (let i = 0; i < rolls; i++) {
      const drawn = nextInt(rng, 6);
      counts[drawn.value] = (counts[drawn.value] ?? 0) + 1;
      rng = drawn.rng;
    }
    const expected = rolls / 6;
    const chiSquare = counts.reduce((sum, c) => sum + (c - expected) ** 2 / expected, 0);
    // 5 degrees of freedom: 20.52 is the 99.9th percentile.
    expect(chiSquare).toBeLessThan(20.52);
  });

  it('refuses an invalid bound', () => {
    const rng = createRng(seed('bounds'));
    for (const bound of [0, -1, 1.5, 2 ** 32 + 1, Number.NaN]) {
      expect(() => nextInt(rng, bound)).toThrow(RangeError);
    }
  });
});

describe('shuffle (114)', () => {
  it('returns a permutation and leaves the input unchanged', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), fc.array(fc.integer()), (s, items) => {
        const before = [...items];
        const { value } = shuffle(createRng(seed(s)), items);
        expect(items).toEqual(before);
        expect([...value].sort((a, b) => a - b)).toEqual([...items].sort((a, b) => a - b));
      }),
    );
  });

  it('is deterministic for a given state', () => {
    const deck = Array.from({ length: 40 }, (_, i) => i);
    expect(shuffle(createRng(seed('deck')), deck)).toEqual(shuffle(createRng(seed('deck')), deck));
  });

  it('gives every order of three cards with the same frequency', () => {
    const counts = new Map<string, number>();
    let rng = createRng(seed('orders'));
    const shuffles = 60_000;
    for (let i = 0; i < shuffles; i++) {
      const drawn = shuffle(rng, ['a', 'b', 'c']);
      const key = drawn.value.join('');
      counts.set(key, (counts.get(key) ?? 0) + 1);
      rng = drawn.rng;
    }
    expect(counts.size).toBe(6);
    const expected = shuffles / 6;
    const chiSquare = [...counts.values()].reduce(
      (sum, c) => sum + (c - expected) ** 2 / expected,
      0,
    );
    expect(chiSquare).toBeLessThan(20.52);
  });
});
