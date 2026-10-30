// Fails when a benchmark of the pull request is more than 20% slower than on its base branch.
// Usage: node scripts/compare-bench.ts <base.json> <head.json>   (vitest bench --reporter=json)
// The base file may be missing (the base branch has no benchmarks yet): then nothing is compared.

import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { compareBenchmarks, formatComparison, readMedians } from './lib/bench-compare.ts';

const [basePath, headPath] = process.argv.slice(2);
if (basePath === undefined || headPath === undefined) {
  console.error('Usage: node scripts/compare-bench.ts <base.json> <head.json>');
  process.exit(2);
}

const read = (path: string) => readMedians(JSON.parse(readFileSync(path, 'utf8')));
const head = read(headPath);
if (head.size === 0) {
  console.error(`No benchmark results in ${headPath}`);
  process.exit(1);
}
const base = existsSync(basePath) ? read(basePath) : new Map<string, number>();
const rows = compareBenchmarks(base, head);
const table = formatComparison(rows);
console.log(table);
if (process.env.GITHUB_STEP_SUMMARY !== undefined) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Engine benchmarks\n\n${table}\n`);
}

const regressions = rows.filter((row) => row.regression);
if (regressions.length > 0) {
  console.error(`\n${regressions.length} benchmark(s) more than 20% slower than the base branch.`);
  process.exit(1);
}
console.log(base.size === 0 ? '\nNo base results: nothing to compare.' : '\n✓ No regression.');
