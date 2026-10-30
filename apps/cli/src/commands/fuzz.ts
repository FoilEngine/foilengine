// `foil fuzz`: random games with invariant checks (docs/06-testing.md). A violation is shrunk,
// and its reproduction files are written to packages/testkit/repros/.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type FuzzReport, fuzz, reproductionFiles } from '@foilengine/testkit';
import { REPO_ROOT } from '../paths.ts';

export const REPROS_DIR = join(REPO_ROOT, 'packages', 'testkit', 'repros');

export type FuzzCommandResult = FuzzReport & {
  /** Paths of the reproduction files written, relative to the repository root. */
  readonly files: readonly string[];
  readonly milliseconds: number;
};

export function runFuzz(options: {
  games: number;
  seed: number;
  onProgress?: (games: number) => void;
  reproDir?: string;
}): FuzzCommandResult {
  const start = performance.now();
  let played = 0;
  const report = fuzz({
    games: options.games,
    seed: options.seed,
    onGame: () => {
      played += 1;
      options.onProgress?.(played);
    },
  });
  const files: string[] = [];
  if (report.violation !== null) {
    const dir = options.reproDir ?? REPROS_DIR;
    mkdirSync(dir, { recursive: true });
    for (const [name, content] of Object.entries(
      reproductionFiles(report.violation, report.seed),
    )) {
      writeFileSync(join(dir, name), content);
      files.push(join(dir, name));
    }
  }
  return { ...report, files, milliseconds: performance.now() - start };
}
