// Builds the index of the Core Rules from the text extracted from the PDF.
// See docs/06-testing.md (rule coverage) and docs/rules/README.md.

import { createHash } from 'node:crypto';

/** Bump when the shape of the index file changes. */
export const CORE_RULES_INDEX_FORMAT = 1;

export interface CoreRule {
  /** Exact number as printed, without the trailing dot: `103`, `103.2`, `103.2.b`, `103.2.b.1`. */
  readonly number: string;
  /** Number of the enclosing rule, or `null` for a top-level rule. */
  readonly parent: string | null;
  /** Full text, continuation lines and examples included, whitespace collapsed. */
  readonly text: string;
  /** Short SHA-256 of `text`, used to detect rules whose text changed between versions. */
  readonly fingerprint: string;
}

export interface CoreRulesIndex {
  readonly format: typeof CORE_RULES_INDEX_FORMAT;
  /** Version identifier, `CR-<last updated date>` (docs/rules/README.md). */
  readonly version: string;
  readonly lastUpdated: string;
  readonly ruleCount: number;
  readonly rules: readonly CoreRule[];
}

export class CoreRulesParseError extends Error {
  override readonly name = 'CoreRulesParseError';
}

// A rule line starts with its number followed by a dot: "103. ", "103.2.b.1. ".
const RULE_LINE = /^(\d{3}(?:\.(?:\d+|[a-z]))*)\.\s+(.*)$/;
const LAST_UPDATED = /Last Updated:\s*(\d{4}-\d{2}-\d{2})/;

/**
 * Parses the plain text of the Core Rules PDF into an index.
 * Throws a `CoreRulesParseError` when the text does not look like a valid extraction
 * (no "Last Updated" date, rule numbers out of order, sub-rule without its parent).
 */
export function indexCoreRules(text: string): CoreRulesIndex {
  const lastUpdated = LAST_UPDATED.exec(text)?.[1];
  if (lastUpdated === undefined) {
    throw new CoreRulesParseError(
      'No "Last Updated: YYYY-MM-DD" line found in the Core Rules text',
    );
  }

  const drafts: { number: string; lines: string[] }[] = [];
  for (const line of text.split(/\r?\n/)) {
    const match = RULE_LINE.exec(line);
    if (match?.[1] !== undefined) {
      drafts.push({ number: match[1], lines: [match[2] ?? ''] });
    } else if (drafts.length > 0) {
      drafts.at(-1)?.lines.push(line);
    }
    // Lines before the first rule (title, date) are ignored.
  }
  if (drafts.length === 0) {
    throw new CoreRulesParseError('No rule found in the Core Rules text');
  }

  const seen = new Set<string>();
  const rules: CoreRule[] = [];
  let previous: string | undefined;
  for (const { number, lines } of drafts) {
    if (previous !== undefined && compareRuleNumbers(previous, number) >= 0) {
      throw new CoreRulesParseError(
        `Rule ${number} comes after ${previous}: numbers must increase`,
      );
    }
    const parent = parentOf(number);
    if (parent !== null && !seen.has(parent)) {
      throw new CoreRulesParseError(`Rule ${number} has no parent rule ${parent}`);
    }
    const ruleText = normalizeText(lines.join(' '));
    rules.push({ number, parent, text: ruleText, fingerprint: fingerprint(ruleText) });
    seen.add(number);
    previous = number;
  }

  return {
    format: CORE_RULES_INDEX_FORMAT,
    version: `CR-${lastUpdated}`,
    lastUpdated,
    ruleCount: rules.length,
    rules,
  };
}

/** `103.2.b.1` → `103.2.b`; `103` → `null`. */
export function parentOf(number: string): string | null {
  const cut = number.lastIndexOf('.');
  return cut === -1 ? null : number.slice(0, cut);
}

/** Orders rule numbers part by part: numbers numerically, letters alphabetically. */
export function compareRuleNumbers(a: string, b: string): number {
  const left = a.split('.');
  const right = b.split('.');
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const x = left[i];
    const y = right[i];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    if (x === y) continue;
    const bothNumeric = /^\d+$/.test(x) && /^\d+$/.test(y);
    return bothNumeric ? Number(x) - Number(y) : x < y ? -1 : 1;
  }
  return 0;
}

/** Collapses whitespace so that line wrapping in the PDF does not change the text. */
export function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** First 16 hex characters of the SHA-256 of the normalized text. */
export function fingerprint(text: string): string {
  return createHash('sha256').update(normalizeText(text), 'utf8').digest('hex').slice(0, 16);
}
