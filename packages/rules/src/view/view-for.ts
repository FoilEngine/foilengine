// viewFor (ADR 0006): what one player is allowed to see. The server sends this, never the state.
// Privacy follows the zones (107–108, 128): hands are private to their owner (108.7.c),
// decks are secret to everyone, their owner included (108.4.e, 108.5.d), the rest is public.
// Objects are shown without `previousObjectId`, which could link a public card to a hidden one.

import type {
  GameObject,
  GameState,
  ObjectId,
  OpponentView,
  OpponentZones,
  OwnZones,
  PlayerId,
  PlayerState,
  PlayerView,
  VisibleObject,
} from '@foilengine/types';
import { pendingDecision } from '../engine.ts';
import { EngineInvariantError } from '../errors.ts';

export function viewFor(state: GameState, viewer: PlayerId): PlayerView {
  const self = state.players.find((player) => player.id === viewer);
  if (self === undefined) throw new EngineInvariantError(`${viewer} is not a player of this game`);

  const visible = (ids: readonly ObjectId[]): VisibleObject[] =>
    ids.map((id) => show(objectOf(state, id)));
  const publicZones = (player: PlayerState) => ({
    base: visible(player.zones.base),
    legendZone: visible(player.zones.legendZone),
    championZone: visible(player.zones.championZone),
    trash: visible(player.zones.trash),
    banishment: visible(player.zones.banishment),
    mainDeck: { size: player.zones.mainDeck.length },
    runeDeck: { size: player.zones.runeDeck.length },
  });

  const ownZones: OwnZones = { ...publicZones(self), hand: visible(self.zones.hand) };
  const opponents: OpponentView[] = state.players
    .filter((player) => player.id !== viewer)
    .map((player) => {
      const zones: OpponentZones = {
        ...publicZones(player),
        hand: { size: player.zones.hand.length },
      };
      return { id: player.id, points: player.points, zones };
    });

  const decision = pendingDecision(state);
  return {
    viewer,
    rulesVersion: state.rulesVersion,
    mode: state.mode,
    self: { id: self.id, points: self.points, zones: ownZones },
    opponents,
    turnOrder: state.turnOrder,
    battlefields: state.battlefields.map((battlefield) =>
      show(objectOf(state, battlefield.object)),
    ),
    stage: state.stage,
    decision: decision !== null && decision.player === viewer ? decision : null,
    winner: state.winner,
  };
}

function show(object: GameObject): VisibleObject {
  return { id: object.id, card: object.card, owner: object.owner };
}

function objectOf(state: GameState, id: ObjectId): GameObject {
  const object = state.objects[id];
  if (object === undefined) throw new EngineInvariantError(`Unknown object ${id}`);
  return object;
}
