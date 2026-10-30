// Helpers shared by the scenarios until the scenario() harness exists (docs/12-roadmap.md, M1).

import { apply, createGame, pendingDecision } from '@foilengine/rules';
import { testSetup } from '@foilengine/testkit';
import type {
  GameEvent,
  GameSetup,
  GameState,
  ObjectId,
  PlayerId,
  PlayerState,
  Seed,
} from '@foilengine/types';

export const A = 'A' as PlayerId;
export const B = 'B' as PlayerId;

/** Creates a game and fails the test if the setup is refused. */
export function start(
  setup: GameSetup = testSetup(),
  seed = 'seed-1',
): { state: GameState; events: GameEvent[] } {
  const result = createGame(setup, seed as Seed);
  if (!result.ok) throw new Error(`Setup refused: ${JSON.stringify(result.problems)}`);
  return { state: result.state, events: result.events };
}

export function player(state: GameState, id: PlayerId): PlayerState {
  const found = state.players.find((p) => p.id === id);
  if (found === undefined) throw new Error(`No player ${id}`);
  return found;
}

/** Cards (definitions ids) of a list of objects. */
export function cardsOf(state: GameState, ids: readonly ObjectId[]): string[] {
  return ids.map((id) => state.objects[id]?.card ?? `missing:${id}`);
}

/** Every player keeps their hand: the game reaches the end of setup. */
export function keepAll(state: GameState): { state: GameState; events: GameEvent[] } {
  let current = state;
  const events: GameEvent[] = [];
  for (
    let decision = pendingDecision(current);
    decision !== null;
    decision = pendingDecision(current)
  ) {
    const result = apply(current, { type: 'Mulligan', player: decision.player, setAside: [] });
    current = result.state;
    events.push(...result.events);
  }
  return { state: current, events };
}

export function eventsOfType<T extends GameEvent['type']>(events: readonly GameEvent[], type: T) {
  return events.filter((event): event is Extract<GameEvent, { type: T }> => event.type === type);
}

/** The first `n` ids of a zone, failing the test if the zone is too small. */
export function take(ids: readonly ObjectId[], n: 1): [ObjectId];
export function take(ids: readonly ObjectId[], n: 2): [ObjectId, ObjectId];
export function take(ids: readonly ObjectId[], n: 3): [ObjectId, ObjectId, ObjectId];
export function take(ids: readonly ObjectId[], n: number): ObjectId[] {
  if (ids.length < n) throw new Error(`Expected at least ${n} objects, got ${ids.length}`);
  return ids.slice(0, n);
}
