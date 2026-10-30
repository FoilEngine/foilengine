// @foilengine/types: shared types and constants. No logic (packages/types/CLAUDE.md).

export type { Action, ActionType, EndTurn, Mulligan } from './actions.ts';
export type { CardCategory, CardDefinition, Domain, Supertype } from './cards.ts';
export type { Decision, MulliganDecision, PriorityDecision } from './decisions.ts';
export {
  type BattlefieldSelected,
  type BurnedOut,
  type CardDrawn,
  type CardPlaced,
  type CardRecycled,
  type DeckShuffled,
  type EventOfType,
  type GameCreated,
  type GameEvent,
  type GameEventType,
  type GameWon,
  type MulliganTaken,
  type ObjectsReadied,
  type PhaseStarted,
  type PointsGained,
  PRIVATE_EVENT_FIELDS,
  type RedactedEvent,
  type RuneChanneled,
  type SetupCompleted,
  type TurnEnded,
  type TurnOrderDetermined,
  type TurnStarted,
  type Visibility,
  type VisibleEvent,
} from './events.ts';
export type { CardId, ObjectId, PlayerId, RuleNumber, RulesVersion, Seed } from './ids.ts';
export type { Json } from './json.ts';
export type { IllegalCode, IllegalReason, SetupProblem, SetupProblemCode } from './problems.ts';
export type { DeckList, GameSetup, ModeId, PlayerSetup } from './setup.ts';
export {
  type BattlefieldState,
  type GameObject,
  type GameStage,
  type GameState,
  type PlayerState,
  type PlayerZones,
  type RngState,
  STATE_VERSION,
  type TurnPhase,
} from './state.ts';
export type {
  HiddenZone,
  OpponentView,
  OpponentZones,
  OwnZones,
  PlayerView,
  SelfView,
  VisibleObject,
} from './views.ts';
export {
  ORDERED_PLAYER_ZONES,
  PLAYER_ZONE_PRIVACY,
  type PlayerZoneId,
  type Privacy,
} from './zones.ts';

/** Exhaustiveness check for discriminated unions: `default: return assertNever(x)`. */
export function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${JSON.stringify(value)}`);
}
