// Rule coverage (docs/06-testing.md, ADR 0008): the status of every rule of the Core Rules.
// Pure functions: the CLI (`pnpm test:rules`) gathers the inputs and writes the reports.

import { type CoreRulesIndex, compareRuleNumbers } from '../rules-index/index-core-rules.ts';

export type RuleStatus =
  | 'covered'
  | 'stale'
  | 'question'
  | 'not-applicable'
  | 'exercised'
  | 'uncovered';

export const RULE_STATUSES: readonly RuleStatus[] = [
  'covered',
  'stale',
  'question',
  'not-applicable',
  'exercised',
  'uncovered',
];

/** A test of `@foilengine/spec`, as reported by Vitest. */
export type ScenarioResult = {
  readonly title: string;
  /** Rules declared by scenario() (test meta); for a plain test, read from its title. */
  readonly rules: readonly string[];
  readonly passed: boolean;
};

export type NotApplicableRule = { readonly number: string; readonly reason: string };
export type OpenQuestion = { readonly id: string; readonly rules: readonly string[] };

/** Fingerprint of each covered rule's text when its scenarios were written or last reviewed. */
export type RulePins = {
  readonly rulesVersion: string;
  readonly pins: Readonly<Record<string, string>>;
};

export type CoverageInput = {
  readonly index: CoreRulesIndex;
  readonly scenarios: readonly ScenarioResult[];
  /** Rules that produced events while games were played. */
  readonly exercised: ReadonlySet<string>;
  readonly notApplicable: readonly NotApplicableRule[];
  readonly openQuestions: readonly OpenQuestion[];
  readonly pins: RulePins;
};

export type RuleCoverageEntry = {
  readonly number: string;
  readonly status: RuleStatus;
  /** Titles of the passing scenarios dedicated to this rule. */
  readonly scenarios: readonly string[];
  /** Why the rule is not-applicable, or which question it waits for. */
  readonly note: string | null;
};

export type CoverageTotals = Readonly<Record<RuleStatus, number>>;

export type CoverageProblems = {
  /** Scenarios that fail. */
  readonly failing: readonly string[];
  /** Covered rules whose text changed since they were pinned: review the scenarios, then re-pin. */
  readonly stale: readonly string[];
  /** Pinned rules that are no longer covered. */
  readonly regressions: readonly string[];
  /** Covered rules not pinned yet: run `pnpm test:rules --pin`. */
  readonly unpinned: readonly string[];
  /** Rule numbers quoted by scenarios or pins that do not exist in this version. */
  readonly unknownRules: readonly string[];
};

export type RuleCoverageReport = {
  readonly rulesVersion: string;
  readonly ruleCount: number;
  readonly totals: CoverageTotals;
  readonly bySection: readonly { readonly section: string; readonly totals: CoverageTotals }[];
  readonly problems: CoverageProblems;
  readonly rules: readonly RuleCoverageEntry[];
};

const RULE_TITLE = /^rule (\d{3}(?:\.(?:\d+|[a-z]))*): /;

/** Rules of a test: the declared ones, or the one its title starts with. */
export function rulesOfTest(title: string, declared: readonly string[] | undefined): string[] {
  if (declared !== undefined && declared.length > 0) return [...declared];
  const match = RULE_TITLE.exec(title)?.[1];
  return match === undefined ? [] : [match];
}

const emptyTotals = (): Record<RuleStatus, number> => ({
  covered: 0,
  stale: 0,
  question: 0,
  'not-applicable': 0,
  exercised: 0,
  uncovered: 0,
});

/** Section of a rule: its hundred (`315.3.b` → `300`). */
export const sectionOf = (number: string): string => `${number.slice(0, 1)}00`;

export function ruleCoverage(input: CoverageInput): RuleCoverageReport {
  const { index, pins } = input;
  const known = new Set(index.rules.map((rule) => rule.number));
  const passing = new Map<string, string[]>();
  const failing: string[] = [];
  const unknownRules = new Set<string>();

  for (const scenario of input.scenarios) {
    if (!scenario.passed) failing.push(scenario.title);
    for (const rule of scenario.rules) {
      if (!known.has(rule)) unknownRules.add(rule);
      else if (scenario.passed) passing.set(rule, [...(passing.get(rule) ?? []), scenario.title]);
    }
  }
  for (const rule of Object.keys(pins.pins)) if (!known.has(rule)) unknownRules.add(rule);

  const questions = new Map<string, string>();
  for (const question of input.openQuestions) {
    for (const rule of question.rules) questions.set(rule, question.id);
  }
  const notApplicable = new Map(input.notApplicable.map((rule) => [rule.number, rule.reason]));

  const stale: string[] = [];
  const regressions: string[] = [];
  const unpinned: string[] = [];
  const totals = emptyTotals();
  const sections = new Map<string, Record<RuleStatus, number>>();

  const rules = index.rules.map((rule): RuleCoverageEntry => {
    const scenarios = passing.get(rule.number) ?? [];
    const pin = pins.pins[rule.number];
    let status: RuleStatus;
    let note: string | null = null;

    if (scenarios.length > 0) {
      if (pin !== undefined && pin !== rule.fingerprint) {
        status = 'stale';
        stale.push(rule.number);
      } else {
        status = 'covered';
        if (pin === undefined) unpinned.push(rule.number);
      }
    } else {
      if (pin !== undefined) regressions.push(rule.number);
      const question = questions.get(rule.number);
      const reason = notApplicable.get(rule.number);
      if (question !== undefined) {
        status = 'question';
        note = question;
      } else if (reason !== undefined) {
        status = 'not-applicable';
        note = reason;
      } else {
        status = input.exercised.has(rule.number) ? 'exercised' : 'uncovered';
      }
    }

    totals[status] += 1;
    const section = sections.get(sectionOf(rule.number)) ?? emptyTotals();
    section[status] += 1;
    sections.set(sectionOf(rule.number), section);
    return { number: rule.number, status, scenarios, note };
  });

  return {
    rulesVersion: index.version,
    ruleCount: index.ruleCount,
    totals,
    bySection: [...sections].map(([section, sectionTotals]) => ({
      section,
      totals: sectionTotals,
    })),
    problems: {
      failing,
      stale,
      regressions,
      unpinned,
      unknownRules: [...unknownRules].sort(compareRuleNumbers),
    },
    rules,
  };
}

/** True when the report must fail the CI. */
export function hasCoverageProblems(report: RuleCoverageReport): boolean {
  return Object.values(report.problems).some((list) => list.length > 0);
}

/** Pins every covered or stale rule to its current fingerprint, keeping the other pins. */
export function pinCoveredRules(
  report: RuleCoverageReport,
  index: CoreRulesIndex,
  pins: RulePins,
): RulePins {
  const fingerprints = new Map(index.rules.map((rule) => [rule.number, rule.fingerprint]));
  const next: Record<string, string> = { ...pins.pins };
  for (const entry of report.rules) {
    const fingerprint = fingerprints.get(entry.number);
    if ((entry.status === 'covered' || entry.status === 'stale') && fingerprint !== undefined) {
      next[entry.number] = fingerprint;
    }
  }
  const sorted = Object.fromEntries(
    Object.keys(next)
      .sort(compareRuleNumbers)
      .map((number) => [number, next[number] as string]),
  );
  return { rulesVersion: index.version, pins: sorted };
}

/**
 * Open questions of docs/rules/questions.md: each `### Q-NNN` entry whose status is `open`,
 * with the rule numbers of its **Rules** line (text in parentheses ignored).
 * The template inside a code block is skipped.
 */
export function parseOpenQuestions(markdown: string): OpenQuestion[] {
  const withoutCode = markdown.replace(/```[\s\S]*?```/g, '');
  const questions: OpenQuestion[] = [];
  for (const block of withoutCode.split(/^### /m).slice(1)) {
    const id = /^(Q-\d+)/.exec(block)?.[1];
    const status = /\*\*Status\*\*:\s*(\w+)/.exec(block)?.[1];
    const rulesLine = /\*\*Rules\*\*:\s*(.*)/.exec(block)?.[1] ?? '';
    if (id === undefined || status !== 'open') continue;
    const rules = rulesLine.replace(/\([^)]*\)/g, '').match(/\d{3}(?:\.(?:\d+|[a-z]))*/g) ?? [];
    questions.push({ id, rules });
  }
  return questions;
}

/** A short Markdown summary for pull requests. The full list is in the JSON report. */
export function renderCoverageMarkdown(report: RuleCoverageReport): string {
  const percent = (n: number) => `${((n / report.ruleCount) * 100).toFixed(1)}%`;
  const row = (label: string, totals: CoverageTotals) =>
    `| ${label} | ${RULE_STATUSES.map((status) => totals[status]).join(' | ')} |`;
  const lines = [
    `# Rule coverage — ${report.rulesVersion}`,
    '',
    `${report.ruleCount} rules: ${report.totals.covered} covered (${percent(report.totals.covered)}), ${report.totals.exercised} exercised, ${report.totals.uncovered} uncovered.`,
    '',
    `| Section | ${RULE_STATUSES.join(' | ')} |`,
    `| --- | ${RULE_STATUSES.map(() => '---').join(' | ')} |`,
    ...report.bySection.map(({ section, totals }) => row(section, totals)),
    row('**Total**', report.totals),
    '',
    '## Covered rules',
    '',
    report.rules
      .filter((rule) => rule.status === 'covered')
      .map((rule) => `\`${rule.number}\``)
      .join(', ') || '—',
  ];
  const problems = Object.entries(report.problems).filter(([, list]) => list.length > 0);
  if (problems.length > 0) {
    lines.push('', '## Problems', '');
    for (const [kind, list] of problems) lines.push(`- **${kind}**: ${list.join(', ')}`);
  }
  return `${lines.join('\n')}\n`;
}
