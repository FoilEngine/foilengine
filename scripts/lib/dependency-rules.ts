// Allowed dependencies between workspace packages.
// Source of truth: docs/01-architecture.md ("Règles de dépendance") and ADR 0017.
// Changing this matrix is an architecture change: update the doc in the same PR.

export type WorkspaceKind = 'package' | 'app';

export interface WorkspaceRule {
  readonly kind: WorkspaceKind;
  /** Workspace packages this one may depend on. */
  readonly internal: readonly string[];
  /** Whether third-party dependencies are allowed. `false` means any new one needs an ADR. */
  readonly external: boolean;
}

const pkg = (name: string): string => `@foilengine/${name}`;

const ALL_PACKAGES = [
  'types',
  'rules',
  'cards',
  'codex',
  'protocol',
  'log',
  'mind',
  'sim',
  'testkit',
  'telemetry',
  'db',
  'ui',
].map(pkg);

const without = (list: readonly string[], ...excluded: string[]): string[] =>
  list.filter((name) => !excluded.map(pkg).includes(name));

export const DEPENDENCY_RULES: Readonly<Record<string, WorkspaceRule>> = {
  [pkg('types')]: { kind: 'package', internal: [], external: false },
  [pkg('rules')]: { kind: 'package', internal: [pkg('types')], external: false },
  [pkg('cards')]: { kind: 'package', internal: [pkg('types'), pkg('rules')], external: true },
  [pkg('codex')]: { kind: 'package', internal: [pkg('types')], external: true },
  [pkg('protocol')]: { kind: 'package', internal: [pkg('types')], external: true },
  [pkg('log')]: { kind: 'package', internal: [pkg('types'), pkg('rules')], external: true },
  [pkg('mind')]: {
    kind: 'package',
    internal: [pkg('types'), pkg('rules'), pkg('cards')],
    external: true,
  },
  [pkg('sim')]: {
    kind: 'package',
    internal: [pkg('types'), pkg('rules'), pkg('cards'), pkg('mind'), pkg('log')],
    external: true,
  },
  [pkg('testkit')]: {
    kind: 'package',
    internal: [pkg('types'), pkg('rules'), pkg('cards'), pkg('log')],
    external: true,
  },
  [pkg('spec')]: {
    kind: 'package',
    internal: [pkg('types'), pkg('rules'), pkg('cards'), pkg('testkit')],
    external: true,
  },
  [pkg('telemetry')]: { kind: 'package', internal: [], external: true },
  [pkg('db')]: { kind: 'package', internal: [pkg('types')], external: true },
  [pkg('ui')]: { kind: 'package', internal: [], external: true },

  [pkg('server')]: {
    kind: 'app',
    internal: without(ALL_PACKAGES, 'ui', 'testkit'),
    external: true,
  },
  // rules, cards and mind are only for the offline Web Worker (apps/play/src/offline/), enforced by Biome.
  [pkg('play')]: {
    kind: 'app',
    internal: [pkg('ui'), pkg('protocol'), pkg('types'), pkg('rules'), pkg('cards'), pkg('mind')],
    external: true,
  },
  [pkg('console')]: {
    kind: 'app',
    internal: [pkg('ui'), pkg('protocol'), pkg('types'), pkg('log')],
    external: true,
  },
  [pkg('site')]: { kind: 'app', internal: [pkg('ui')], external: true },
  [pkg('cli')]: { kind: 'app', internal: ALL_PACKAGES, external: true },
};
