// Access to the committed Core Rules index (docs/rules/index/<version>.json),
// so that scenarios can only quote rules that exist in the version the engine implements.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { RULES_VERSION } from '@foilengine/rules';
import type { CoreRulesIndex } from '../rules-index/index-core-rules.ts';

const INDEX_DIR = fileURLToPath(new URL('../../../../docs/rules/index/', import.meta.url));

let cached: { index: CoreRulesIndex; numbers: ReadonlySet<string> } | undefined;

/** The index of the Core Rules version implemented by the engine. */
export function currentCoreRules(): { index: CoreRulesIndex; numbers: ReadonlySet<string> } {
  if (cached === undefined) {
    const index = JSON.parse(
      readFileSync(`${INDEX_DIR}${RULES_VERSION}.json`, 'utf8'),
    ) as CoreRulesIndex;
    cached = { index, numbers: new Set(index.rules.map((rule) => rule.number)) };
  }
  return cached;
}

export function ruleExists(number: string): boolean {
  return currentCoreRules().numbers.has(number);
}
