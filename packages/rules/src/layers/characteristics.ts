// Characteristics (475–482): an object's traits are never stored "computed". They are derived on
// read from its printed values and the continuous effects that apply to it, layer by layer (479).
// For now: the Might of units, in the Arithmetic layer (479.4), from passive abilities of
// permanents on the board (363–365), continuous effects of spells and abilities (476), and buffs
// (703). Copy, trait- and ability-altering effects (479.1–479.3) and dependencies (480, 481)
// arrive with the cards that need them.

import type {
  CardDefinition,
  ContinuousEffect,
  GameObject,
  GameState,
  ObjectId,
  PlayerId,
} from '@foilengine/types';
import { controllerOf, type Draft, findObject } from '../draft.ts';

/** What the layers need to read, from a state or from a draft. */
export type BoardReader = {
  readonly cards: GameState['cards'];
  readonly effects: readonly ContinuousEffect[];
  objectAt(id: ObjectId): GameObject | undefined;
  /** Units on the board: in bases and at battlefields. */
  unitsOnBoard(): readonly ObjectId[];
  /** Units on the board with a passive ability (365.1). */
  passiveSources(): readonly ObjectId[];
  controllerOf(id: ObjectId): PlayerId;
};

export type Characteristics = {
  /** A unit's Effective Might (143.2.a); null for an object that is not a unit. */
  readonly might: number | null;
};

/** Every object on the board: in bases and at battlefields (runes included). */
const onBoard = (
  players: readonly { readonly zones: { readonly base: readonly ObjectId[] } }[],
  battlefields: readonly { readonly units: readonly ObjectId[] }[],
): ObjectId[] => [...players.flatMap((p) => p.zones.base), ...battlefields.flatMap((b) => b.units)];

/** Computes `compute()` once, on first use: a reader is read many times, the board does not change. */
function once<T>(compute: () => T): () => T {
  let value: { readonly v: T } | null = null;
  return () => {
    value ??= { v: compute() };
    return value.v;
  };
}

/** The board part of a reader, each list computed once. */
function boardOf(
  ids: () => readonly ObjectId[],
  cards: GameState['cards'],
  objectAt: (id: ObjectId) => GameObject | undefined,
): Pick<BoardReader, 'unitsOnBoard' | 'passiveSources'> {
  const definitionOf = (id: ObjectId) =>
    cards[objectAt(id)?.card as never] as CardDefinition | undefined;
  return {
    unitsOnBoard: once(() => ids().filter((id) => definitionOf(id)?.category === 'unit')),
    passiveSources: once(() =>
      ids().filter((id) =>
        (definitionOf(id)?.abilities ?? []).some((ability) => ability.kind === 'passive'),
      ),
    ),
  };
}

export function readerOfState(state: GameState): BoardReader {
  const objectAt = (id: ObjectId) => state.objects[id];
  return {
    cards: state.cards,
    effects: state.effects,
    objectAt,
    ...boardOf(() => onBoard(state.players, state.battlefields), state.cards, objectAt),
    // No effect changes control yet: a unit is controlled by its owner (190.3.a.2 arrives later).
    controllerOf: (id) => state.objects[id]?.owner as PlayerId,
  };
}

export function readerOfDraft(draft: Draft): BoardReader {
  const objectAt = (id: ObjectId) => findObject(draft, id);
  return {
    cards: draft.cards,
    effects: draft.effects,
    objectAt,
    ...boardOf(() => onBoard(draft.players, draft.battlefields), draft.cards, objectAt),
    controllerOf: (id) => controllerOf(draft, id),
  };
}

/**
 * The Might of unit `id`, layers applied (479): its printed Might, then the Arithmetic layer
 * (479.4): the passive abilities of permanents on the board that apply to it (365.1), the
 * continuous effects that target it, and +1 per buff (703). Within the layer, increases apply
 * before decreases (479.4.e); with plain additions, as here, the order does not change the result.
 */
export function characteristicsWith(reader: BoardReader, id: ObjectId): Characteristics {
  const object = reader.objectAt(id);
  const definition =
    object === undefined ? undefined : (reader.cards[object.card] as CardDefinition);
  if (object === undefined || definition?.category !== 'unit') return { might: null };
  // Buffs and effects only ever apply to objects on the board: an object that leaves it becomes a
  // new object, without buffs (705, 124), that no effect targets.
  let might = (definition.might ?? 0) + object.buffs; // 703
  for (const effect of reader.effects) if (effect.target === id) might += effect.might;
  const sources = reader.passiveSources();
  if (sources.length > 0 && reader.unitsOnBoard().includes(id)) {
    const controller = reader.controllerOf(id);
    for (const source of sources) {
      const card = reader.cards[reader.objectAt(source)?.card as never] as
        | CardDefinition
        | undefined;
      for (const ability of card?.abilities ?? []) {
        if (ability.kind !== 'passive') continue;
        const applies =
          ability.affects === 'self'
            ? source === id
            : source !== id && reader.controllerOf(source) === controller;
        if (applies) might += ability.might;
      }
    }
  }
  return { might };
}

/** The characteristics of an object of the state (public API, docs/03-rules-engine.md). */
export function characteristics(state: GameState, id: ObjectId): Characteristics {
  return characteristicsWith(readerOfState(state), id);
}
