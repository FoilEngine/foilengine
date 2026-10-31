// Actions are player intents (docs/02-game-model.md). Named in the imperative.
// M1 only has the mulligan; the union grows with each milestone.

import type { ObjectId, PlayerId } from './ids.ts';

/** Mulligan (117): set aside up to two cards of the hand (117.1). An empty list keeps the hand. */
export type Mulligan = {
  readonly type: 'Mulligan';
  readonly player: PlayerId;
  readonly setAside: readonly ObjectId[];
};

/** The Turn Player ends their turn: they have no more Discretionary Actions to take (316.9). */
export type EndTurn = {
  readonly type: 'EndTurn';
  readonly player: PlayerId;
};

/**
 * How a rune is used to pay (164.2): exhaust it to add 1 Energy (164.2.a), or recycle it
 * to add 1 Power of its domain (164.2.b). The same rune may be exhausted, then recycled.
 */
export type RuneUse = {
  readonly rune: ObjectId;
  readonly use: 'exhaust' | 'recycle';
};

/** Where a unit enters the board (355.2): the player's base, or a battlefield they control. */
export type PlayLocation =
  | { readonly kind: 'base' }
  | { readonly kind: 'battlefield'; readonly battlefield: ObjectId };

/**
 * Plays a card (349–359): a unit or a spell from the hand, or the Chosen Champion from the
 * Champion Zone (108.3.d). It goes on the Chain (354). A unit needs a `location` (355.2); a card
 * with targets needs one per target of its definition, in order (355.5). The runes in `payment`
 * add resources in this order (357.1.a), then the pool pays the total cost (357.1). Resources
 * added beyond the cost stay in the pool.
 */
export type PlayCard = {
  readonly type: 'PlayCard';
  readonly player: PlayerId;
  readonly card: ObjectId;
  readonly location?: PlayLocation;
  readonly targets?: readonly ObjectId[];
  /** Pay the optional additional cost of Accelerate (805, 355.1.a): the unit enters ready. */
  readonly accelerate?: boolean;
  readonly payment: readonly RuneUse[];
};

/**
 * Activates ability `ability` (its index on the card) of `source`, a permanent the player
 * controls (378, 380). It goes on the Chain (377.3); it chooses one target per target of the
 * ability (403, 355.5), and pays its cost (404, 405): `payment` adds resources as for a card.
 */
export type ActivateAbility = {
  readonly type: 'ActivateAbility';
  readonly player: PlayerId;
  readonly source: ObjectId;
  readonly ability: number;
  readonly targets?: readonly ObjectId[];
  readonly payment: readonly RuneUse[];
};

/**
 * Orders the player's triggered abilities that triggered at the same time (383.3.d):
 * `order` lists the indices of the decision's abilities, the first one going on the Chain first.
 */
export type OrderTriggers = {
  readonly type: 'OrderTriggers';
  readonly player: PlayerId;
  readonly order: readonly number[];
};

/**
 * Finalizes the oldest Pending triggered ability, which its controller must make choices for
 * (337.1): `perform: false` declines a "you may" ability (383.3.a.2); otherwise `targets` holds
 * one target per target of the ability (355.5).
 */
export type FinalizeAbility = {
  readonly type: 'FinalizeAbility';
  readonly player: PlayerId;
  readonly perform: boolean;
  readonly targets?: readonly ObjectId[];
  /** How runes pay the ability's cost (383.3.b), as for a card (357.1.a). */
  readonly payment?: readonly RuneUse[];
};

/**
 * Answers a Predict decision (437.1.a): `recycle` goes to the bottom of the Main Deck (417), `top`
 * goes back on top in this order, top first. Together, they are the cards looked at.
 */
export type Predict = {
  readonly type: 'Predict';
  readonly player: PlayerId;
  readonly recycle: readonly ObjectId[];
  readonly top: readonly ObjectId[];
};

/**
 * Answers a Weaponmaster decision (821.1.c): `gear`, one of the options, attached by paying its
 * reduced Equip cost with `payment`; or `null` to choose none.
 */
export type Weaponmaster = {
  readonly type: 'Weaponmaster';
  readonly player: PlayerId;
  readonly gear: ObjectId | null;
  readonly payment?: readonly RuneUse[];
};

/** The player with Priority on a Chain passes it to the next player in turn order (338.1.b). */
export type PassPriority = {
  readonly type: 'PassPriority';
  readonly player: PlayerId;
};

/** Where units move to (144.4): a battlefield, or back to their base. */
export type MoveDestination =
  | { readonly kind: 'base' }
  | { readonly kind: 'battlefield'; readonly battlefield: ObjectId };

/**
 * Standard Move (144): exhaust ready units to move them to one destination (144.2, 144.3.a).
 * Units move from their base to a battlefield, or from a battlefield to their base (144.4).
 */
export type StandardMove = {
  readonly type: 'StandardMove';
  readonly player: PlayerId;
  readonly units: readonly ObjectId[];
  readonly destination: MoveDestination;
};

/** The player with Focus passes (347.2). */
export type PassFocus = {
  readonly type: 'PassFocus';
  readonly player: PlayerId;
};

/** A player assigns their combat damage among the opposing units (467.2.c). */
export type AssignCombatDamage = {
  readonly type: 'AssignCombatDamage';
  readonly player: PlayerId;
  readonly assignment: readonly { readonly unit: ObjectId; readonly amount: number }[];
};

/** A player concedes; they may do so at any time (650). */
export type Concede = {
  readonly type: 'Concede';
  readonly player: PlayerId;
};

export type Action =
  | Mulligan
  | EndTurn
  | PlayCard
  | StandardMove
  | PassFocus
  | PassPriority
  | ActivateAbility
  | OrderTriggers
  | FinalizeAbility
  | Predict
  | Weaponmaster
  | AssignCombatDamage
  | Concede;

export type ActionType = Action['type'];
