// The fuzzer itself (docs/06-testing.md): a short run of every invariant, and checks that each
// invariant and the shrinking catch what they should.

import { parseReplay, replay } from '@foilengine/log';
import { createGame } from '@foilengine/rules';
import type { GameState, ObjectId, PlayerId, Seed } from '@foilengine/types';
import { describe, expect, it } from 'vitest';
import {
  type FuzzStep,
  fuzz,
  INVARIANTS,
  type Invariant,
  MAX_ACTIONS,
  playFuzzGame,
  reproductionFiles,
  testSetup,
} from '../src/index.ts';

describe('fuzz (short run; the nightly CI runs 10,000 games)', () => {
  it('plays random games to the end without breaking any invariant', () => {
    const report = fuzz({ games: 15, seed: 2026 });
    expect(report.violation).toBeNull();
    expect(report.games).toBe(15);
    expect(report.actions).toBeGreaterThan(15 * 20);
  }, 30_000);

  it('plays the same game for the same case', () => {
    const fuzzCase = { seed: 'same', policy: 'uniform' as const, choices: [3, 1, 4] };
    const a = playFuzzGame(fuzzCase);
    const b = playFuzzGame(fuzzCase);
    expect(a.actions).toBe(b.actions);
    expect(a.winner).toBe(b.winner);
    expect(a.winner).not.toBeNull();
  });

  it('the concede policy ends some games by a concession, the uniform policy never', () => {
    const conceded = (policy: 'uniform' | 'concede') =>
      Array.from({ length: 10 }, (_, i) =>
        playFuzzGame({ seed: `c${i}`, policy, choices: [] }),
      ).filter((r) => r.replay.actions.at(-1)?.type === 'Concede').length;
    expect(conceded('concede')).toBeGreaterThan(0);
    expect(conceded('uniform')).toBe(0);
    // Twenty full games with every invariant checked: as long as the run above.
  }, 30_000);

  it('the full-mulligan policy sets aside as many cards as allowed (117.1)', () => {
    const { replay: played, violation } = playFuzzGame({
      seed: 'mull',
      policy: 'full-mulligan',
      choices: [],
    });
    expect(violation).toBeNull();
    expect(played.actions.slice(0, 2)).toMatchObject([
      { type: 'Mulligan', setAside: [expect.anything(), expect.anything()] },
      { type: 'Mulligan', setAside: [expect.anything(), expect.anything()] },
    ]);
  });
});

describe('a violation', () => {
  // A planted bug: "no unit ever reaches a battlefield". Random games break it quickly.
  const planted: Invariant = {
    name: 'planted',
    description: 'no unit at a battlefield',
    check: ({ state }) =>
      state.battlefields.some((b) => b.units.length > 0) ? 'a unit is at a battlefield' : null,
  };

  it('is found, shrunk, and comes with a replay of the game up to the faulty step', () => {
    const report = fuzz({ games: 20, seed: 7, invariants: [planted] });
    const violation = report.violation;
    if (violation === null) throw new Error('the planted bug was not found');
    expect(violation.invariant).toBe('planted');
    // Shrinking keeps few explicit choices, all small.
    expect(violation.case.choices.length).toBeLessThanOrEqual(5);
    expect(violation.replay.actions).toHaveLength(violation.step);
    const replayed = replay(violation.replay);
    if (!replayed.ok) throw new Error(JSON.stringify(replayed.problem));
    expect(planted.check({ ...stepOf(replayed.state), index: violation.step })).not.toBeNull();

    // Its reproduction files: the replay, and what broke with how to play the game again.
    const files = reproductionFiles(violation, report.seed);
    expect(Object.keys(files)).toEqual(['planted-7.foilreplay', 'planted-7.json']);
    const parsed = parseReplay(files['planted-7.foilreplay'] as string);
    expect(parsed.ok && parsed.replay.actions).toHaveLength(violation.step);
    expect(JSON.parse(files['planted-7.json'] as string)).toMatchObject({
      invariant: 'planted',
      step: violation.step,
      fuzzSeed: 7,
      case: violation.case,
      replay: 'planted-7.foilreplay',
    });
  });
});

/** A step whose state is `state`, as right after createGame. */
function stepOf(state: GameState, events: FuzzStep['events'] = []): FuzzStep {
  return { index: 0, initial: state, previous: null, action: null, state, events };
}

describe('INVARIANTS', () => {
  const created = createGame(testSetup({ distinctDecks: true }), 'invariants' as Seed);
  if (!created.ok) throw new Error('setup refused');
  const state = created.state;
  const [A, B] = state.turnOrder as [PlayerId, PlayerId];
  const invariant = (name: string) => {
    const found = INVARIANTS.find((i) => i.name === name);
    if (found === undefined) throw new Error(`no invariant ${name}`);
    return found;
  };
  const withPlayer = (
    s: GameState,
    id: PlayerId,
    change: (p: GameState['players'][number]) => object,
  ) => ({
    ...s,
    players: s.players.map((p) => (p.id === id ? { ...p, ...change(p) } : p)),
  });
  const hand = (s: GameState, id: PlayerId) => s.players.find((p) => p.id === id)?.zones.hand ?? [];

  it('all hold on a new game', () => {
    for (const { name, check } of INVARIANTS)
      expect([name, check(stepOf(state, created.events))]).toEqual([name, null]);
  });

  it('objects-accounted: an object in two places, or nowhere', () => {
    const [card] = hand(state, A) as [ObjectId];
    const twice = withPlayer(state, A, (p) => ({ zones: { ...p.zones, trash: [card] } }));
    expect(invariant('objects-accounted').check(stepOf(twice))).toContain('both in');
    const nowhere = withPlayer(state, A, (p) => ({
      zones: { ...p.zones, hand: p.zones.hand.slice(1) },
    }));
    expect(invariant('objects-accounted').check(stepOf(nowhere))).toContain('nowhere');
  });

  it('card-count: a player gains an object', () => {
    const [card] = hand(state, A) as [ObjectId];
    const object = state.objects[card];
    const more = {
      ...state,
      objects: { ...state.objects, extra: { ...object, id: 'extra' } },
    } as GameState;
    expect(invariant('card-count').check({ ...stepOf(state), state: more })).toContain('owned');
  });

  it('points: negative, or lower than before', () => {
    const negative = withPlayer(state, A, () => ({ points: -1 }));
    expect(invariant('points').check(stepOf(negative))).toContain('-1');
    const before = withPlayer(state, A, () => ({ points: 3 }));
    const after = withPlayer(state, A, () => ({ points: 2 }));
    expect(invariant('points').check({ ...stepOf(after), previous: before })).toContain(
      'from 3 to 2',
    );
  });

  it('decision-while-ongoing: an ended game without a winner', () => {
    const ended = { ...state, stage: { kind: 'ended' } } as GameState;
    expect(invariant('decision-while-ongoing').check(stepOf(ended))).not.toBeNull();
  });

  it('legal-actions: a decision that waits for someone who is not a player', () => {
    const stage = { kind: 'turn', turnPlayer: 'nobody', turnNumber: 3, phase: 'main' };
    const ghost = { ...state, stage } as GameState;
    expect(invariant('legal-actions').check(stepOf(ghost))).toContain('not a player');
  });

  it('json: undefined, NaN or a class instance in the state', () => {
    expect(invariant('json').check(stepOf({ ...state, winner: undefined } as never))).toContain(
      'undefined',
    );
    expect(
      invariant('json').check(stepOf(withPlayer(state, A, () => ({ points: Number.NaN })))),
    ).toContain('NaN');
    expect(invariant('json').check(stepOf({ ...state, extra: new Map() } as never))).toContain(
      'not JSON',
    );
  });

  it('event-sequence: a gap in the numbering', () => {
    const [first, , ...rest] = created.events;
    expect(
      invariant('event-sequence').check({ ...stepOf(state), events: [first, ...rest] as never }),
    ).toContain('seq');
  });

  it("no-leak: an opponent's hand card named in a public event", () => {
    const [card] = hand(state, B) as [ObjectId];
    const event = {
      type: 'UnitsMoved',
      seq: 1,
      rule: '144',
      visibility: { kind: 'public' },
      player: B,
      units: [card],
      battlefield: null,
    };
    expect(invariant('no-leak').check({ ...stepOf(state), events: [event] as never })).toContain(
      card,
    );
  });

  it('bounded: a game still going after MAX_ACTIONS actions', () => {
    expect(invariant('bounded').check({ ...stepOf(state), index: MAX_ACTIONS + 1 })).not.toBeNull();
  });
});
