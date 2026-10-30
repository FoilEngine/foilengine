// foil rules index: builds docs/rules/index/<version>.json from the Core Rules PDF.
// See docs/rules/README.md and docs/06-testing.md.

import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { type CoreRulesIndex, indexCoreRules } from '@foilengine/testkit';
import { REPO_ROOT } from '../paths.ts';
import { extractPdfText } from '../pdf.ts';

export const RULES_DIR = join(REPO_ROOT, 'docs', 'rules');
export const INDEX_DIR = join(RULES_DIR, 'index');

const CORE_RULES_FILE = /^core-rules-(\d{4}-\d{2}-\d{2})\.pdf$/;

export interface RulesIndexOptions {
  /** PDF to index. Defaults to the most recent `docs/rules/core-rules-<date>.pdf`. */
  readonly pdf?: string;
  /** Compare with the committed index instead of writing it. */
  readonly check?: boolean;
}

export type RulesIndexResult =
  | {
      readonly ok: true;
      readonly index: CoreRulesIndex;
      readonly path: string;
      readonly written: boolean;
    }
  | { readonly ok: false; readonly reason: string };

/** Finds the most recent Core Rules PDF in docs/rules/ (dates sort as strings). */
export async function latestCoreRulesPdf(): Promise<string | undefined> {
  const files = (await readdir(RULES_DIR)).filter((file) => CORE_RULES_FILE.test(file)).sort();
  const latest = files.at(-1);
  return latest === undefined ? undefined : join(RULES_DIR, latest);
}

/** Serializes an index exactly as it is committed. */
export function serializeIndex(index: CoreRulesIndex): string {
  return `${JSON.stringify(index, null, 2)}\n`;
}

export async function buildRulesIndex(pdfPath: string): Promise<CoreRulesIndex> {
  const index = indexCoreRules(await extractPdfText(pdfPath));
  const fileDate = CORE_RULES_FILE.exec(basename(pdfPath))?.[1];
  if (fileDate !== undefined && `CR-${fileDate}` !== index.version) {
    throw new Error(
      `${basename(pdfPath)} says "Last Updated: ${index.lastUpdated}": rename the file core-rules-${index.lastUpdated}.pdf`,
    );
  }
  return index;
}

export async function runRulesIndex(options: RulesIndexOptions = {}): Promise<RulesIndexResult> {
  const pdf = options.pdf ?? (await latestCoreRulesPdf());
  if (pdf === undefined) {
    return { ok: false, reason: `No core-rules-<date>.pdf found in ${RULES_DIR}` };
  }

  const index = await buildRulesIndex(pdf);
  const path = join(INDEX_DIR, `${index.version}.json`);
  const content = serializeIndex(index);

  if (options.check === true) {
    const committed = await readFile(path, 'utf8').catch(() => undefined);
    if (committed !== content) {
      return {
        ok: false,
        reason: `${path} is missing or out of date: run \`pnpm foil rules index\``,
      };
    }
    return { ok: true, index, path, written: false };
  }

  await mkdir(INDEX_DIR, { recursive: true });
  await writeFile(path, content);
  return { ok: true, index, path, written: true };
}
