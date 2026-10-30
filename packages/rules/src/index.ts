// @foilengine/rules: the rules engine. Pure and deterministic (ADR 0003).

export { apply, isLegal, legalActions, pendingDecision } from './engine.ts';
export { EngineInvariantError, IllegalActionError } from './errors.ts';
export {
  createRng,
  type Drawn,
  nextInt,
  nextUint32,
  RNG_ALGORITHM,
  rngFromWords,
  shuffle,
} from './rng/xoshiro128.ts';
export { type CreateGameResult, createGame, OPENING_HAND_SIZE } from './setup/create-game.ts';
export { MULLIGAN_MAX } from './setup/mulligan.ts';
export { SUPPORTED_MODES } from './setup/validate-setup.ts';
export { RULES_VERSION } from './version.ts';
