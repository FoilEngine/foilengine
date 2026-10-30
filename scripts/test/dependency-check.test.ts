import { fileURLToPath } from 'node:url';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  checkWorkspace,
  findCycle,
  type Manifest,
  type WorkspaceEntry,
} from '../lib/dependency-check.ts';
import { DEPENDENCY_RULES, type WorkspaceRule } from '../lib/dependency-rules.ts';
import { loadWorkspace } from '../lib/workspace.ts';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));

/** A workspace matching the rules exactly, with no dependency declared. */
function baseWorkspace(): WorkspaceEntry[] {
  return Object.entries(DEPENDENCY_RULES).map(([name, rule]) => ({
    dir: `${rule.kind === 'app' ? 'apps' : 'packages'}/${name.replace('@foilengine/', '')}`,
    kind: rule.kind,
    manifest: { name, private: true },
  }));
}

function withManifest(name: string, patch: Partial<Manifest>): WorkspaceEntry[] {
  return baseWorkspace().map((entry) =>
    entry.manifest.name === name ? { ...entry, manifest: { ...entry.manifest, ...patch } } : entry,
  );
}

const messages = (entries: readonly WorkspaceEntry[]): string[] =>
  checkWorkspace(entries, DEPENDENCY_RULES).map((violation) => violation.message);

describe('dependency rules', () => {
  it('the real workspace follows them', () => {
    expect(checkWorkspace(loadWorkspace(repoRoot), DEPENDENCY_RULES)).toEqual([]);
  });

  it('are acyclic', () => {
    expect(findCycle(DEPENDENCY_RULES)).toBeUndefined();
  });

  it('detect a cycle', () => {
    const rules: Record<string, WorkspaceRule> = {
      a: { kind: 'package', internal: ['b'], external: true },
      b: { kind: 'package', internal: ['c'], external: true },
      c: { kind: 'package', internal: ['a'], external: true },
    };
    expect(findCycle(rules)).toEqual(['a', 'b', 'c', 'a']);
  });

  it('let nothing depend on an app', () => {
    for (const rule of Object.values(DEPENDENCY_RULES)) {
      for (const dependency of rule.internal) {
        expect(DEPENDENCY_RULES[dependency]?.kind).toBe('package');
      }
    }
  });

  it('let nothing depend on @foilengine/spec', () => {
    for (const rule of Object.values(DEPENDENCY_RULES)) {
      expect(rule.internal).not.toContain('@foilengine/spec');
    }
  });

  it('keep @foilengine/types and @foilengine/rules free of third-party dependencies', () => {
    expect(DEPENDENCY_RULES['@foilengine/types']).toMatchObject({ internal: [], external: false });
    expect(DEPENDENCY_RULES['@foilengine/rules']).toMatchObject({
      internal: ['@foilengine/types'],
      external: false,
    });
  });
});

describe('checkWorkspace', () => {
  it('accepts any subset of the allowed dependencies', () => {
    const names = Object.keys(DEPENDENCY_RULES);
    fc.assert(
      fc.property(
        fc
          .constantFrom(...names)
          .chain((name) =>
            fc
              .subarray([...(DEPENDENCY_RULES[name]?.internal ?? [])])
              .map((deps) => ({ name, deps })),
          ),
        ({ name, deps }) => {
          const dependencies = Object.fromEntries(deps.map((dep) => [dep, 'workspace:*']));
          expect(messages(withManifest(name, { dependencies }))).toEqual([]);
        },
      ),
    );
  });

  it('rejects any dependency outside the allowed ones', () => {
    const names = Object.keys(DEPENDENCY_RULES);
    const forbiddenPairs = names.flatMap((name) =>
      names
        .filter((dep) => dep !== name && !DEPENDENCY_RULES[name]?.internal.includes(dep))
        .map((dep) => ({ name, dep })),
    );
    fc.assert(
      fc.property(fc.constantFrom(...forbiddenPairs), ({ name, dep }) => {
        const violations = messages(withManifest(name, { dependencies: { [dep]: 'workspace:*' } }));
        expect(violations).toHaveLength(1);
      }),
    );
  });

  it('rejects rules depending on cards', () => {
    expect(
      messages(
        withManifest('@foilengine/rules', { dependencies: { '@foilengine/cards': 'workspace:*' } }),
      ),
    ).toEqual([
      '@foilengine/rules is not allowed to depend on @foilengine/cards (dependencies), see docs/01-architecture.md',
    ]);
  });

  it('checks devDependencies too', () => {
    expect(
      messages(
        withManifest('@foilengine/rules', {
          devDependencies: { '@foilengine/testkit': 'workspace:*' },
        }),
      ),
    ).toHaveLength(1);
  });

  it('rejects a package depending on an app', () => {
    expect(
      messages(
        withManifest('@foilengine/log', { dependencies: { '@foilengine/server': 'workspace:*' } }),
      ),
    ).toEqual(['@foilengine/log depends on app @foilengine/server: nothing may depend on an app']);
  });

  it('rejects testkit in the server and the console', () => {
    for (const app of ['@foilengine/server', '@foilengine/console']) {
      expect(
        messages(withManifest(app, { dependencies: { '@foilengine/testkit': 'workspace:*' } })),
      ).toHaveLength(1);
    }
  });

  it('rejects third-party dependencies in rules and types, including dev ones', () => {
    expect(
      messages(withManifest('@foilengine/rules', { dependencies: { immer: '^10.0.0' } })),
    ).toEqual([
      '@foilengine/rules must not depend on third-party package immer (dependencies): this needs an ADR',
    ]);
    expect(
      messages(withManifest('@foilengine/types', { devDependencies: { vitest: '^5.0.0' } })),
    ).toHaveLength(1);
  });

  it('accepts third-party dependencies elsewhere', () => {
    expect(
      messages(withManifest('@foilengine/protocol', { dependencies: { zod: '^4.0.0' } })),
    ).toEqual([]);
  });

  it('requires the workspace: protocol for internal dependencies', () => {
    expect(
      messages(
        withManifest('@foilengine/rules', { dependencies: { '@foilengine/types': '0.0.0' } }),
      ),
    ).toEqual(['@foilengine/rules must use the workspace: protocol for @foilengine/types']);
  });

  it('rejects unknown @foilengine packages', () => {
    expect(
      messages(
        withManifest('@foilengine/sim', { dependencies: { '@foilengine/ghost': '^1.0.0' } }),
      ),
    ).toEqual(['@foilengine/sim depends on @foilengine/ghost, which is not a workspace package']);
  });

  it('requires a rule for every workspace package', () => {
    const entries = [
      ...baseWorkspace(),
      {
        dir: 'packages/extra',
        kind: 'package' as const,
        manifest: { name: '@foilengine/extra', private: true },
      },
    ];
    expect(messages(entries)).toEqual([
      '@foilengine/extra has no dependency rule: add it to scripts/lib/dependency-rules.ts and docs/01-architecture.md',
    ]);
  });

  it('requires a workspace package for every rule', () => {
    const entries = baseWorkspace().filter((entry) => entry.manifest.name !== '@foilengine/ui');
    expect(messages(entries)).toEqual([
      'dependency rule for @foilengine/ui matches no workspace package: remove it or create the package',
    ]);
  });

  it('requires private packages named after their directory', () => {
    expect(messages(withManifest('@foilengine/log', { private: false }))).toEqual([
      '@foilengine/log must be "private": true (packages stay inside the monorepo)',
    ]);
    const renamed = baseWorkspace().map((entry) =>
      entry.dir === 'packages/log' ? { ...entry, dir: 'packages/journal' } : entry,
    );
    expect(messages(renamed)).toEqual([
      'package name @foilengine/log should be @foilengine/journal',
    ]);
  });

  it('rejects an app placed in packages/', () => {
    const moved = baseWorkspace().map((entry) =>
      entry.manifest.name === '@foilengine/cli' ? { ...entry, kind: 'package' as const } : entry,
    );
    expect(messages(moved)).toEqual(['@foilengine/cli is declared as a app but lives in apps/cli']);
  });
});
