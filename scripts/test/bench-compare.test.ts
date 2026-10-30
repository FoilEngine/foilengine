import { describe, expect, it } from 'vitest';
import { compareBenchmarks, formatComparison, readMedians } from '../lib/bench-compare.ts';

const report = (tasks: Record<string, number>) => ({
  testResults: [
    {
      assertionResults: [
        {
          benchmarks: Object.entries(tasks).map(([name, p50]) => ({
            name: `suite > ${name}`,
            tasks: [{ name, latency: { p50, mean: p50 * 2 } }],
          })),
        },
        { benchmarks: undefined },
      ],
    },
  ],
});

describe('readMedians', () => {
  it('reads the median of every benchmark task', () => {
    expect([...readMedians(report({ a: 0.05, b: 7.5 }))]).toEqual([
      ['a', 0.05],
      ['b', 7.5],
    ]);
  });

  it('ignores anything else', () => {
    expect(readMedians({}).size).toBe(0);
    expect(readMedians({ testResults: [{ assertionResults: [{}] }] }).size).toBe(0);
  });
});

describe('compareBenchmarks', () => {
  const base = readMedians(report({ fast: 1, slow: 1, same: 1 }));
  const head = readMedians(report({ fast: 0.5, slow: 1.25, same: 1.2, added: 3 }));
  const rows = compareBenchmarks(base, head);

  it('flags a benchmark more than 20% slower, and only that one', () => {
    expect(rows.filter((r) => r.regression).map((r) => r.name)).toEqual(['slow']);
  });

  it('exactly 20% slower is not a regression', () => {
    expect(rows.find((r) => r.name === 'same')).toMatchObject({ regression: false });
  });

  it('a new benchmark has no base and is never a regression', () => {
    expect(rows.find((r) => r.name === 'added')).toMatchObject({
      base: null,
      ratio: null,
      regression: false,
    });
  });

  it('formats a table with the change of each benchmark', () => {
    const table = formatComparison(rows);
    expect(table).toContain('| fast | 1.0000 ms | 0.5000 ms | -50.0% |');
    expect(table).toContain('| slow | 1.0000 ms | 1.2500 ms | +25.0% ✗ |');
    expect(table).toContain('| added | – | 3.0000 ms | new |');
  });
});
