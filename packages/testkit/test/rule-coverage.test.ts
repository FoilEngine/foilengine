import { describe, expect, it } from 'vitest';
import {
  type CoverageInput,
  fingerprint,
  hasCoverageProblems,
  indexCoreRules,
  parseOpenQuestions,
  pinCoveredRules,
  renderCoverageMarkdown,
  ruleCoverage,
  rulesOfTest,
} from '../src/index.ts';

const index = indexCoreRules(
  [
    'Last Updated: 2026-10-09',
    '110. Setup Process',
    '111. Each player separates their Champion Legend.',
    '112. Each player separates their Chosen Champion.',
    '113. Each player sets aside their Battlefields.',
    '114. Each player shuffles their decks.',
    '115. Determine Turn Order.',
    '301. The Turn',
  ].join('\n'),
);
const fp = (number: string) =>
  index.rules.find((rule) => rule.number === number)?.fingerprint as string;

const input = (overrides: Partial<CoverageInput> = {}): CoverageInput => ({
  index,
  scenarios: [],
  exercised: new Set(),
  notApplicable: [],
  openQuestions: [],
  pins: { rulesVersion: index.version, pins: {} },
  ...overrides,
});
const statusOf = (report: ReturnType<typeof ruleCoverage>, number: string) =>
  report.rules.find((rule) => rule.number === number)?.status;

describe('ruleCoverage', () => {
  it('lists every rule of the index, uncovered by default', () => {
    const report = ruleCoverage(input());
    expect(report.rules.map((rule) => rule.number)).toEqual(index.rules.map((rule) => rule.number));
    expect(report.totals.uncovered).toBe(7);
    expect(report.ruleCount).toBe(7);
  });

  it('covered: at least one passing scenario dedicated to the rule', () => {
    const report = ruleCoverage(
      input({
        scenarios: [{ title: 'rule 111: legend', rules: ['111'], passed: true }],
        pins: { rulesVersion: index.version, pins: { '111': fp('111') } },
      }),
    );
    expect(statusOf(report, '111')).toBe('covered');
    expect(report.rules.find((rule) => rule.number === '111')?.scenarios).toEqual([
      'rule 111: legend',
    ]);
    expect(hasCoverageProblems(report)).toBe(false);
  });

  it('a failing scenario does not cover its rule and is reported', () => {
    const report = ruleCoverage(
      input({ scenarios: [{ title: 'rule 111: legend', rules: ['111'], passed: false }] }),
    );
    expect(statusOf(report, '111')).toBe('uncovered');
    expect(report.problems.failing).toEqual(['rule 111: legend']);
  });

  it('every declared rule of a scenario is covered, not only the first', () => {
    const report = ruleCoverage(
      input({ scenarios: [{ title: 'rule 111: both', rules: ['111', '112'], passed: true }] }),
    );
    expect(statusOf(report, '112')).toBe('covered');
  });

  it('a covered rule that is not pinned yet is a problem', () => {
    const report = ruleCoverage(
      input({ scenarios: [{ title: 'rule 111: legend', rules: ['111'], passed: true }] }),
    );
    expect(report.problems.unpinned).toEqual(['111']);
    expect(hasCoverageProblems(report)).toBe(true);
  });

  it('stale: the rule text changed since it was pinned', () => {
    const report = ruleCoverage(
      input({
        scenarios: [{ title: 'rule 111: legend', rules: ['111'], passed: true }],
        pins: { rulesVersion: 'CR-older', pins: { '111': fingerprint('Older text of 111') } },
      }),
    );
    expect(statusOf(report, '111')).toBe('stale');
    expect(report.problems.stale).toEqual(['111']);
  });

  it('a pinned rule that is no longer covered is a regression', () => {
    const report = ruleCoverage(
      input({ pins: { rulesVersion: index.version, pins: { '111': fp('111') } } }),
    );
    expect(statusOf(report, '111')).toBe('uncovered');
    expect(report.problems.regressions).toEqual(['111']);
  });

  it('question, not-applicable and exercised apply in this order to uncovered rules', () => {
    const report = ruleCoverage(
      input({
        openQuestions: [{ id: 'Q-002', rules: ['113'] }],
        notApplicable: [
          { number: '113', reason: 'heading' },
          { number: '110', reason: 'heading' },
        ],
        exercised: new Set(['110', '114']),
      }),
    );
    expect(report.rules.find((rule) => rule.number === '113')).toMatchObject({
      status: 'question',
      note: 'Q-002',
    });
    expect(report.rules.find((rule) => rule.number === '110')).toMatchObject({
      status: 'not-applicable',
      note: 'heading',
    });
    expect(statusOf(report, '114')).toBe('exercised');
  });

  it('reports rule numbers that do not exist in this version', () => {
    const report = ruleCoverage(
      input({
        scenarios: [{ title: 'rule 999: nothing', rules: ['999'], passed: true }],
        pins: { rulesVersion: index.version, pins: { '998': 'abc' } },
      }),
    );
    expect(report.problems.unknownRules).toEqual(['998', '999']);
  });

  it('counts per section', () => {
    const report = ruleCoverage(input({ exercised: new Set(['301']) }));
    expect(
      report.bySection.map((s) => [s.section, s.totals.uncovered, s.totals.exercised]),
    ).toEqual([
      ['100', 6, 0],
      ['300', 0, 1],
    ]);
  });
});

describe('pinCoveredRules', () => {
  it('pins covered rules to their current fingerprint and keeps other pins', () => {
    const report = ruleCoverage(
      input({ scenarios: [{ title: 'rule 112: champion', rules: ['112'], passed: true }] }),
    );
    const pins = pinCoveredRules(report, index, {
      rulesVersion: 'CR-older',
      pins: { '115': 'old' },
    });
    expect(pins).toEqual({
      rulesVersion: 'CR-2026-10-09',
      pins: { '112': fp('112'), '115': 'old' },
    });
  });
});

describe('rulesOfTest', () => {
  it('uses the declared rules, or the rule the title starts with', () => {
    expect(rulesOfTest('rule 117.2: draws', ['117.2', '414'])).toEqual(['117.2', '414']);
    expect(rulesOfTest('rule 117.2: draws', undefined)).toEqual(['117.2']);
    expect(rulesOfTest('determinism', undefined)).toEqual([]);
    expect(rulesOfTest('card ogn-001: deals 2', undefined)).toEqual([]);
  });
});

describe('parseOpenQuestions', () => {
  it('keeps open questions, skips resolved ones and the template', () => {
    const markdown = [
      '## Template',
      '```markdown',
      '### Q-NNN — Short title',
      '- **Rules**: 431.4.a, 115',
      '- **Status**: open | resolved',
      '```',
      '### Q-001 — Resolved',
      '- **Rules**: 115.2, 487.7 (first quoted as 315.3)',
      '- **Status**: resolved (2026-10-30)',
      '### Q-002 — Open',
      '- **Rules**: 323.5, 323.6.a (not 999)',
      '- **Status**: open',
    ].join('\n');
    expect(parseOpenQuestions(markdown)).toEqual([{ id: 'Q-002', rules: ['323.5', '323.6.a'] }]);
  });
});

describe('renderCoverageMarkdown', () => {
  it('summarizes per section and lists the problems', () => {
    const report = ruleCoverage(
      input({ scenarios: [{ title: 'rule 111: legend', rules: ['111'], passed: true }] }),
    );
    const markdown = renderCoverageMarkdown(report);
    expect(markdown).toContain('# Rule coverage — CR-2026-10-09');
    expect(markdown).toContain('| 100 | 1 | 0 | 0 | 0 | 0 | 5 |');
    expect(markdown).toContain('- **unpinned**: 111');
  });
});
