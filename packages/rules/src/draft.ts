// A mutable working copy used while one engine call builds the next state.
// The state received as an argument is never modified (ADR 0004): `draftOf` copies
// what the call may change, and `finish` freezes nothing but returns plain JSON.

import type {
  GameEvent,
  GameObject,
  GameState,
  ObjectId,
  PlayerId,
  PlayerState,
  PlayerZoneId,
  RngState,
} from '@foilengine/types';
import { EngineInvariantError } from './errors.ts';

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/** An event before it gets its sequence number. */
export type EventInput = DistributiveOmit<GameEvent, 'seq'>;

type MutableZones = { [Z in PlayerZoneId]: ObjectId[] };

export type DraftPlayer = { id: PlayerId; points: number; zones: MutableZones };

export type Draft = {
  rng: RngState;
  nextObjectId: number;
  eventSeq: number;
  objects: Record<ObjectId, GameObject>;
  players: DraftPlayer[];
  events: GameEvent[];
};

export function draftOf(state: GameState): Draft {
  return {
    rng: state.rng,
    nextObjectId: state.nextObjectId,
    eventSeq: state.eventSeq,
    objects: { ...state.objects },
    players: state.players.map((player) => ({
      id: player.id,
      points: player.points,
      zones: {
        base: [...player.zones.base],
        legendZone: [...player.zones.legendZone],
        championZone: [...player.zones.championZone],
        mainDeck: [...player.zones.mainDeck],
        runeDeck: [...player.zones.runeDeck],
        hand: [...player.zones.hand],
        trash: [...player.zones.trash],
        banishment: [...player.zones.banishment],
      },
    })),
    events: [],
  };
}

export function emptyZones(): MutableZones {
  return {
    base: [],
    legendZone: [],
    championZone: [],
    mainDeck: [],
    runeDeck: [],
    hand: [],
    trash: [],
    banishment: [],
  };
}

export function emit(draft: Draft, event: EventInput): void {
  draft.eventSeq += 1;
  draft.events.push({ ...event, seq: draft.eventSeq } as GameEvent);
}

/** Creates a new object (119). Ids come from a counter in the state: deterministic. */
export function createObject(
  draft: Draft,
  card: GameObject['card'],
  owner: PlayerId,
  previousObjectId: ObjectId | null,
): GameObject {
  const object: GameObject = {
    id: `o${draft.nextObjectId}` as ObjectId,
    card,
    owner,
    previousObjectId,
  };
  draft.nextObjectId += 1;
  draft.objects[object.id] = object;
  return object;
}

/**
 * Moves an object to or from a Non-Board Zone: it becomes a new object (124).
 * The old object stops existing; the new one remembers it in `previousObjectId`.
 */
export function renewObject(draft: Draft, id: ObjectId): GameObject {
  const old = objectOf(draft, id);
  delete draft.objects[id];
  return createObject(draft, old.card, old.owner, old.id);
}

export function objectOf(draft: Draft, id: ObjectId): GameObject {
  const object = draft.objects[id];
  if (object === undefined) throw new EngineInvariantError(`Unknown object ${id}`);
  return object;
}

export function playerOf(draft: Draft, id: PlayerId): DraftPlayer {
  const player = draft.players.find((p) => p.id === id);
  if (player === undefined) throw new EngineInvariantError(`Unknown player ${id}`);
  return player;
}

export function playerStates(draft: Draft): PlayerState[] {
  return draft.players.map((player) => ({
    id: player.id,
    points: player.points,
    zones: player.zones,
  }));
}
