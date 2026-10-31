// viewFor (ADR 0006): what one player is allowed to see. The server sends this, never the state.
// Privacy follows the zones (107–108, 128): hands are private to their owner (108.7.c),
// decks are secret to everyone, their owner included (108.4.e, 108.5.d), the rest is public:
// bases (107.1.d), battlefields and the permanents there (107.2.c).
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
      return {
        id: player.id,
        points: player.points,
        runePool: player.runePool,
        scoredThisTurn: player.scoredThisTurn,
        zones,
      };
    });

  const decision = pendingDecision(state);
  return {
    viewer,
    rulesVersion: state.rulesVersion,
    mode: state.mode,
    self: {
      id: self.id,
      points: self.points,
      runePool: self.runePool,
      scoredThisTurn: self.scoredThisTurn,
      zones: ownZones,
    },
    opponents,
    turnOrder: state.turnOrder,
    battlefields: state.battlefields.map((battlefield) => ({
      object: show(objectOf(state, battlefield.object)),
      controller: battlefield.controller,
      contestedBy: battlefield.contestedBy,
      showdownStaged: battlefield.showdownStaged,
      combatStaged: battlefield.combatStaged,
      units: visible(battlefield.units),
    })),
    showdown: state.showdown,
    combat: state.combat,
    // 108.1.b: the cards on the Chain are public.
    chain:
      state.chain === null
        ? null
        : {
            items: state.chain.items.map((item) => ({
              object: item.ability === null ? show(objectOf(state, item.object)) : null,
              ability: item.ability,
              controller: item.controller,
              status: item.status,
              targets: item.targets,
            })),
            priority: state.chain.priority,
            passes: state.chain.passes,
          },
    triggered: state.triggered,
    stage: state.stage,
    decision: decision !== null && decision.player === viewer ? decision : null,
    winner: state.winner,
  };
}

function show(object: GameObject): VisibleObject {
  return {
    id: object.id,
    card: object.card,
    owner: object.owner,
    exhausted: object.exhausted,
    damage: object.damage,
  };
}

function objectOf(state: GameState, id: ObjectId): GameObject {
  const object = state.objects[id];
  if (object === undefined) throw new EngineInvariantError(`Unknown object ${id}`);
  return object;
}
