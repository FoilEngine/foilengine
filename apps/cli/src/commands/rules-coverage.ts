// foil rules coverage (pnpm test:rules): the status of every Core Rules rule
// (docs/06-testing.md, ADR 0008). Runs the scenarios of @foilengine/spec, then writes
// reports/rule-coverage.json and reports/rule-coverage.md.

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  currentCoreRules,
  type DeferredRule,
  exercisedRules,
  type NotApplicableRule,
  parseOpenQuestions,
  pinCoveredRules,
  type RuleCoverageReport,
  type RulePins,
  renderCoverageMarkdown,
  ruleCoverage,
  rulesOfTest,
  type ScenarioResult,
} from '@foilengine/testkit';
import { REPO_ROOT } from '../paths.ts';

export const PINS_FILE = join(REPO_ROOT, 'packages', 'spec', 'rule-pins.json');
export const NOT_APPLICABLE_FILE = join(REPO_ROOT, 'docs', 'rules', 'not-applicable.json');
export const DEFERRED_FILE = join(REPO_ROOT, 'docs', 'rules', 'deferred.json');
export const QUESTIONS_FILE = join(REPO_ROOT, 'docs', 'rules', 'questions.md');
export const REPORTS_DIR = join(REPO_ROOT, 'reports');

type VitestJson = {
  testResults: {
    assertionResults: { title: string; status: string; meta?: { rules?: string[] } }[];
  }[];
};

/** Runs the spec scenarios with Vitest's JSON reporter and returns the tests that quote rules. */
export async function runScenarios(): Promise<ScenarioResult[]> {
  const dir = await mkdtemp(join(tmpdir(), 'foil-coverage-'));
  const output = join(dir, 'spec.json');
  try {
    spawnSync(
      join(REPO_ROOT, 'node_modules', '.bin', 'vitest'),
      ['run', '--reporter=json', `--outputFile=${output}`],
      { cwd: join(REPO_ROOT, 'packages', 'spec'), stdio: 'ignore' },
    );
    if (!existsSync(output))
      throw new Error(
        'Vitest wrote no report: run `pnpm --filter @foilengine/spec test` to see why',
      );
    const json = JSON.parse(await readFile(output, 'utf8')) as VitestJson;
    return json.testResults
      .flatMap((file) => file.assertionResults)
      .filter((test) => test.status === 'passed' || test.status === 'failed')
      .map((test) => ({
        title: test.title,
        rules: rulesOfTest(test.title, test.meta?.rules),
        passed: test.status === 'passed',
      }))
      .filter((test) => test.rules.length > 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function readJson<T>(path: string, fallback: T): Promise<T> {
  return existsSync(path) ? (JSON.parse(await readFile(path, 'utf8')) as T) : fallback;
}

export type RulesCoverageOptions = {
  /** Pin every covered rule to its current text before reporting. */
  readonly pin?: boolean;
};

export async function runRulesCoverage(
  options: RulesCoverageOptions = {},
): Promise<{ report: RuleCoverageReport; pinsWritten: boolean }> {
  const { index } = currentCoreRules();
  const scenarios = await runScenarios();
  const notApplicable = await readJson<{ rules: NotApplicableRule[] }>(NOT_APPLICABLE_FILE, {
    rules: [],
  });
  const deferred = await readJson<{ rules: DeferredRule[] }>(DEFERRED_FILE, { rules: [] });
  const questions = existsSync(QUESTIONS_FILE)
    ? parseOpenQuestions(await readFile(QUESTIONS_FILE, 'utf8'))
    : [];
  let pins = await readJson<RulePins>(PINS_FILE, { rulesVersion: index.version, pins: {} });

  const compute = () =>
    ruleCoverage({
      index,
      scenarios,
      exercised: exercisedRules(),
      notApplicable: notApplicable.rules,
      deferred: deferred.rules,
      openQuestions: questions,
      pins,
    });

  let report = compute();
  if (options.pin === true) {
    pins = pinCoveredRules(report, index, pins);
    await writeFile(PINS_FILE, `${JSON.stringify(pins, null, 2)}\n`);
    report = compute();
  }

  await mkdir(REPORTS_DIR, { recursive: true });
  await writeFile(join(REPORTS_DIR, 'rule-coverage.json'), `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(join(REPORTS_DIR, 'rule-coverage.md'), renderCoverageMarkdown(report));
  return { report, pinsWritten: options.pin === true };
}
