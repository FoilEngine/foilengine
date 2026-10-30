export { TEST_CARD_DEFINITIONS, TEST_CARDS, testDeck, testSetup } from './cards/test-cards.ts';
export {
  CORE_RULES_INDEX_FORMAT,
  type CoreRule,
  type CoreRulesIndex,
  CoreRulesParseError,
  compareRuleNumbers,
  fingerprint,
  indexCoreRules,
  normalizeText,
  parentOf,
} from './rules-index/index-core-rules.ts';
