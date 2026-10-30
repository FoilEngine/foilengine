export {
  TEST_CARD_DEFINITIONS,
  TEST_CARDS,
  testDeck,
  testDeckVariant,
  testSetup,
} from './cards/test-cards.ts';
export {
  BoardBuilder,
  BoardError,
  board,
  type CardRef,
  type PlayerLayout,
  resolveCard,
} from './harness/board.ts';
export { currentCoreRules, ruleExists } from './harness/core-rules.ts';
export {
  checkScenarioDefinition,
  type ScenarioContext,
  type ScenarioDefinition,
  scenario,
} from './harness/scenario.ts';
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
