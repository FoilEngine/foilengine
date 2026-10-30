// @foilengine/types: shared types and constants. No logic (packages/types/CLAUDE.md).

export type {
  Action,
  ActionType,
  AssignCombatDamage,
  Concede,
  EndTurn,
  MoveDestination,
  Mulligan,
  PassFocus,
  PlayCard,
  PlayLocation,
  RuneUse,
  StandardMove,
} from './actions.ts';
export {
  type CardCategory,
  type CardDefinition,
  type Cost,
  DOMAINS,
  type Domain,
  type PowerSymbol,
  type Supertype,
} from './cards.ts';
export type {
  AssignDamageDecision,
  Decision,
  FocusDecision,
  MulliganDecision,
  PriorityDecision,
} from './decisions.ts';
export {
  type BattlefieldContested,
  type BattlefieldScored,
  type BattlefieldSelected,
  type BurnedOut,
  type CardDrawn,
  type CardPlaced,
  type CardPlayed,
  type CardRecycled,
  type CombatEnded,
  type CombatStarted,
  type ControlEstablished,
  type ControlLost,
  type DamageAssigned,
  type DamageDealt,
  type DeckShuffled,
  type EventOfType,
  type FocusPassed,
  type GameCreated,
  type GameEvent,
  type GameEventType,
  type GameWon,
  type MulliganTaken,
  type ObjectExhausted,
  type ObjectsReadied,
  type PhaseStarted,
  type PlayerConceded,
  type PointsGained,
  PRIVATE_EVENT_FIELDS,
  type RedactedEvent,
  type Resources,
  type ResourcesAdded,
  type ResourcesPaid,
  type RuneChanneled,
  type RunePoolEmptied,
  type SetupCompleted,
  type ShowdownEnded,
  type ShowdownStarted,
  type TurnEnded,
  type TurnOrderDetermined,
  type TurnStarted,
  type UnitKilled,
  type UnitsHealed,
  type UnitsMoved,
  type UnitsRecalled,
  type Visibility,
  type VisibleEvent,
} from './events.ts';
export type { CardId, ObjectId, PlayerId, RuleNumber, RulesVersion, Seed } from './ids.ts';
export type { Json } from './json.ts';
export type { IllegalCode, IllegalReason, SetupProblem, SetupProblemCode } from './problems.ts';
export type { DeckList, GameSetup, ModeId, PlayerSetup } from './setup.ts';
export {
  type BattlefieldState,
  type CombatState,
  type DamageAssignment,
  type GameObject,
  type GameStage,
  type GameState,
  type PlayerState,
  type PlayerZones,
  type RngState,
  type RunePool,
  type ShowdownState,
  STATE_VERSION,
  type TurnPhase,
} from './state.ts';
export type {
  BattlefieldView,
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
