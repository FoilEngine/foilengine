// A mutable working copy used while one engine call builds the next state.
// The state received as an argument is never modified (ADR 0004): `draftOf` copies
// what the call may change, and `stateOf` builds the next state from the draft.
// Objects are not copied: the draft records the objects it changes on top of the state's, so
// that checking a candidate action (legalActions) does not copy every object of the game.

import type {
  ChainState,
  CombatState,
  ContinuousEffect,
  GameEvent,
  GameObject,
  GameStage,
  GameState,
  ObjectId,
  PlayerId,
  PlayerState,
  PlayerZoneId,
  RngState,
  ShowdownState,
  Task,
  TriggeredAbility,
} from '@foilengine/types';
import { EngineInvariantError } from './errors.ts';
import { copyPool } from './resources/rune-pool.ts';

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/** An event before it gets its sequence number. */
export type EventInput = DistributiveOmit<GameEvent, 'seq'>;

type MutableZones = { [Z in PlayerZoneId]: ObjectId[] };

export type DraftPlayer = {
  id: PlayerId;
  points: number;
  turnsTaken: number;
  runePool: ReturnType<typeof copyPool>;
  scoredThisTurn: ObjectId[];
  zones: MutableZones;
};

export type DraftBattlefield = {
  object: ObjectId;
  controller: PlayerId | null;
  contestedBy: PlayerId | null;
  showdownStaged: boolean;
  combatStaged: boolean;
  units: ObjectId[];
};

export type Draft = {
  /** The card definitions of the game, read-only. */
  readonly cards: GameState['cards'];
  rng: RngState;
  nextObjectId: number;
  eventSeq: number;
  /** The objects of the state the draft starts from, never modified. */
  readonly baseObjects: GameState['objects'];
  /** Objects created or changed by the draft; `null` for a removed one. Read through `objectOf`. */
  readonly changedObjects: Map<ObjectId, GameObject | null>;
  players: DraftPlayer[];
  battlefields: DraftBattlefield[];
  showdown: ShowdownState | null;
  combat: CombatState | null;
  chain: ChainState | null;
  triggered: readonly TriggeredAbility[];
  tasks: readonly Task[];
  effects: readonly ContinuousEffect[];
  turnOrder: readonly PlayerId[];
  stage: GameStage;
  winner: PlayerId | null;
  events: GameEvent[];
};

export function draftOf(state: GameState): Draft {
  return {
    cards: state.cards,
    rng: state.rng,
    nextObjectId: state.nextObjectId,
    eventSeq: state.eventSeq,
    baseObjects: state.objects,
    changedObjects: new Map(),
    players: state.players.map((player) => ({
      id: player.id,
      points: player.points,
      turnsTaken: player.turnsTaken,
      runePool: copyPool(player.runePool),
      scoredThisTurn: [...player.scoredThisTurn],
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
    battlefields: state.battlefields.map((battlefield) => ({
      ...battlefield,
      units: [...battlefield.units],
    })),
    showdown: state.showdown,
    combat: state.combat,
    chain: state.chain,
    triggered: state.triggered,
    tasks: state.tasks,
    effects: state.effects,
    turnOrder: state.turnOrder,
    stage: state.stage,
    winner: state.winner,
    events: [],
  };
}

/** The next state: `base` with everything the draft may have changed. */
export function stateOf(base: GameState, draft: Draft): GameState {
  return {
    ...base,
    rng: draft.rng,
    nextObjectId: draft.nextObjectId,
    eventSeq: draft.eventSeq,
    objects: objectsOf(draft),
    players: draft.players.map(
      (player): PlayerState => ({
        id: player.id,
        points: player.points,
        turnsTaken: player.turnsTaken,
        runePool: player.runePool,
        scoredThisTurn: player.scoredThisTurn,
        zones: player.zones,
      }),
    ),
    battlefields: draft.battlefields.map((battlefield) => ({ ...battlefield })),
    showdown: draft.showdown,
    combat: draft.combat,
    chain: draft.chain,
    triggered: draft.triggered,
    tasks: draft.tasks,
    effects: draft.effects,
    turnOrder: draft.turnOrder,
    stage: draft.stage,
    winner: draft.winner,
  };
}

/** The objects after the draft's changes. Ids are never reused, so key order is stable. */
function objectsOf(draft: Draft): GameState['objects'] {
  const changed = draft.changedObjects;
  if (changed.size === 0) return draft.baseObjects;
  // One pass without `delete`, which would make V8 store the copy as a slow dictionary.
  const objects: Record<ObjectId, GameObject> = {};
  const base = draft.baseObjects;
  // for…in is the fastest copy of a large record in V8; the state is plain JSON (no prototype).
  for (const key in base) {
    const id = key as ObjectId;
    const next = changed.has(id) ? changed.get(id) : base[id];
    if (next != null) objects[id] = next;
  }
  for (const [id, object] of changed) {
    if (object !== null && !(id in base)) objects[id] = object;
  }
  return objects;
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

/** A fresh id for something that is not a card object, such as an ability on the Chain (123). */
export function newId(draft: Draft): ObjectId {
  const id = `o${draft.nextObjectId}` as ObjectId;
  draft.nextObjectId += 1;
  return id;
}

/** Creates a new object (119), ready. Ids come from a counter in the state: deterministic. */
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
    exhausted: false,
    damage: 0,
    buffs: 0,
  };
  draft.nextObjectId += 1;
  draft.changedObjects.set(object.id, object);
  return object;
}

/**
 * Moves an object to or from a Non-Board Zone: it becomes a new object (124), and
 * its statuses do not follow it (124.1). The new one remembers the old in `previousObjectId`.
 */
export function renewObject(draft: Draft, id: ObjectId): GameObject {
  const old = objectOf(draft, id);
  draft.changedObjects.set(id, null);
  return createObject(draft, old.card, old.owner, old.id);
}

export function updateObject(
  draft: Draft,
  id: ObjectId,
  changes: Partial<Omit<GameObject, 'id'>>,
): void {
  draft.changedObjects.set(id, { ...objectOf(draft, id), ...changes });
}

/** The object with this id in the draft, if it exists. */
export function findObject(draft: Draft, id: ObjectId): GameObject | undefined {
  const changed = draft.changedObjects.get(id);
  return changed === undefined ? draft.baseObjects[id] : (changed ?? undefined);
}

export function objectOf(draft: Draft, id: ObjectId): GameObject {
  const object = findObject(draft, id);
  if (object === undefined) throw new EngineInvariantError(`Unknown object ${id}`);
  return object;
}

export function playerOf(draft: Draft, id: PlayerId): DraftPlayer {
  const player = draft.players.find((p) => p.id === id);
  if (player === undefined) throw new EngineInvariantError(`Unknown player ${id}`);
  return player;
}

export function opponentsOf(draft: Draft, id: PlayerId): DraftPlayer[] {
  return draft.players.filter((p) => p.id !== id);
}

export function battlefieldOf(draft: Draft, id: ObjectId): DraftBattlefield {
  const battlefield = draft.battlefields.find((b) => b.object === id);
  if (battlefield === undefined) throw new EngineInvariantError(`Unknown battlefield ${id}`);
  return battlefield;
}

/**
 * Who controls a unit. M2 has no effect that changes control, so a unit is controlled by its
 * owner; control changes (190.3.a.2) arrive with M3.
 */
export function controllerOf(draft: Draft, unit: ObjectId): PlayerId {
  return objectOf(draft, unit).owner;
}

/** The players with units at a battlefield. */
export function playersAt(draft: Draft, battlefield: DraftBattlefield): Set<PlayerId> {
  return new Set(battlefield.units.map((unit) => controllerOf(draft, unit)));
}

/** Where a unit is (146.1): a player's base, a battlefield, or neither. */
export function locationOf(
  draft: Draft,
  unit: ObjectId,
):
  | { kind: 'base'; player: PlayerId }
  | { kind: 'battlefield'; battlefield: DraftBattlefield }
  | null {
  for (const player of draft.players) {
    if (player.zones.base.includes(unit)) return { kind: 'base', player: player.id };
  }
  const battlefield = draft.battlefields.find((b) => b.units.includes(unit));
  return battlefield === undefined ? null : { kind: 'battlefield', battlefield };
}
