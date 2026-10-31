// The full game state. Only the server and the engine see it; players get a PlayerView.
// Pure JSON (ADR 0004). Any change to its shape increments STATE_VERSION.

import type { CardDefinition, Domain } from './cards.ts';
import type { CardId, ObjectId, PlayerId, RulesVersion } from './ids.ts';
import type { ModeId } from './setup.ts';
import type { PlayerZoneId } from './zones.ts';

export const STATE_VERSION = 9;

/** State of the seeded PRNG (ADR 0003): `xoshiro128**` and its four uint32 words. Read and advanced by `rules` only. */
export type RngState = {
  readonly algorithm: string;
  readonly state: readonly number[];
};

/** A card or token in the game (119). */
export type GameObject = {
  readonly id: ObjectId;
  readonly card: CardId;
  /** The player who brought it into the game (127.1). */
  readonly owner: PlayerId;
  /** The object it was before its last change to or from a Non-Board Zone (124), if any. */
  readonly previousObjectId: ObjectId | null;
  /** Exhausted (415) or ready (416). Only meaningful on the board; a new object starts ready. */
  readonly exhausted: boolean;
  /** Damage marked on a unit (142); a new object has none. */
  readonly damage: number;
};

export type PlayerZones = { readonly [Z in PlayerZoneId]: readonly ObjectId[] };

/**
 * Energy and Power available to pay costs (165–166). `power.any` is Power of any domain
 * ([A], 135.2.e.5.b), the Universal Power of 163.2.b. Empties at the start of each Main Phase
 * and at the end of each turn (167).
 */
export type RunePool = {
  readonly energy: number;
  readonly power: { readonly [D in Domain | 'any']: number };
};

export type PlayerState = {
  readonly id: PlayerId;
  /** Never below 0 (194.4). */
  readonly points: number;
  /** Turns this player has started; the First Turn Process of the mode depends on it (485.7). */
  readonly turnsTaken: number;
  readonly runePool: RunePool;
  /** Battlefields this player has Scored this turn: once per battlefield per turn (472). */
  readonly scoredThisTurn: readonly ObjectId[];
  /** Ordered zones list the top of the deck first. */
  readonly zones: PlayerZones;
};

/** A battlefield in the Battlefield Zone (107.2), a location (107.2.b). */
export type BattlefieldState = {
  readonly object: ObjectId;
  /** Controlled by a player, or by no one (190.2). */
  readonly controller: PlayerId | null;
  /** The player who applied the Contested status (190.3.a), or null when it is not Contested. */
  readonly contestedBy: PlayerId | null;
  /** A Showdown is Staged here (323.7), waiting for a Neutral Open State to begin (323.11). */
  readonly showdownStaged: boolean;
  /** A Combat is Staged here (323.8, 463): units of opposing players are present. */
  readonly combatStaged: boolean;
  /** Units present at this battlefield. Facedown cards (107.3) arrive later. */
  readonly units: readonly ObjectId[];
};

/** Combat damage assigned by one player to one unit (467.2.c). */
export type DamageAssignment = {
  readonly unit: ObjectId;
  readonly amount: number;
};

/** A Combat in progress (461–468). Its first step is a Combat Showdown, held in `showdown`. */
export type CombatState = {
  readonly battlefield: ObjectId;
  /** The player whose units applied Contested (466.2.c.1). */
  readonly attacker: PlayerId;
  /** The other player with units there (466.2.c.2). */
  readonly defender: PlayerId;
  /** The Combat Showdown (466), the Combat Damage Step (467), then the Resolution Step (468). */
  readonly step: 'showdown' | 'damage' | 'resolution';
  /** Damage assigned in the Combat Damage Step; null until the player has assigned it. */
  readonly attackerAssignment: readonly DamageAssignment[] | null;
  readonly defenderAssignment: readonly DamageAssignment[] | null;
  /** Units with the Attacker designation (466.2.c.3), kept up to date by cleanups (323.2). */
  readonly attackers: readonly ObjectId[];
  /** Units with the Defender designation (466.2.c.3, 323.2). */
  readonly defenders: readonly ObjectId[];
};

/** An ability on the Chain: ability `index` of the card of `source` (377.3, 383.3). */
export type ChainAbility = {
  readonly source: ObjectId;
  readonly card: CardId;
  readonly index: number;
  readonly triggered: boolean;
};

/**
 * An item on the Chain (328, 329): a card being played, or an ability. Pending until it is
 * finalized (329.2, 359.1), then Finalized. For a card, `object` is the card itself, in the
 * Chain zone (328); an ability has no card (377.3.a.1): `object` is an id of its own, and
 * `ability` says what it is (123: abilities on the Chain are game objects).
 */
export type ChainItem = {
  readonly object: ObjectId;
  readonly controller: PlayerId;
  readonly status: 'pending' | 'finalized';
  /** The chosen targets, in the order of the card's or the ability's `targets` (355.5). */
  readonly targets: readonly ObjectId[];
  readonly ability: ChainAbility | null;
};

/** A triggered ability whose Condition was met, waiting to be put on the Chain (383.3). */
export type TriggeredAbility = {
  readonly source: ObjectId;
  readonly card: CardId;
  readonly index: number;
  readonly controller: PlayerId;
};

/** The steps of a turn that run without a player decision (305, 315–317). */
export type TurnStep =
  | 'awaken'
  | 'beginning'
  | 'scoring'
  | 'channel'
  | 'draw'
  | 'main'
  | 'ending'
  | 'expiration'
  | 'next-turn';

/**
 * An Outstanding Task (333): a step that must happen before play goes on, but after the Chain
 * its predecessors created has resolved (334, 335).
 */
export type Task =
  | { readonly kind: 'turn'; readonly step: TurnStep }
  /**
   * 468.3, 468.5: the combat result and Control, once what the Combat Cleanup put on the Chain has
   * resolved (468.2). `recalled`: the Attackers were recalled (468.1.a.2).
   */
  | { readonly kind: 'combat-result'; readonly battlefield: ObjectId; readonly recalled: boolean }
  /** 468.7: the Combat ends, once what its resolution put on the Chain has resolved (468.6). */
  | {
      readonly kind: 'combat-end';
      readonly battlefield: ObjectId;
      readonly winner: PlayerId | null;
    };

/** The Chain (327–340). It exists while it holds an item (330); then the turn is Closed (331.1). */
export type ChainState = {
  /** Oldest first: items are finalized in that order (337.1.b), the newest resolves first (340.1). */
  readonly items: readonly ChainItem[];
  /** The player with Priority (312.2.c, 312.2.d). */
  readonly priority: PlayerId;
  /** Players who passed Priority in sequence since the last item was added (339.1). */
  readonly passes: number;
  /** The Chain was begun by a triggered ability: Focus does not pass when it empties (340.2.a). */
  readonly triggered: boolean;
};

/** A Showdown in progress (341–348). The turn is then in a Showdown State (343.1). */
export type ShowdownState = {
  readonly battlefield: ObjectId;
  /** The player with Focus, and so with Priority (313.2). */
  readonly focus: PlayerId;
  /** Players who passed in sequence; when all have, the Showdown ends (347.2.a). */
  readonly passes: number;
};

/** Phases of the turn (314–317). Start of Turn is split into its four phases (315.1–315.4). */
export type TurnPhase = 'awaken' | 'beginning' | 'channel' | 'draw' | 'main' | 'ending';

/** Where the game stands. */
export type GameStage =
  /** Mulligans in turn order (117): `pending` lists the players who still have to decide. */
  | { readonly kind: 'mulligan'; readonly pending: readonly PlayerId[] }
  /** A turn is in progress (301). `turnNumber` counts the turns of the game, from 1. */
  | {
      readonly kind: 'turn';
      readonly turnPlayer: PlayerId;
      readonly turnNumber: number;
      readonly phase: TurnPhase;
    }
  /** The game is over (196); `winner` says who won. */
  | { readonly kind: 'ended' };

export type GameState = {
  readonly version: typeof STATE_VERSION;
  readonly rulesVersion: RulesVersion;
  readonly mode: ModeId;
  readonly rng: RngState;
  /** Counter used to create ObjectIds deterministically. */
  readonly nextObjectId: number;
  /** Sequence number of the last event emitted. */
  readonly eventSeq: number;
  /** Definitions of the cards in this game, so that a state is self-contained. */
  readonly cards: Readonly<Record<CardId, CardDefinition>>;
  readonly objects: Readonly<Record<ObjectId, GameObject>>;
  /** In seating order. */
  readonly players: readonly PlayerState[];
  /** Looping queue of turns, starting with the First Player (115.1.c). */
  readonly turnOrder: readonly PlayerId[];
  readonly battlefields: readonly BattlefieldState[];
  /** The Showdown in progress, if any; during a Combat it is the Combat Showdown. */
  readonly showdown: ShowdownState | null;
  /** The Combat in progress, if any (461). */
  readonly combat: CombatState | null;
  /** The Chain, if it exists (330): the turn is then in a Closed State (309.1). */
  readonly chain: ChainState | null;
  /** Triggered abilities waiting to be put on the Chain (383.3), in the order they triggered. */
  readonly triggered: readonly TriggeredAbility[];
  /** Outstanding Tasks, in order (333). */
  readonly tasks: readonly Task[];
  readonly stage: GameStage;
  readonly winner: PlayerId | null;
};
