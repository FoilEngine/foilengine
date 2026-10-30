// The `foil` command-line tool. Usage: pnpm foil <command> [options]

import { relative } from 'node:path';
import { parseArgs } from 'node:util';
import { runRulesIndex } from './commands/rules-index.ts';
import { REPO_ROOT } from './paths.ts';

const USAGE = `Usage: foil <command> [options]

Commands:
  rules index [--pdf <file>] [--check] [--json]
      Build docs/rules/index/<version>.json from the Core Rules PDF.
      --pdf     PDF to index (default: the most recent docs/rules/core-rules-<date>.pdf)
      --check   Fail if the committed index is missing or out of date, write nothing
      --json    Machine-readable output
`;

async function main(argv: readonly string[]): Promise<number> {
  const { positionals, values } = parseArgs({
    args: [...argv],
    allowPositionals: true,
    options: {
      pdf: { type: 'string' },
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

  console.error(`Unknown command: ${command}\n\n${USAGE}`);
  return 2;
}

process.exitCode = await main(process.argv.slice(2));
