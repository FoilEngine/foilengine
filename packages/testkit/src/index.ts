export {
  TEST_CARD_DEFINITIONS,
  TEST_CARDS,
  testDeck,
  testDeckVariant,
  testSetup,
} from './cards/test-cards.ts';
export { exercisedRules } from './coverage/exercised.ts';
export {
  type CoverageInput,
  type CoverageProblems,
  type CoverageTotals,
  DEFERRAL_MILESTONES,
  type DeferralMilestone,
  type DeferredRule,
  hasCoverageProblems,
  type NotApplicableRule,
  type OpenQuestion,
  parseOpenQuestions,
  pinCoveredRules,
  RULE_STATUSES,
  type RuleCoverageEntry,
  type RuleCoverageReport,
  type RulePins,
  type RuleStatus,
  renderCoverageMarkdown,
  ruleCoverage,
  rulesOfTest,
  type ScenarioResult,
  sectionOf,
} from './coverage/rule-coverage.ts';
export {
  FUZZ_POLICIES,
  type FuzzCase,
  type FuzzGameOptions,
  type FuzzGameResult,
  type FuzzOptions,
  type FuzzPolicy,
  type FuzzReport,
  type FuzzViolation,
  fuzz,
  fuzzCaseArbitrary,
  playFuzzGame,
  reproductionFiles,
} from './fuzz/fuzz.ts';
export { type FuzzStep, INVARIANTS, type Invariant, MAX_ACTIONS } from './fuzz/invariants.ts';
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
