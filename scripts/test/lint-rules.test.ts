// Proves that the Biome rules in biome.json enforce the architecture rules
// (docs/01-architecture.md, ADR 0003, ADR 0017). Each snippet is linted at a given
// path inside a temporary copy of the workspace manifests and biome.json.

import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadWorkspace } from '../lib/workspace.ts';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const biomeBin = join(repoRoot, 'node_modules', '.bin', 'biome');

let sandbox = '';

beforeAll(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'foil-lint-'));
  copyFileSync(join(repoRoot, 'biome.json'), join(sandbox, 'biome.json'));
  copyFileSync(join(repoRoot, 'package.json'), join(sandbox, 'package.json'));
  for (const { dir, manifest } of loadWorkspace(repoRoot)) {
    // rules declares types, as it will once it has code.
    const patched =
      manifest.name === '@foilengine/rules'
        ? { ...manifest, dependencies: { '@foilengine/types': 'workspace:*' } }
        : manifest;
    mkdirSync(join(sandbox, dir), { recursive: true });
    writeFileSync(join(sandbox, dir, 'package.json'), JSON.stringify(patched));
  }
});

afterAll(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

interface BiomeReport {
  readonly diagnostics: readonly { readonly category: string; readonly description?: string }[];
}

/** Lints `code` as if it lived at `path` and returns the rule names that fired. */
function lintAs(path: string, code: string): string[] {
  const file = join(sandbox, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, code);
  const result = spawnSync(
    biomeBin,
    ['lint', '--vcs-enabled=false', '--colors=off', '--reporter=json', path],
    { cwd: sandbox, encoding: 'utf8' },
  );
  rmSync(file);
  const report = JSON.parse(result.stdout) as BiomeReport;
  return report.diagnostics
    .map((diagnostic) => diagnostic.category.split('/').at(-1) ?? '')
    .filter((rule) => rule !== '');
}

describe('packages/rules/src is pure (ADR 0003)', () => {
  const at = 'packages/rules/src/sample.ts';

  it('allows @foilengine/types, relative imports and pure Math', () => {
    const code = [
      "import type { A } from '@foilengine/types';",
      "import { b } from './b.ts';",
      'export const c = (a: A) => [a, b, Math.floor(1.5)];',
      '',
    ].join('\n');
    expect(lintAs(at, code)).toEqual([]);
  });

  it('forbids Math.random', () => {
    expect(lintAs(at, 'export const r = Math.random();\n')).toContain('noJsRestrictedProperties');
  });

  it.each([
    'Date.now()',
    'performance.now()',
    'console.log(1)',
    'process.exit()',
    'setTimeout(() => 1)',
    'globalThis.x',
  ])('forbids %s', (expression) => {
    expect(lintAs(at, `export const x = () => ${expression};\n`)).toContain('noRestrictedGlobals');
  });

  it.each(['node:fs', 'fs', 'fast-check', 'immer', '@foilengine/cards', '@foilengine/testkit'])(
    'forbids importing %s',
    (module) => {
      expect(lintAs(at, `import x from '${module}';\nexport const y = x;\n`)).toContain(
        'noRestrictedImports',
      );
    },
  );

  it('does not restrict the test folder', () => {
    const code = "import { it } from 'vitest';\nit('works', () => {});\n";
    expect(lintAs('packages/rules/test/sample.test.ts', code)).toEqual([]);
  });
});

describe('packages/types/src depends on nothing', () => {
  it('forbids any package import', () => {
    expect(
      lintAs('packages/types/src/sample.ts', "import { z } from 'zod';\nexport const y = z;\n"),
    ).toContain('noRestrictedImports');
  });

  it('allows relative imports', () => {
    expect(lintAs('packages/types/src/sample.ts', "export type { A } from './a.ts';\n")).toEqual(
      [],
    );
  });
});

describe('packages/cards/src only uses the effect API of rules', () => {
  const at = 'packages/cards/src/sample.ts';

  it('allows @foilengine/rules/effects', () => {
    expect(
      lintAs(at, "import { a } from '@foilengine/rules/effects';\nexport const b = a;\n"),
    ).not.toContain('noRestrictedImports');
  });

  it.each(['@foilengine/rules', '@foilengine/rules/internal/zones'])('forbids %s', (module) => {
    expect(lintAs(at, `import { a } from '${module}';\nexport const b = a;\n`)).toContain(
      'noRestrictedImports',
    );
  });
});

describe('apps/play only runs the engine in the offline worker', () => {
  it.each(['@foilengine/rules', '@foilengine/cards', '@foilengine/mind'])(
    'forbids %s outside src/offline/',
    (module) => {
      expect(
        lintAs('apps/play/src/table.ts', `import { a } from '${module}';\nexport const b = a;\n`),
      ).toContain('noRestrictedImports');
    },
  );

  it('allows them inside src/offline/', () => {
    expect(
      lintAs(
        'apps/play/src/offline/worker.ts',
        "import { a } from '@foilengine/rules';\nexport const b = a;\n",
      ),
    ).not.toContain('noRestrictedImports');
  });
});

describe('console is only allowed in scripts/ and apps/cli', () => {
  it.each([
    'packages/telemetry/src/log.ts',
    'apps/server/src/main.ts',
    'packages/rules/test/x.test.ts',
  ])('forbids console in %s', (path) => {
    expect(lintAs(path, 'console.log(1);\n')).toContain('noConsole');
  });

  it.each(['scripts/tool.ts', 'apps/cli/src/main.ts'])('allows console in %s', (path) => {
    expect(lintAs(path, 'console.log(1);\n')).toEqual([]);
  });
});

describe('production code only imports declared dependencies', () => {
  it('flags an undeclared package in src/', () => {
    expect(
      lintAs('packages/codex/src/sync.ts', "import { z } from 'zod';\nexport const y = z;\n"),
    ).toContain('noUndeclaredDependencies');
  });
});

// Guard: the sandbox must use the real configuration, not a stale one.
it('lints with the repository biome.json', () => {
  expect(readFileSync(join(sandbox, 'biome.json'), 'utf8')).toBe(
    readFileSync(join(repoRoot, 'biome.json'), 'utf8'),
  );
});
