// Events describe what happened, in order (ADR 0005). Named in the past tense.
//
// Visibility: every event says who may see it. For the other players, the fields
// listed in PRIVATE_EVENT_FIELDS are removed (see RedactedEvent), so they learn that
// "a card was drawn" without learning which one. Object ids of private cards are
// private too: they would let a player follow a card they cannot see.

import type { Domain } from './cards.ts';
import type { CardId, ObjectId, PlayerId, RuleNumber, RulesVersion } from './ids.ts';
import type { ModeId } from './setup.ts';
import type { TurnPhase } from './state.ts';
import type { PlayerZoneId } from './zones.ts';

export type Visibility =
  | { readonly kind: 'public' }
  /** Only these players see the private fields; the others get the redacted event. */
  | { readonly kind: 'private'; readonly to: readonly PlayerId[] };

type EventBase = {
  /** Increasing sequence number within the game. */
  readonly seq: number;
  /** The rule that produced the event, when there is one. */
  readonly rule: RuleNumber | null;
  readonly visibility: Visibility;
};

/** The game was created (110). */
export type GameCreated = EventBase & {
  readonly type: 'GameCreated';
  readonly mode: ModeId;
  readonly rulesVersion: RulesVersion;
  readonly players: readonly PlayerId[];
};

/** A card was put into a zone during setup: legend (111), champion (112). */
export type CardPlaced = EventBase & {
  readonly type: 'CardPlaced';
  readonly player: PlayerId;
  readonly object: ObjectId;
  readonly card: CardId;
  readonly zone: PlayerZoneId;
};

/** A battlefield was selected for this game and placed in the Battlefield Zone (113, 487.5). */
export type BattlefieldSelected = EventBase & {
  readonly type: 'BattlefieldSelected';
  readonly player: PlayerId;
  readonly object: ObjectId;
  readonly card: CardId;
};

/** A deck was shuffled (114). */
export type DeckShuffled = EventBase & {
  readonly type: 'DeckShuffled';
  readonly player: PlayerId;
  readonly zone: 'mainDeck' | 'runeDeck';
  readonly size: number;
};

/** Turn order was determined (115). */
export type TurnOrderDetermined = EventBase & {
  readonly type: 'TurnOrderDetermined';
  readonly order: readonly PlayerId[];
};

/** A card was drawn from the Main Deck into the hand (116, 117.2). */
export type CardDrawn = EventBase & {
  readonly type: 'CardDrawn';
  readonly player: PlayerId;
  readonly object: ObjectId;
  readonly card: CardId;
};

/** A player took their mulligan (117), setting aside `count` cards. */
export type MulliganTaken = EventBase & {
  readonly type: 'MulliganTaken';
  readonly player: PlayerId;
  readonly count: number;
};

/** A card was recycled to the bottom of its deck (117.3). */
export type CardRecycled = EventBase & {
  readonly type: 'CardRecycled';
  readonly player: PlayerId;
  readonly object: ObjectId;
  readonly previousObject: ObjectId;
  readonly card: CardId;
  readonly from: PlayerZoneId;
  readonly to: 'mainDeck' | 'runeDeck';
};

/** Setup is over and the First Player takes their turn (118). */
export type SetupCompleted = EventBase & {
  readonly type: 'SetupCompleted';
  readonly firstPlayer: PlayerId;
};

/** Resources, as added to or removed from a Rune Pool. */
export type Resources = {
  readonly energy: number;
  readonly power: { readonly [D in Domain | 'any']?: number };
};

/** A game object on the board was exhausted (415). */
export type ObjectExhausted = EventBase & {
  readonly type: 'ObjectExhausted';
  readonly player: PlayerId;
  readonly object: ObjectId;
};

/** Resources were added to a player's Rune Pool (430, 166.1). */
export type ResourcesAdded = EventBase & {
  readonly type: 'ResourcesAdded';
  readonly player: PlayerId;
  /** The rune whose ability added them. */
  readonly source: ObjectId;
  readonly resources: Resources;
};

/** Resources were paid from a player's Rune Pool (445, 357.1). */
export type ResourcesPaid = EventBase & {
  readonly type: 'ResourcesPaid';
  readonly player: PlayerId;
  readonly resources: Resources;
};

/** A Rune Pool emptied (167); the unspent resources are lost (167.1). */
export type RunePoolEmptied = EventBase & {
  readonly type: 'RunePoolEmptied';
  readonly player: PlayerId;
  readonly lost: Resources;
};

/** A card was played (349–359). For a unit: it entered the board, exhausted (359.2.c). */
export type CardPlayed = EventBase & {
  readonly type: 'CardPlayed';
  readonly player: PlayerId;
  /** The new object on the board. */
  readonly object: ObjectId;
  /** The object the card was in the zone it was played from (hand, Champion Zone). */
  readonly previousObject: ObjectId;
  readonly card: CardId;
  readonly from: PlayerZoneId;
  /** The battlefield it entered, or null for its controller's base. */
  readonly battlefield: ObjectId | null;
};

/** Units moved to one destination (144, 448). */
export type UnitsMoved = EventBase & {
  readonly type: 'UnitsMoved';
  readonly player: PlayerId;
  readonly units: readonly ObjectId[];
  /** The battlefield they moved to, or null for their base. */
  readonly battlefield: ObjectId | null;
};

/** A battlefield became Contested (190.3.a, 452). */
export type BattlefieldContested = EventBase & {
  readonly type: 'BattlefieldContested';
  readonly player: PlayerId;
  readonly battlefield: ObjectId;
};

/** A Showdown began at a battlefield; `focus` gains Focus (344, 345). */
export type ShowdownStarted = EventBase & {
  readonly type: 'ShowdownStarted';
  readonly battlefield: ObjectId;
  readonly focus: PlayerId;
};

/** The player with Focus passed (347.2); `next` gains Focus, or null when the Showdown ends. */
export type FocusPassed = EventBase & {
  readonly type: 'FocusPassed';
  readonly player: PlayerId;
  readonly next: PlayerId | null;
};

/** A Showdown closed (348). */
export type ShowdownEnded = EventBase & {
  readonly type: 'ShowdownEnded';
  readonly battlefield: ObjectId;
};

/** A player established Control of a battlefield (190.4, 348.2.a). */
export type ControlEstablished = EventBase & {
  readonly type: 'ControlEstablished';
  readonly player: PlayerId;
  readonly battlefield: ObjectId;
};

/** A player lost Control of a battlefield (190.4.c, 323.5). */
export type ControlLost = EventBase & {
  readonly type: 'ControlLost';
  readonly player: PlayerId;
  readonly battlefield: ObjectId;
};

/** A player Scored a battlefield, by Conquer or Hold (471). */
export type BattlefieldScored = EventBase & {
  readonly type: 'BattlefieldScored';
  readonly player: PlayerId;
  readonly battlefield: ObjectId;
  readonly method: 'conquer' | 'hold';
};

/** A Combat began at a battlefield, with its Attacker and Defender (466.2.c). */
export type CombatStarted = EventBase & {
  readonly type: 'CombatStarted';
  readonly battlefield: ObjectId;
  readonly attacker: PlayerId;
  readonly defender: PlayerId;
};

/** A player assigned their combat damage (467.2.c). */
export type DamageAssigned = EventBase & {
  readonly type: 'DamageAssigned';
  readonly player: PlayerId;
  readonly assignment: readonly { readonly unit: ObjectId; readonly amount: number }[];
};

/** Damage was dealt to units, at the same time (418, 467.2.d). */
export type DamageDealt = EventBase & {
  readonly type: 'DamageDealt';
  readonly damage: readonly { readonly unit: ObjectId; readonly amount: number }[];
};

/** A unit was killed: it went from the board to its owner's trash as a new object (429, 124). */
export type UnitKilled = EventBase & {
  readonly type: 'UnitKilled';
  readonly player: PlayerId;
  readonly unit: ObjectId;
  /** The new object in the trash. */
  readonly object: ObjectId;
  readonly card: CardId;
};

/**
 * A token was played (350.2): created, it entered its controller's base (184.2) without a cost
 * (185.3.a.1). See Q-003 in docs/rules/questions.md for when it enters.
 */
export type TokenPlayed = EventBase & {
  readonly type: 'TokenPlayed';
  readonly player: PlayerId;
  readonly object: ObjectId;
  readonly card: CardId;
};

/** A token put into a Non-Board Zone other than the Chain ceased to exist (186.1). */
export type TokenCeasedToExist = EventBase & {
  readonly type: 'TokenCeasedToExist';
  readonly object: ObjectId;
  readonly card: CardId;
};

/** A gear was Attached to a unit, its Top-Most Card (435.1); with Equip, it Equipped it (818.2). */
export type GearAttached = EventBase & {
  readonly type: 'GearAttached';
  readonly player: PlayerId;
  readonly gear: ObjectId;
  readonly unit: ObjectId;
};

/** A gear was Detached from its Top-Most Card (436), at its location (436.4). */
export type GearDetached = EventBase & {
  readonly type: 'GearDetached';
  readonly gear: ObjectId;
  readonly unit: ObjectId;
};

/** Gear at a battlefield were recalled to their controller's base (323.6, 459.1), not a Move. */
export type GearRecalled = EventBase & {
  readonly type: 'GearRecalled';
  readonly player: PlayerId;
  readonly gear: readonly ObjectId[];
};

/** A player Predicts: they look at the top `count` cards of their Main Deck (437.1). */
export type Predicted = EventBase & {
  readonly type: 'Predicted';
  readonly player: PlayerId;
  readonly count: number;
};

/** A permanent became Empowered (442.1, 442.2.a, 827.2). */
export type ObjectEmpowered = EventBase & {
  readonly type: 'ObjectEmpowered';
  readonly player: PlayerId;
  readonly object: ObjectId;
};

/** A player gained XP (730.1); `xp` is their new total. */
export type XpGained = EventBase & {
  readonly type: 'XpGained';
  readonly player: PlayerId;
  readonly amount: number;
  readonly xp: number;
};

/** Units were healed: their damage was cleared (419). */
export type UnitsHealed = EventBase & {
  readonly type: 'UnitsHealed';
  readonly units: readonly ObjectId[];
};

/** Units were recalled to their base, which is not a Move (456–460). */
export type UnitsRecalled = EventBase & {
  readonly type: 'UnitsRecalled';
  readonly player: PlayerId;
  readonly units: readonly ObjectId[];
};

/** A Combat ended (468.7); `winner` is the player who won it (468.3.a), or null for No Result. */
export type CombatEnded = EventBase & {
  readonly type: 'CombatEnded';
  readonly battlefield: ObjectId;
  readonly winner: PlayerId | null;
};

/** A player conceded and was removed from the game (651). */
export type PlayerConceded = EventBase & {
  readonly type: 'PlayerConceded';
  readonly player: PlayerId;
};

/**
 * A card was put on the Chain to be played (354): it left its zone and is a new object there
 * (124). The card is revealed: the Chain is public (108.1.b).
 */
export type ChainItemAdded = EventBase & {
  readonly type: 'ChainItemAdded';
  readonly player: PlayerId;
  readonly object: ObjectId;
  readonly previousObject: ObjectId;
  readonly card: CardId;
  readonly from: PlayerZoneId;
  readonly targets: readonly ObjectId[];
};

/**
 * An ability was put on the Chain, Pending: activated by `player` (377.3.a), or triggered
 * (383.3). It has no card; `object` is its id on the Chain.
 */
export type AbilityAdded = EventBase & {
  readonly type: 'AbilityAdded';
  readonly player: PlayerId;
  readonly object: ObjectId;
  readonly source: ObjectId;
  readonly card: CardId;
  readonly index: number;
  readonly triggered: boolean;
  readonly targets: readonly ObjectId[];
};

/**
 * A Pending item left the Chain without being finalized: a "you may" ability its controller
 * declined (383.3.a.2), or an ability with no valid target (355.8, 358.5).
 */
export type ChainItemRemoved = EventBase & {
  readonly type: 'ChainItemRemoved';
  readonly player: PlayerId;
  readonly object: ObjectId;
};

/** A Pending Chain Item became a Finalized one (329.3, 359.1). */
export type ChainItemFinalized = EventBase & {
  readonly type: 'ChainItemFinalized';
  readonly object: ObjectId;
};

/** The player with Priority passed it to the next player in turn order (338.1.b). */
export type PriorityPassed = EventBase & {
  readonly type: 'PriorityPassed';
  readonly player: PlayerId;
  readonly next: PlayerId;
};

/**
 * The newest Finalized Chain Item resolved (340.1). A spell then goes to its owner's trash as a
 * new object (157, 124): `trashed`.
 */
export type ChainItemResolved = EventBase & {
  readonly type: 'ChainItemResolved';
  readonly player: PlayerId;
  readonly object: ObjectId;
  readonly card: CardId;
  readonly trashed: ObjectId | null;
};

/** A unit got a buff (702.2.a). */
export type UnitBuffed = EventBase & {
  readonly type: 'UnitBuffed';
  readonly unit: ObjectId;
};

/** A unit got +X or -X [M] until the end of the turn (479.4). */
export type MightGiven = EventBase & {
  readonly type: 'MightGiven';
  readonly unit: ObjectId;
  readonly amount: number;
};

/** All "this turn" effects expired (317.2.c). */
export type EffectsExpired = EventBase & {
  readonly type: 'EffectsExpired';
  readonly count: number;
};

/** A turn began (301, 315). */
export type TurnStarted = EventBase & {
  readonly type: 'TurnStarted';
  readonly player: PlayerId;
  readonly turnNumber: number;
};

/** A phase of the turn began (314–317). */
export type PhaseStarted = EventBase & {
  readonly type: 'PhaseStarted';
  readonly player: PlayerId;
  readonly phase: TurnPhase;
};

/** Game objects on the board were readied (416). */
export type ObjectsReadied = EventBase & {
  readonly type: 'ObjectsReadied';
  readonly player: PlayerId;
  readonly objects: readonly ObjectId[];
};

/** A rune was channeled from the top of the Rune Deck onto the board (431). */
export type RuneChanneled = EventBase & {
  readonly type: 'RuneChanneled';
  readonly player: PlayerId;
  readonly object: ObjectId;
  readonly card: CardId;
  readonly exhausted: boolean;
};

/** A player Burned Out (432): they had to take cards from an empty Main Deck. */
export type BurnedOut = EventBase & {
  readonly type: 'BurnedOut';
  readonly player: PlayerId;
  /** The opponent chosen to gain 1 point (432.2.c). */
  readonly opponent: PlayerId;
};

/** A player gained points (194.1). */
export type PointsGained = EventBase & {
  readonly type: 'PointsGained';
  readonly player: PlayerId;
  readonly amount: number;
  readonly total: number;
};

/** The Turn Player ended their turn (316.9, 317). */
export type TurnEnded = EventBase & {
  readonly type: 'TurnEnded';
  readonly player: PlayerId;
  readonly turnNumber: number;
};

/** A player won the game (194.2, 195); the game ends (196). */
export type GameWon = EventBase & {
  readonly type: 'GameWon';
  readonly player: PlayerId;
};

export type GameEvent =
  | GameCreated
  | CardPlaced
  | BattlefieldSelected
  | DeckShuffled
  | TurnOrderDetermined
  | CardDrawn
  | MulliganTaken
  | CardRecycled
  | SetupCompleted
  | TurnStarted
  | PhaseStarted
  | ObjectsReadied
  | RuneChanneled
  | BurnedOut
  | PointsGained
  | TurnEnded
  | GameWon
  | ObjectExhausted
  | ResourcesAdded
  | ResourcesPaid
  | RunePoolEmptied
  | CardPlayed
  | UnitsMoved
  | BattlefieldContested
  | ShowdownStarted
  | FocusPassed
  | ShowdownEnded
  | ControlEstablished
  | ControlLost
  | BattlefieldScored
  | CombatStarted
  | DamageAssigned
  | DamageDealt
  | UnitKilled
  | TokenPlayed
  | TokenCeasedToExist
  | GearAttached
  | GearDetached
  | GearRecalled
  | Predicted
  | XpGained
  | ObjectEmpowered
  | UnitsHealed
  | UnitsRecalled
  | CombatEnded
  | PlayerConceded
  | ChainItemAdded
  | ChainItemFinalized
  | PriorityPassed
  | ChainItemResolved
  | AbilityAdded
  | ChainItemRemoved
  | UnitBuffed
  | MightGiven
  | EffectsExpired;

export type GameEventType = GameEvent['type'];

export type EventOfType<T extends GameEventType> = Extract<GameEvent, { readonly type: T }>;

/** Fields removed from an event for the players it is not visible to. */
export const PRIVATE_EVENT_FIELDS = {
  GameCreated: [],
  CardPlaced: [],
  BattlefieldSelected: [],
  DeckShuffled: [],
  TurnOrderDetermined: [],
  CardDrawn: ['object', 'card'],
  MulliganTaken: [],
  CardRecycled: ['object', 'previousObject', 'card'],
  SetupCompleted: [],
  TurnStarted: [],
  PhaseStarted: [],
  ObjectsReadied: [],
  RuneChanneled: [],
  BurnedOut: [],
  PointsGained: [],
  TurnEnded: [],
  GameWon: [],
  ObjectExhausted: [],
  ResourcesAdded: [],
  ResourcesPaid: [],
  RunePoolEmptied: [],
  CardPlayed: [],
  UnitsMoved: [],
  BattlefieldContested: [],
  ShowdownStarted: [],
  FocusPassed: [],
  ShowdownEnded: [],
  ControlEstablished: [],
  ControlLost: [],
  BattlefieldScored: [],
  CombatStarted: [],
  DamageAssigned: [],
  DamageDealt: [],
  UnitKilled: [],
  TokenPlayed: [],
  TokenCeasedToExist: [],
  GearAttached: [],
  GearDetached: [],
  GearRecalled: [],
  Predicted: [],
  XpGained: [],
  ObjectEmpowered: [],
  UnitsHealed: [],
  UnitsRecalled: [],
  CombatEnded: [],
  PlayerConceded: [],
  ChainItemAdded: [],
  ChainItemFinalized: [],
  PriorityPassed: [],
  ChainItemResolved: [],
  AbilityAdded: [],
  ChainItemRemoved: [],
  UnitBuffed: [],
  MightGiven: [],
  EffectsExpired: [],
} as const satisfies { readonly [T in GameEventType]: readonly (keyof EventOfType<T>)[] };

/** An event as seen by a player it is not visible to. */
export type RedactedEvent = {
  readonly [T in GameEventType]: Omit<EventOfType<T>, (typeof PRIVATE_EVENT_FIELDS)[T][number]> & {
    readonly redacted: true;
  };
}[GameEventType];

/** What a client receives: full events, or redacted ones. */
export type VisibleEvent = GameEvent | RedactedEvent;
