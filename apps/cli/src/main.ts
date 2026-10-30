// The `foil` command-line tool. Usage: pnpm foil <command> [options]

import { relative } from 'node:path';
import { parseArgs } from 'node:util';
import { runRulesCoverage } from './commands/rules-coverage.ts';
import { runRulesIndex } from './commands/rules-index.ts';
import { REPO_ROOT } from './paths.ts';

const USAGE = `Usage: foil <command> [options]

Commands:
  rules index [--pdf <file>] [--check] [--json]
      Build docs/rules/index/<version>.json from the Core Rules PDF.
      --pdf     PDF to index (default: the most recent docs/rules/core-rules-<date>.pdf)
      --check   Fail if the committed index is missing or out of date, write nothing
      --json    Machine-readable output

  rules coverage [--pin] [--json]
      Run the rule scenarios and report the status of every rule (also: pnpm test:rules).
      Writes reports/rule-coverage.json and reports/rule-coverage.md.
      --pin     Pin every covered rule to its current text (packages/spec/rule-pins.json)
      --json    Machine-readable summary
`;

async function main(argv: readonly string[]): Promise<number> {
  const { positionals, values } = parseArgs({
    args: [...argv],
    allowPositionals: true,
    options: {
      pdf: { type: 'string' },
      pin: { type: 'boolean', default: false },
      check: { type: 'boolean', default: false },
      json: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });

  const command = positionals.join(' ');
  if (values.help || command === '') {
    console.log(USAGE);
    return values.help ? 0 : 2;
  }

  if (command === 'rules index') {
    const result = await runRulesIndex({
      check: values.check,
      ...(values.pdf === undefined ? {} : { pdf: values.pdf }),
    });
    if (values.json) {
      console.log(
        JSON.stringify(
          result.ok
            ? {
                ok: true,
                version: result.index.version,
                ruleCount: result.index.ruleCount,
                path: result.path,
                written: result.written,
              }
            : result,
        ),
      );
    } else if (result.ok) {
      const where = relative(REPO_ROOT, result.path);
      const verb = result.written ? 'Wrote' : 'Up to date:';
      console.log(`✓ ${verb} ${where} (${result.index.ruleCount} rules, ${result.index.version})`);
    } else {
      console.error(`✗ ${result.reason}`);
    }
    return result.ok ? 0 : 1;
  }

  if (command === 'rules coverage') {
    const { report, pinsWritten } = await runRulesCoverage({ pin: values.pin });
    const problems = Object.entries(report.problems).filter(([, list]) => list.length > 0);
    if (values.json) {
      console.log(
        JSON.stringify({
          rulesVersion: report.rulesVersion,
          totals: report.totals,
          problems: report.problems,
        }),
      );
    } else {
      const t = report.totals;
      console.log(
        `${report.rulesVersion}: ${report.ruleCount} rules — ${t.covered} covered, ${t.stale} stale, ${t.question} question, ${t['not-applicable']} not-applicable, ${t.exercised} exercised, ${t.uncovered} uncovered`,
      );
      if (pinsWritten) console.log('✓ Pins written to packages/spec/rule-pins.json');
      for (const [kind, list] of problems) console.error(`✗ ${kind}: ${list.join(', ')}`);
      if (report.problems.unpinned.length > 0)
        console.error('  Pin new covered rules with `pnpm test:rules --pin`.');
      if (report.problems.stale.length > 0)
        console.error('  Review the scenarios of stale rules, then re-pin them.');
      console.log('Reports: reports/rule-coverage.json, reports/rule-coverage.md');
    }
    return problems.length === 0 ? 0 : 1;
  }

  console.error(`Unknown command: ${command}\n\n${USAGE}`);
  return 2;
}

process.exitCode = await main(process.argv.slice(2));
