// @foilengine/rules: the rules engine. Pure and deterministic (ADR 0003).

export {
  createRng,
  type Drawn,
  nextInt,
  nextUint32,
  RNG_ALGORITHM,
  rngFromWords,
  shuffle,
} from './rng/xoshiro128.ts';
