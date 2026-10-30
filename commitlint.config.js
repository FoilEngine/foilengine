// Conventional Commits with the package or app as scope (docs/13-conventions.md).
// Plain JavaScript on purpose: commitlint loads TypeScript configs through the
// TypeScript JS API, which TypeScript 7 no longer ships.

const WORKSPACE_SCOPES = [
  'types',
  'rules',
  'cards',
  'codex',
  'protocol',
  'log',
  'mind',
  'sim',
  'testkit',
  'spec',
  'telemetry',
  'db',
  'ui',
  'server',
  'play',
  'site',
  'console',
  'cli',
];

const REPOSITORY_SCOPES = ['repo', 'ci', 'deps', 'docs'];

export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [2, 'always', [...WORKSPACE_SCOPES, ...REPOSITORY_SCOPES]],
  },
};
