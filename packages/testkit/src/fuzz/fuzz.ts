// The fuzzer (docs/06-testing.md): full random games, every invariant checked at every step,
// and each game replayed from its log to check determinism. Games are driven by a list of
// choices, so that fast-check can shrink a failing game to a shorter, simpler one.

import {
  parseReplay,
  type Replay,
  recordAction,
  replay,
  serializeReplay,
  startReplay,
} from '@foilengine/log';
import { apply, createGame, legalActions, pendingDecision } from '@foilengine/rules';
import type { Action, GameSetup, GameState, PlayerId, Seed } from '@foilengine/types';
import fc from 'fast-check';
import { testSetup } from '../cards/test-cards.ts';
import { INVARIANTS, type Invariant, MAX_ACTIONS } from './invariants.ts';

/**
 * How a player picks among the legal actions. `uniform` never concedes; `concede` treats Concede
 * like any other action; `full-mulligan` always sets aside as many cards as possible (117).
 */
export const FUZZ_POLICIES = ['uniform', 'concede', 'full-mulligan'] as const;
export type FuzzPolicy = (typeof FUZZ_POLICIES)[number];

/** One fuzzed game: everything needed to play it again. */
export type FuzzCase = {
  readonly seed: string;
  readonly policy: FuzzPolicy;
  /** The first choices, one per action; later ones are derived from the seed. */
  readonly choices: readonly number[];
};

export type FuzzViolation = {
  readonly invariant: string;
  readonly message: string;
  /** Actions applied when the invariant broke (0: right after createGame). */
  readonly step: number;
  readonly case: FuzzCase;
  /** The game up to the faulty step, included. */
  readonly replay: Replay;
};

export type FuzzGameResult = {
  readonly actions: number;
  readonly winner: PlayerId | null;
  /** The rules quoted by the events of the game. */
  readonly rules: ReadonlySet<string>;
  /** The game as played, up to the violation if there is one. */
  readonly replay: Replay;
  readonly violation: FuzzViolation | null;
};

export type FuzzGameOptions = {
  readonly setup?: GameSetup;
  readonly invariants?: readonly Invariant[];
};

/** A choice for every action after the given ones: FNV-1a of the seed and the action index. */
function derivedChoice(seed: string, index: number): number {
  let hash = 0x811c9dc5;
  const text = `${seed}#${index}`;
  for (let i = 0; i < text.length; i++) {
    hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193);
  }
  return hash >>> 0;
}

function choose(
  state: GameState,
  actions: readonly Action[],
  policy: FuzzPolicy,
  choice: number,
): Action {
  // legalActions lists Concede last (650).
  const answers = actions.slice(0, -1);
  if (policy === 'concede' || answers.length === 0)
    return actions[choice % actions.length] as Action;
  if (policy === 'full-mulligan' && pendingDecision(state)?.kind === 'Mulligan') {
    const most = Math.max(...answers.map((a) => (a.type === 'Mulligan' ? a.setAside.length : 0)));
    const full = answers.filter((a) => a.type === 'Mulligan' && a.setAside.length === most);
    return full[choice % full.length] as Action;
  }
  return answers[choice % answers.length] as Action;
}

/** Plays one game to its end, checking the invariants at every step, then replays it. */
export function playFuzzGame(fuzzCase: FuzzCase, options: FuzzGameOptions = {}): FuzzGameResult {
  const setup = options.setup ?? testSetup({ distinctDecks: true, withSpells: true });
  const invariants = options.invariants ?? INVARIANTS;
  const created = createGame(setup, fuzzCase.seed as Seed);
  if (!created.ok) throw new Error(`Fuzz setup refused: ${JSON.stringify(created.problems)}`);

  const rules = new Set<string>();
  let recorded = startReplay(setup, fuzzCase.seed as Seed, created);
  const initial = created.state;
  let previous: GameState | null = null;
  let state = initial;
  let action: Action | null = null;
  let events = created.events;
  for (let index = 0; ; index++) {
    for (const event of events) if (event.rule !== null) rules.add(event.rule);
    for (const invariant of invariants) {
      const message = invariant.check({ index, initial, previous, action, state, events });
      if (message !== null) {
        const violation = {
          invariant: invariant.name,
          message,
          step: index,
          case: fuzzCase,
          replay: recorded,
        };
        return { actions: index, winner: state.winner, rules, replay: recorded, violation };
      }
    }
    const decision = pendingDecision(state);
    if (decision === null || index >= MAX_ACTIONS) break;
    action = choose(
      state,
      legalActions(state, decision.player),
      fuzzCase.policy,
      fuzzCase.choices[index] ?? derivedChoice(fuzzCase.seed, index),
    );
    const result = apply(state, action);
    recorded = recordAction(recorded, action, result);
    previous = state;
    state = result.state;
    events = result.events;
  }

  // Determinism (ADR 0003): the game replayed from its serialized log gives the same
  // fingerprint at every step.
  const actions = recorded.actions.length;
  const parsed = parseReplay(serializeReplay(recorded));
  const replayed = parsed.ok ? replay(parsed.replay) : null;
  if (replayed === null || !replayed.ok) {
    const message = parsed.ok
      ? `the replay fails: ${JSON.stringify(replayed?.ok === false ? replayed.problem : null)}`
      : `the replay does not parse: ${parsed.reason}`;
    const violation = {
      invariant: 'determinism',
      message,
      step: actions,
      case: fuzzCase,
      replay: recorded,
    };
    return { actions, winner: state.winner, rules, replay: recorded, violation };
  }
  return { actions, winner: state.winner, rules, replay: recorded, violation: null };
}

export type FuzzOptions = FuzzGameOptions & {
  readonly games: number;
  /** fast-check seed: the same seed plays the same games. */
  readonly seed: number;
  /** Called after each game, for progress reports. */
  readonly onGame?: (result: FuzzGameResult) => void;
};

export type FuzzReport = {
  readonly seed: number;
  readonly games: number;
  readonly actions: number;
  /** The first violation found, shrunk by fast-check. */
  readonly violation: FuzzViolation | null;
};

export const fuzzCaseArbitrary: fc.Arbitrary<FuzzCase> = fc.record({
  seed: fc.string({ minLength: 1, maxLength: 12 }),
  policy: fc.oneof(
    { weight: 8, arbitrary: fc.constant<FuzzPolicy>('uniform') },
    { weight: 1, arbitrary: fc.constant<FuzzPolicy>('concede') },
    { weight: 1, arbitrary: fc.constant<FuzzPolicy>('full-mulligan') },
  ),
  choices: fc.array(fc.nat({ max: 1000 }), { maxLength: 200 }),
});

/** Plays `games` random games; on a violation, shrinks it to a smaller failing game. */
export function fuzz(options: FuzzOptions): FuzzReport {
  const { seed } = options;
  let games = 0;
  let actions = 0;
  let shrinking = false;
  const details = fc.check(
    fc.property(fuzzCaseArbitrary, (fuzzCase) => {
      const result = playFuzzGame(fuzzCase, options);
      if (!shrinking) {
        games += 1;
        actions += result.actions;
        options.onGame?.(result);
      }
      if (result.violation !== null) shrinking = true;
      return result.violation === null;
    }),
    { numRuns: options.games, seed },
  );
  if (!details.failed || details.counterexample === null) {
    return { seed, games, actions, violation: null };
  }
  const [shrunk] = details.counterexample;
  return { seed, games, actions, violation: playFuzzGame(shrunk, options).violation };
}

/** The reproduction files of a violation (docs/06-testing.md): file name → content. */
export function reproductionFiles(
  violation: FuzzViolation,
  fuzzSeed: number,
): Record<string, string> {
  const name = `${violation.invariant}-${fuzzSeed}`;
  const details = {
    invariant: violation.invariant,
    message: violation.message,
    step: violation.step,
    fuzzSeed,
    case: violation.case,
    replay: `${name}.foilreplay`,
  };
  return {
    [`${name}.foilreplay`]: serializeReplay(violation.replay),
    [`${name}.json`]: `${JSON.stringify(details, null, 2)}\n`,
  };
}
