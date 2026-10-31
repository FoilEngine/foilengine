// Invariants checked by the fuzzer at every step of a game (docs/06-testing.md).
// They are engine properties, not rules: a violation is an engine bug. Invariants that need
// abilities, effects or the chain (tokens, effects that lower points, 312–313 with a chain)
// arrive with M3; determinism is checked on the whole game, by replaying it (fuzz.ts).

import { filterEventsFor } from '@foilengine/log';
import { isLegal, legalActions, pendingDecision, viewFor } from '@foilengine/rules';
import {
  type Action,
  type GameEvent,
  type GameState,
  type ObjectId,
  PLAYER_ZONE_PRIVACY,
  type PlayerId,
  type PlayerZoneId,
} from '@foilengine/types';

/** One step of a game: the creation (no action), or an action and what it led to. */
export type FuzzStep = {
  /** Actions applied before this state: 0 for the created game. */
  readonly index: number;
  readonly initial: GameState;
  readonly previous: GameState | null;
  readonly action: Action | null;
  readonly state: GameState;
  /** The events this step produced. */
  readonly events: readonly GameEvent[];
};

export type Invariant = {
  readonly name: string;
  readonly description: string;
  /** Why the step breaks the invariant, or null. */
  readonly check: (step: FuzzStep) => string | null;
};

/** Every object id where it is: in a player's zone, or as a battlefield or a unit there. */
function locations(state: GameState): { id: ObjectId; where: string }[] {
  const found: { id: ObjectId; where: string }[] = [];
  for (const player of state.players) {
    for (const zone of Object.keys(player.zones) as PlayerZoneId[]) {
      for (const id of player.zones[zone]) found.push({ id, where: `${player.id}.${zone}` });
    }
  }
  for (const battlefield of state.battlefields) {
    found.push({ id: battlefield.object, where: 'battlefields' });
    for (const id of battlefield.units)
      found.push({ id, where: `battlefield ${battlefield.object}` });
  }
  // An ability on the Chain has no card, so no object in `objects` (377.3.a.1).
  for (const item of state.chain?.items ?? []) {
    if (item.ability === null) found.push({ id: item.object, where: 'chain' });
  }
  return found;
}

function ownedCounts(state: GameState): Map<PlayerId, number> {
  const counts = new Map<PlayerId, number>();
  for (const object of Object.values(state.objects)) {
    counts.set(object.owner, (counts.get(object.owner) ?? 0) + 1);
  }
  return counts;
}

/** Objects already found to be plain JSON: states share most of them from step to step. */
const plainJson = new WeakSet<object>();

/** Plain JSON (ADR 0004): null, booleans, finite numbers, strings, arrays, plain objects. */
function jsonProblem(value: unknown, path: string): string | null {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? null : `${path} is ${value}`;
  if (typeof value === 'object' && plainJson.has(value)) return null;
  const problem = jsonProblemOf(value, path);
  if (problem === null) plainJson.add(value as object);
  return problem;
}

function jsonProblemOf(value: unknown, path: string): string | null {
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      const problem = jsonProblem(item, `${path}[${index}]`);
      if (problem !== null) return problem;
    }
    return null;
  }
  if (
    value !== null &&
    typeof value === 'object' &&
    Object.getPrototypeOf(value) === Object.prototype
  ) {
    for (const [key, item] of Object.entries(value)) {
      if (item === undefined) return `${path}.${key} is undefined`;
      const problem = jsonProblem(item, `${path}.${key}`);
      if (problem !== null) return problem;
    }
    return null;
  }
  return `${path} is not JSON (${typeof value})`;
}

/** Ids of the objects `viewer` must not be able to identify (108.4.e, 108.5.d, 108.7.c). */
function hiddenFrom(
  state: GameState,
  viewer: PlayerId,
): { inView: ObjectId[]; inEvents: ObjectId[] } {
  const inView: ObjectId[] = [];
  const inEvents: ObjectId[] = [];
  for (const player of state.players) {
    for (const zone of Object.keys(player.zones) as PlayerZoneId[]) {
      const privacy = PLAYER_ZONE_PRIVACY[zone];
      const hidden = privacy === 'secret' || (privacy === 'private' && player.id !== viewer);
      if (!hidden) continue;
      inView.push(...player.zones[zone]);
      // An event may name an object of a deck when it is public where it goes: a rune recycled
      // to the bottom of its deck (164.2.b). Cards in an opponent's hand never, and cards in a
      // Main Deck never, its owner's included (108.4.e).
      if ((player.id !== viewer && zone === 'hand') || zone === 'mainDeck') {
        inEvents.push(...player.zones[zone]);
      }
    }
  }
  return { inView, inEvents };
}

/** Every string in a JSON value, keys included. */
function stringsIn(value: unknown, found = new Set<string>()): Set<string> {
  if (typeof value === 'string') found.add(value);
  else if (Array.isArray(value)) for (const item of value) stringsIn(item, found);
  else if (value !== null && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      found.add(key);
      stringsIn(item, found);
    }
  }
  return found;
}

const mentions = (value: unknown, ids: readonly ObjectId[]) => {
  const strings = stringsIn(value);
  return ids.find((id) => strings.has(id));
};

/** Above this many actions, a game is considered stuck in a loop. */
export const MAX_ACTIONS = 1000;

export const INVARIANTS: readonly Invariant[] = [
  {
    name: 'objects-accounted',
    description: 'every object is in exactly one place, and every place holds existing objects',
    check: ({ state }) => {
      const seen = new Map<ObjectId, string>();
      for (const { id, where } of locations(state)) {
        if (state.objects[id] === undefined) return `${where} holds ${id}, which does not exist`;
        const other = seen.get(id);
        if (other !== undefined) return `${id} is both in ${other} and in ${where}`;
        seen.set(id, where);
      }
      const orphan = Object.keys(state.objects).find((id) => !seen.has(id as ObjectId));
      return orphan === undefined ? null : `${orphan} exists but is nowhere`;
    },
  },
  {
    name: 'card-count',
    description: 'each player owns as many objects as at the start (no token before M3)',
    check: ({ initial, state }) => {
      const before = ownedCounts(initial);
      const now = ownedCounts(state);
      for (const player of state.players) {
        const was = before.get(player.id) ?? 0;
        const is = now.get(player.id) ?? 0;
        if (was !== is) return `${player.id} owned ${was} objects at the start, ${is} now`;
      }
      return null;
    },
  },
  {
    name: 'points',
    description: 'points are never negative and never decrease (no effect lowers them before M3)',
    check: ({ previous, state }) => {
      for (const player of state.players) {
        if (player.points < 0) return `${player.id} has ${player.points} points`;
        const before = previous?.players.find((p) => p.id === player.id)?.points ?? 0;
        if (player.points < before)
          return `${player.id} went from ${before} to ${player.points} points`;
      }
      return null;
    },
  },
  {
    name: 'decision-while-ongoing',
    description:
      'a decision is pending exactly while the game goes on, and an ended game has a winner',
    check: ({ state }) => {
      const ended = state.stage.kind === 'ended';
      const decision = pendingDecision(state);
      if (ended && decision !== null) return `the game ended but ${decision.player} must decide`;
      if (!ended && decision === null) return 'the game goes on but no decision is pending';
      if (ended !== (state.winner !== null))
        return `stage ${state.stage.kind} with winner ${state.winner}`;
      return null;
    },
  },
  {
    name: 'legal-actions',
    description:
      'the deciding player can answer the decision, others can only concede, and every offered action is legal',
    check: ({ state }) => {
      if (state.stage.kind === 'ended') {
        const offered = state.players.find((p) => legalActions(state, p.id).length > 0);
        return offered === undefined ? null : `${offered.id} is offered actions in an ended game`;
      }
      // A game going on without a decision is the concern of decision-while-ongoing.
      const decision = pendingDecision(state);
      if (decision === null) return null;
      if (!state.players.some((p) => p.id === decision.player)) {
        return `the ${decision.kind} decision waits for ${decision.player}, who is not a player`;
      }
      for (const player of state.players) {
        const actions = legalActions(state, player.id);
        // Conceding is always possible while the game goes on, and listed last (650).
        if (actions.at(-1)?.type !== 'Concede')
          return `${player.id}'s actions do not end with Concede`;
        const answers = actions.length - 1;
        if (player.id === decision.player && answers === 0) {
          return `${player.id} must make a ${decision.kind} decision but has no action for it`;
        }
        if (player.id !== decision.player && answers > 0) {
          return `${player.id} is offered ${answers} actions while ${decision.player} decides`;
        }
        for (const action of actions) {
          const legality = isLegal(state, action);
          if (!legality.ok) {
            return `offered ${JSON.stringify(action)} is illegal: ${legality.reason.code} (${legality.reason.message})`;
          }
        }
      }
      return null;
    },
  },
  {
    name: 'json',
    description: 'the state and the events are plain JSON, so they survive a round trip unchanged',
    check: ({ state, events }) => jsonProblem(state, 'state') ?? jsonProblem(events, 'events'),
  },
  {
    name: 'event-sequence',
    description: 'events are numbered one after the other, across steps, without gaps',
    check: ({ previous, state, events }) => {
      let expected = (previous?.eventSeq ?? 0) + 1;
      for (const event of events) {
        if (event.seq !== expected)
          return `event ${event.type} has seq ${event.seq}, expected ${expected}`;
        expected += 1;
      }
      return state.eventSeq === expected - 1
        ? null
        : `state.eventSeq is ${state.eventSeq}, expected ${expected - 1}`;
    },
  },
  {
    name: 'no-leak',
    description: "a player's view and events name no object hidden from them",
    check: ({ state, events }) => {
      for (const player of state.players) {
        const hidden = hiddenFrom(state, player.id);
        const inView = mentions(viewFor(state, player.id), hidden.inView);
        if (inView !== undefined) return `${player.id}'s view names the hidden object ${inView}`;
        const inEvents = mentions(filterEventsFor(events, player.id), hidden.inEvents);
        if (inEvents !== undefined)
          return `an event shown to ${player.id} names the hidden object ${inEvents}`;
      }
      return null;
    },
  },
  {
    name: 'bounded',
    description: `a game ends in at most ${MAX_ACTIONS} actions`,
    check: ({ index }) => (index > MAX_ACTIONS ? `still going after ${MAX_ACTIONS} actions` : null),
  },
];
