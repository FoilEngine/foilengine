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
 * Plays a card (349–359). In M2: a unit from the hand, or the Chosen Champion from the
 * Champion Zone (108.3.d). The runes in `payment` add resources in this order (357.1.a),
 * then the pool pays the total cost (357.1). Resources added beyond the cost stay in the pool.
 */
export type PlayCard = {
  readonly type: 'PlayCard';
  readonly player: PlayerId;
  readonly card: ObjectId;
  readonly location: PlayLocation;
  readonly payment: readonly RuneUse[];
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
  | AssignCombatDamage
  | Concede;

export type ActionType = Action['type'];
