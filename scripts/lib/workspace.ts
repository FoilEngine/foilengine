import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Manifest, WorkspaceEntry } from './dependency-check.ts';

const WORKSPACE_ROOTS = [
  { dir: 'packages', kind: 'package' },
  { dir: 'apps', kind: 'app' },
] as const;

/** Reads the package.json of every package in packages/ and apps/ (see pnpm-workspace.yaml). */
export function loadWorkspace(repoRoot: string): WorkspaceEntry[] {
  const entries: WorkspaceEntry[] = [];
  for (const { dir, kind } of WORKSPACE_ROOTS) {
    const root = join(repoRoot, dir);
    for (const child of readdirSync(root, { withFileTypes: true })) {
      if (!child.isDirectory()) continue;
      const manifestPath = join(root, child.name, 'package.json');
      if (!existsSync(manifestPath)) continue;
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Manifest;
      entries.push({ dir: `${dir}/${child.name}`, kind, manifest });
    }
  }
  return entries.sort((a, b) => a.dir.localeCompare(b.dir));
}
