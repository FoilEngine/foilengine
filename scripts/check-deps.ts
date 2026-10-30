// Checks the dependency rules between workspace packages (docs/01-architecture.md).
// Usage: pnpm check:deps

import { fileURLToPath } from 'node:url';
import { checkWorkspace, findCycle } from './lib/dependency-check.ts';
import { DEPENDENCY_RULES } from './lib/dependency-rules.ts';
import { loadWorkspace } from './lib/workspace.ts';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));

const cycle = findCycle(DEPENDENCY_RULES);
if (cycle !== undefined) {
  console.error(`Dependency rules contain a cycle: ${cycle.join(' -> ')}`);
  process.exit(1);
}

const entries = loadWorkspace(repoRoot);
const violations = checkWorkspace(entries, DEPENDENCY_RULES);

if (violations.length > 0) {
  for (const { dir, message } of violations) {
    console.error(`✗ ${dir}: ${message}`);
  }
  console.error(`\n${violations.length} dependency rule violation(s).`);
  process.exit(1);
}

console.log(`✓ ${entries.length} workspace packages follow the dependency rules.`);
