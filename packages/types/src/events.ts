// Events describe what happened, in order (ADR 0005). Named in the past tense.
//
// Visibility: every event says who may see it. For the other players, the fields
// listed in PRIVATE_EVENT_FIELDS are removed (see RedactedEvent), so they learn that
// "a card was drawn" without learning which one. Object ids of private cards are
// private too: they would let a player follow a card they cannot see.

import type { CardId, ObjectId, PlayerId, RuleNumber, RulesVersion } from './ids.ts';
import type { ModeId } from './setup.ts';
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

export type GameEvent =
  | GameCreated
  | CardPlaced
  | BattlefieldSelected
  | DeckShuffled
  | TurnOrderDetermined
  | CardDrawn
  | MulliganTaken
  | CardRecycled
  | SetupCompleted;

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
} as const satisfies { readonly [T in GameEventType]: readonly (keyof EventOfType<T>)[] };

/** An event as seen by a player it is not visible to. */
export type RedactedEvent = {
  readonly [T in GameEventType]: Omit<EventOfType<T>, (typeof PRIVATE_EVENT_FIELDS)[T][number]> & {
    readonly redacted: true;
  };
}[GameEventType];

/** What a client receives: full events, or redacted ones. */
export type VisibleEvent = GameEvent | RedactedEvent;
