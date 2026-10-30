import { apply, createGame, viewFor } from '@foilengine/rules';
import type { GameEvent, Seed } from '@foilengine/types';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  canonicalJson,
  filterEventsFor,
  hash128,
  parseReplay,
  REPLAY_FORMAT,
  replay,
  rewindTo,
  serializeReplay,
  stateHash,
  stepHash,
} from '../src/index.ts';
import { A, B, playRecorded, SETUP } from './fixture.ts';

describe('stateHash', () => {
  it('does not depend on the order of the keys', () => {
    expect(canonicalJson({ b: 1, a: [{ d: 2, c: 3 }] })).toBe(
      canonicalJson({ a: [{ c: 3, d: 2 }], b: 1 }),
    );
    const created = createGame(SETUP, 'order' as Seed);
    if (!created.ok) throw new Error('setup refused');
    expect(stateHash({ ...created.state })).toBe(stateHash(created.state));
    expect(stateHash(JSON.parse(JSON.stringify(created.state)))).toBe(stateHash(created.state));
  });

  it('changes when the state changes', () => {
    const { states } = playRecorded('change', 5);
    const hashes = states.map(stateHash);
    expect(new Set(hashes).size).toBe(hashes.length);
  });

  it('is 32 hexadecimal characters, and different texts give different hashes', () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), (a, b) => {
        expect(hash128(a)).toMatch(/^[0-9a-f]{32}$/);
        if (a !== b) expect(hash128(a)).not.toBe(hash128(b));
      }),
    );
  });
});

describe('replays (ADR 0003, 0005)', () => {
  it('rebuild the recorded game exactly', () => {
    for (const seed of ['one', 'two', 'three']) {
      const { replay: recorded, states } = playRecorded(seed);
      const result = replay(recorded);
      if (!result.ok) throw new Error(JSON.stringify(result.problem));
      expect(stateHash(result.state)).toBe(stateHash(states.at(-1) as never));
      expect(result.state.winner).not.toBeNull();
    }
  });

  it('survive serialization: the text is stable and parses back to the same replay', () => {
    const { replay: recorded } = playRecorded('text');
    const text = serializeReplay(recorded);
    const parsed = parseReplay(text);
    if (!parsed.ok) throw new Error(parsed.reason);
    expect(serializeReplay(parsed.replay)).toBe(text);
    expect(replay(parsed.replay).ok).toBe(true);
  });

  it('find the first divergence when a fingerprint does not match', () => {
    const { replay: recorded } = playRecorded('tampered');
    const hashes = [...recorded.hashes];
    hashes[10] = '0'.repeat(32);
    const result = replay({ ...recorded, hashes });
    expect(result).toMatchObject({ ok: false, problem: { kind: 'divergence', index: 10 } });
  });

  it('fingerprint the events of each step, not only the state', () => {
    const created = createGame(SETUP, 'events' as Seed);
    if (!created.ok) throw new Error('setup refused');
    const events = created.events.slice(0, -1);
    expect(stepHash(created.state, events)).not.toBe(stepHash(created.state, created.events));
    expect(stepHash(created.state, created.events)).toBe(replayHash('events'));
  });

  it('report an action that is illegal in the replayed game', () => {
    const { replay: recorded } = playRecorded('illegal');
    const actions = [...recorded.actions];
    // Both mulligans are done by action 3: a third one is never legal.
    actions[3] = { type: 'Mulligan', player: A, setAside: [] };
    expect(replay({ ...recorded, actions })).toMatchObject({
      ok: false,
      problem: { kind: 'illegal-action', index: 3 },
    });
  });

  it('refuse a replay of another Core Rules version', () => {
    const { replay: recorded } = playRecorded('version', 3);
    expect(replay({ ...recorded, rulesVersion: 'CR-1999-01-01' })).toMatchObject({
      ok: false,
      problem: { kind: 'rules-version' },
    });
  });

  it('rewind to the state after any number of actions', () => {
    const { replay: recorded, states } = playRecorded('rewind');
    for (const count of [0, 1, 7, recorded.actions.length]) {
      const result = rewindTo(recorded, count);
      if (!result.ok) throw new Error(JSON.stringify(result.problem));
      expect(stateHash(result.state)).toBe(stateHash(states[count] as never));
    }
    expect(() => rewindTo(recorded, recorded.actions.length + 1)).toThrow(RangeError);
  });

  it('parse only the supported format', () => {
    expect(parseReplay('not json')).toMatchObject({ ok: false });
    expect(parseReplay(JSON.stringify({ format: REPLAY_FORMAT + 1 }))).toMatchObject({ ok: false });
    const { replay: recorded } = playRecorded('short', 2);
    expect(parseReplay(JSON.stringify({ ...recorded, hashes: [] }))).toMatchObject({ ok: false });
  });
});

describe('filterEventsFor (ADR 0006)', () => {
  const created = createGame(SETUP, 'filter' as Seed);
  if (!created.ok) throw new Error('setup refused');
  const events: GameEvent[] = [...created.events];

  it('keeps private fields for the players the event is visible to', () => {
    const own = filterEventsFor(events, A).filter((e) => e.type === 'CardDrawn' && e.player === A);
    expect(own.every((e) => 'card' in e && !('redacted' in e))).toBe(true);
  });

  it("redacts an opponent's draws: who drew, not what nor which object", () => {
    const theirs = filterEventsFor(events, A).filter(
      (e) => e.type === 'CardDrawn' && e.player === B,
    );
    expect(theirs).toHaveLength(4);
    for (const event of theirs) {
      expect(event).toMatchObject({ type: 'CardDrawn', player: B, redacted: true });
      expect('card' in event).toBe(false);
      expect('object' in event).toBe(false);
    }
  });

  it('leaves public events untouched', () => {
    const publicEvents = events.filter((e) => e.visibility.kind === 'public');
    expect(filterEventsFor(publicEvents, A)).toEqual(publicEvents);
  });

  it('never shows a player an object id that their view hides', () => {
    let state = created.state;
    const all = [...events];
    for (const player of [state.turnOrder[0], state.turnOrder[1]]) {
      const result = apply(state, { type: 'Mulligan', player: player as never, setAside: [] });
      state = result.state;
      all.push(...result.events);
    }
    const hidden = state.players.find((p) => p.id === B)?.zones.hand ?? [];
    const json = JSON.stringify(filterEventsFor(all, A)) + JSON.stringify(viewFor(state, A));
    for (const id of hidden) expect(json).not.toContain(`"${id}"`);
  });
});

/** The recorded fingerprint of the creation step of a game played with `seed`. */
function replayHash(seed: string): string {
  return playRecorded(seed, 0).replay.hashes[0] as string;
}
