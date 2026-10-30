// The .foilreplay format (ADR 0005): enough to rebuild a game exactly (ADR 0003): the rules
// version, the setup, the seed and the actions. Events are not stored, they are derived again;
// each step (the creation, then each action) records a fingerprint of the state it led to and of
// the events it produced, so that a replay finds the first step where it diverges.

import { apply, createGame, isLegal, RULES_VERSION } from '@foilengine/rules';
import type {
  Action,
  GameEvent,
  GameSetup,
  GameState,
  IllegalReason,
  RulesVersion,
  Seed,
  SetupProblem,
} from '@foilengine/types';
import { canonicalJson, digestOf } from './state-hash.ts';

/** Incremented on every incompatible change of the format; old replays must stay readable. */
export const REPLAY_FORMAT = 1;

export type Replay = {
  readonly format: typeof REPLAY_FORMAT;
  readonly rulesVersion: RulesVersion;
  readonly setup: GameSetup;
  readonly seed: Seed;
  readonly actions: readonly Action[];
  /** `stepHash` of createGame, then of each action: `actions.length + 1` entries. */
  readonly hashes: readonly string[];
};

/** The fingerprint of one step: the state it led to and the events it produced, in order. */
export function stepHash(state: GameState, events: readonly GameEvent[]): string {
  return digestOf({ events, state }).slice(1);
}

/** Starts the replay of a game just created, from what createGame returned. */
export function startReplay(
  setup: GameSetup,
  seed: Seed,
  created: { readonly state: GameState; readonly events: readonly GameEvent[] },
): Replay {
  return {
    format: REPLAY_FORMAT,
    rulesVersion: created.state.rulesVersion,
    setup,
    seed,
    actions: [],
    hashes: [stepHash(created.state, created.events)],
  };
}

/** Adds an applied action, with what apply returned. */
export function recordAction(
  replay: Replay,
  action: Action,
  result: { readonly state: GameState; readonly events: readonly GameEvent[] },
): Replay {
  return {
    ...replay,
    actions: [...replay.actions, action],
    hashes: [...replay.hashes, stepHash(result.state, result.events)],
  };
}

/** The .foilreplay text: canonical JSON, so that the same replay always gives the same file. */
export function serializeReplay(replay: Replay): string {
  return `${canonicalJson(replay)}\n`;
}

export type ParseResult =
  | { readonly ok: true; readonly replay: Replay }
  | { readonly ok: false; readonly reason: string };

/** Reads a .foilreplay text. The game itself is checked by `replay`. */
export function parseReplay(text: string): ParseResult {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'Not JSON' };
  }
  if (value === null || typeof value !== 'object')
    return { ok: false, reason: 'Not a replay object' };
  const candidate = value as Partial<Replay>;
  if (candidate.format !== REPLAY_FORMAT) {
    return {
      ok: false,
      reason: `Unsupported replay format ${String(candidate.format)} (this version reads ${REPLAY_FORMAT})`,
    };
  }
  if (
    typeof candidate.rulesVersion !== 'string' ||
    typeof candidate.seed !== 'string' ||
    typeof candidate.setup !== 'object' ||
    candidate.setup === null ||
    !Array.isArray(candidate.actions) ||
    !Array.isArray(candidate.hashes) ||
    candidate.hashes.length !== candidate.actions.length + 1
  ) {
    return { ok: false, reason: 'Missing or malformed fields' };
  }
  return { ok: true, replay: candidate as Replay };
}

export type ReplayResult =
  | { readonly ok: true; readonly state: GameState; readonly events: readonly GameEvent[] }
  | { readonly ok: false; readonly problem: ReplayProblem };

export type ReplayProblem =
  | { readonly kind: 'rules-version'; readonly replay: RulesVersion; readonly engine: RulesVersion }
  | { readonly kind: 'setup'; readonly problems: readonly SetupProblem[] }
  /** Action `index` (0-based) is illegal in the replayed state. */
  | { readonly kind: 'illegal-action'; readonly index: number; readonly reason: IllegalReason }
  /** Step `index` (0 = the creation, n = action n - 1) led to another state or other events. */
  | {
      readonly kind: 'divergence';
      readonly index: number;
      readonly expected: string;
      readonly actual: string;
    };

/**
 * Replays the first `count` actions (all by default) and checks every recorded fingerprint.
 * Replays of another Core Rules version are refused: the engine implements one version.
 */
export function replay(recorded: Replay, count = recorded.actions.length): ReplayResult {
  if (recorded.rulesVersion !== RULES_VERSION) {
    return {
      ok: false,
      problem: { kind: 'rules-version', replay: recorded.rulesVersion, engine: RULES_VERSION },
    };
  }
  const created = createGame(recorded.setup, recorded.seed);
  if (!created.ok) return { ok: false, problem: { kind: 'setup', problems: created.problems } };
  const events: GameEvent[] = [...created.events];
  let state = created.state;
  const check = (index: number, produced: readonly GameEvent[]): ReplayResult | null => {
    const expected = recorded.hashes[index];
    const actual = stepHash(state, produced);
    return expected === undefined || expected === actual
      ? null
      : { ok: false, problem: { kind: 'divergence', index, expected, actual } };
  };
  const first = check(0, created.events);
  if (first !== null) return first;
  for (let index = 0; index < Math.min(count, recorded.actions.length); index++) {
    const action = recorded.actions[index] as Action;
    const legality = isLegal(state, action);
    if (!legality.ok)
      return { ok: false, problem: { kind: 'illegal-action', index, reason: legality.reason } };
    const result = apply(state, action);
    state = result.state;
    events.push(...result.events);
    const diverged = check(index + 1, result.events);
    if (diverged !== null) return diverged;
  }
  return { ok: true, state, events };
}

/** The state after the first `count` actions, for rewind (docs/08-server-and-protocol.md). */
export function rewindTo(recorded: Replay, count: number): ReplayResult {
  if (!Number.isInteger(count) || count < 0 || count > recorded.actions.length) {
    throw new RangeError(
      `Cannot rewind to ${count}: the replay has ${recorded.actions.length} actions`,
    );
  }
  return replay(recorded, count);
}
