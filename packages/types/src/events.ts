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
  readonly to: PlayerZoneId;
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
  | CardPlayed;

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
} as const satisfies { readonly [T in GameEventType]: readonly (keyof EventOfType<T>)[] };

/** An event as seen by a player it is not visible to. */
export type RedactedEvent = {
  readonly [T in GameEventType]: Omit<EventOfType<T>, (typeof PRIVATE_EVENT_FIELDS)[T][number]> & {
    readonly redacted: true;
  };
}[GameEventType];

/** What a client receives: full events, or redacted ones. */
export type VisibleEvent = GameEvent | RedactedEvent;
