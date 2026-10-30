import type { WorkspaceKind, WorkspaceRule } from './dependency-rules.ts';

const DEPENDENCY_FIELDS = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
] as const;

type DependencyField = (typeof DEPENDENCY_FIELDS)[number];

export interface Manifest {
  readonly name?: string;
  readonly private?: boolean;
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly devDependencies?: Readonly<Record<string, string>>;
  readonly peerDependencies?: Readonly<Record<string, string>>;
  readonly optionalDependencies?: Readonly<Record<string, string>>;
}

export interface WorkspaceEntry {
  /** Directory relative to the repository root, e.g. `packages/rules`. */
  readonly dir: string;
  readonly kind: WorkspaceKind;
  readonly manifest: Manifest;
}

export interface Violation {
  readonly dir: string;
  readonly message: string;
}

/** Checks every workspace manifest against the dependency rules. Returns no violation when all is well. */
export function checkWorkspace(
  entries: readonly WorkspaceEntry[],
  rules: Readonly<Record<string, WorkspaceRule>>,
): Violation[] {
  const violations: Violation[] = [];
  const report = (dir: string, message: string): void => {
    violations.push({ dir, message });
  };

  const byName = new Map<string, WorkspaceEntry>();
  for (const entry of entries) {
    const name = entry.manifest.name;
    if (name === undefined) {
      report(entry.dir, 'package.json has no "name"');
      continue;
    }
    if (byName.has(name)) {
      report(entry.dir, `duplicate package name ${name}`);
    }
    byName.set(name, entry);
  }

  for (const entry of entries) {
    const name = entry.manifest.name;
    if (name === undefined) continue;

    const expectedName = `@foilengine/${entry.dir.split('/').at(-1) ?? ''}`;
    if (name !== expectedName) {
      report(entry.dir, `package name ${name} should be ${expectedName}`);
    }
    if (entry.manifest.private !== true) {
      report(entry.dir, `${name} must be "private": true (packages stay inside the monorepo)`);
    }

    const rule = rules[name];
    if (rule === undefined) {
      report(
        entry.dir,
        `${name} has no dependency rule: add it to scripts/lib/dependency-rules.ts and docs/01-architecture.md`,
      );
      continue;
    }
    if (rule.kind !== entry.kind) {
      report(entry.dir, `${name} is declared as a ${rule.kind} but lives in ${entry.dir}`);
    }

    for (const field of DEPENDENCY_FIELDS) {
      for (const [dependency, range] of Object.entries(entry.manifest[field] ?? {})) {
        checkDependency(entry, name, rule, field, dependency, range, byName, report);
      }
    }
  }

  for (const name of Object.keys(rules)) {
    if (!byName.has(name)) {
      violations.push({
        dir: '.',
        message: `dependency rule for ${name} matches no workspace package: remove it or create the package`,
      });
    }
  }

  return violations;
}

function checkDependency(
  entry: WorkspaceEntry,
  name: string,
  rule: WorkspaceRule,
  field: DependencyField,
  dependency: string,
  range: string,
  byName: ReadonlyMap<string, WorkspaceEntry>,
  report: (dir: string, message: string) => void,
): void {
  const target = byName.get(dependency);

  if (target === undefined) {
    if (dependency.startsWith('@foilengine/')) {
      report(entry.dir, `${name} depends on ${dependency}, which is not a workspace package`);
    } else if (!rule.external) {
      report(
        entry.dir,
        `${name} must not depend on third-party package ${dependency} (${field}): this needs an ADR`,
      );
    }
    return;
  }

  if (target.kind === 'app') {
    report(entry.dir, `${name} depends on app ${dependency}: nothing may depend on an app`);
    return;
  }
  if (!rule.internal.includes(dependency)) {
    report(
      entry.dir,
      `${name} is not allowed to depend on ${dependency} (${field}), see docs/01-architecture.md`,
    );
  }
  if (!range.startsWith('workspace:')) {
    report(entry.dir, `${name} must use the workspace: protocol for ${dependency}`);
  }
}

/** Returns a dependency cycle in the rules, or `undefined` when the graph is acyclic. */
export function findCycle(rules: Readonly<Record<string, WorkspaceRule>>): string[] | undefined {
  const done = new Set<string>();
  const path: string[] = [];

  const visit = (name: string): string[] | undefined => {
    const index = path.indexOf(name);
    if (index !== -1) return [...path.slice(index), name];
    if (done.has(name)) return undefined;
    path.push(name);
    for (const dependency of rules[name]?.internal ?? []) {
      const cycle = visit(dependency);
      if (cycle !== undefined) return cycle;
    }
    path.pop();
    done.add(name);
    return undefined;
  };

  for (const name of Object.keys(rules)) {
    const cycle = visit(name);
    if (cycle !== undefined) return cycle;
  }
  return undefined;
}
