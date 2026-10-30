import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { CoreRulesIndex } from '@foilengine/testkit';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  buildRulesIndex,
  INDEX_DIR,
  latestCoreRulesPdf,
  RULES_DIR,
  serializeIndex,
} from '../src/commands/rules-index.ts';
import { REPO_ROOT } from '../src/paths.ts';

const PDF = join(RULES_DIR, 'core-rules-2026-10-09.pdf');
let index: CoreRulesIndex;

beforeAll(async () => {
  index = await buildRulesIndex(PDF);
}, 60_000);

const rule = (number: string) => index.rules.find((r) => r.number === number);

describe('the Core Rules index of CR-2026-10-09', () => {
  it('is committed and up to date with the PDF', async () => {
    const committed = await readFile(join(INDEX_DIR, 'CR-2026-10-09.json'), 'utf8');
    expect(committed).toBe(serializeIndex(index));
  });

  it('has the version of the PDF', () => {
    expect(index.version).toBe('CR-2026-10-09');
  });

  it('covers the whole document, from 000 to the last keyword', () => {
    expect(index.ruleCount).toBe(2494);
    expect(index.rules[0]?.number).toBe('000');
    expect(index.rules.at(-1)?.number).toBe('832.3');
  });

  it('has every section of the Core Rules', () => {
    const tops = new Set(index.rules.map((r) => r.number.slice(0, 1)));
    expect([...tops].sort()).toEqual(['0', '1', '2', '3', '4', '6', '7', '8']);
  });

  it('reads known rules word for word', () => {
    expect(rule('431.4.a')?.text).toBe(
      'A player Channels two Runes during the Channel Phase on their turn.',
    );
    expect(rule('117')?.text).toBe('In turn order, players perform their Mulligan.');
    expect(rule('124')?.text).toMatch(
      /^A Game Object that changes zones to or from a Non-Board Zone/,
    );
    expect(rule('315.3')?.text).toBe('Channel Phase');
  });

  it('is the index of the most recent PDF in docs/rules/', async () => {
    expect(await latestCoreRulesPdf()).toBe(PDF);
  });
});

describe('foil rules index (command line)', () => {
  const foil = (...args: string[]) =>
    spawnSync(process.execPath, [join(REPO_ROOT, 'apps/cli/src/main.ts'), ...args], {
      encoding: 'utf8',
    });

  it('--check passes on the committed index', () => {
    const result = foil('rules', 'index', '--check', '--json');
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      ok: true,
      version: 'CR-2026-10-09',
      ruleCount: 2494,
      written: false,
    });
  }, 60_000);

  it('fails on an unknown command', () => {
    const result = foil('rules', 'unknown');
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('Unknown command: rules unknown');
  });
});
