// Compares two benchmark runs (Vitest JSON reporter) and finds the regressions
// (docs/03-rules-engine.md, Performance: more than 20% slower fails the CI).

/** Median time of one call, in milliseconds, by benchmark name. */
export type BenchMedians = ReadonlyMap<string, number>;

type VitestJson = {
  testResults?: {
    assertionResults?: {
      benchmarks?: { tasks?: { name?: string; latency?: { p50?: number } }[] }[];
    }[];
  }[];
};

/** Reads the medians from the output of `vitest bench --reporter=json`. */
export function readMedians(report: unknown): BenchMedians {
  const medians = new Map<string, number>();
  for (const file of (report as VitestJson).testResults ?? []) {
    for (const test of file.assertionResults ?? []) {
      for (const benchmark of test.benchmarks ?? []) {
        for (const task of benchmark.tasks ?? []) {
          if (task.name !== undefined && typeof task.latency?.p50 === 'number') {
            medians.set(task.name, task.latency.p50);
          }
        }
      }
    }
  }
  return medians;
}

export type BenchComparison = {
  readonly name: string;
  readonly base: number | null;
  readonly head: number;
  /** head / base, or null for a new benchmark. */
  readonly ratio: number | null;
  readonly regression: boolean;
};

/** Every benchmark of `head`, compared with `base`. A regression is a ratio above 1 + threshold. */
export function compareBenchmarks(
  base: BenchMedians,
  head: BenchMedians,
  threshold = 0.2,
): BenchComparison[] {
  return [...head].map(([name, time]) => {
    const before = base.get(name) ?? null;
    const ratio = before === null || before === 0 ? null : time / before;
    return {
      name,
      base: before,
      head: time,
      ratio,
      regression: ratio !== null && ratio > 1 + threshold,
    };
  });
}

/** A Markdown table of the comparison, for the CI log and job summary. */
export function formatComparison(rows: readonly BenchComparison[]): string {
  const ms = (value: number) => `${value.toFixed(4)} ms`;
  const lines = rows.map(({ name, base, head, ratio, regression }) => {
    const change =
      ratio === null ? 'new' : `${ratio >= 1 ? '+' : ''}${((ratio - 1) * 100).toFixed(1)}%`;
    return `| ${name} | ${base === null ? '–' : ms(base)} | ${ms(head)} | ${change}${regression ? ' ✗' : ''} |`;
  });
  return [
    '| Benchmark | Base (median) | Head (median) | Change |',
    '| --- | --- | --- | --- |',
    ...lines,
  ].join('\n');
}
