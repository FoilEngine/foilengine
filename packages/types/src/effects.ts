// The vocabulary of card effects, as plain JSON (ADR 0019): `@foilengine/cards` builds it,
// the engine interprets it. It grows with the mechanics; each building block has one
// interpreter in `rules`, with its rule numbers.

import type { PowerSymbol } from './cards.ts';

/** Keywords (800+). Each one arrives with its module. */
export type Keyword =
  /** 806: may also be played during Open States of Showdowns, on any player's turn. */
  | 'action'
  /** 813: all of Action, and may also be played during Closed States, on any player's turn. */
  | 'reaction';

/**
 * A target chosen as the card is played (355.5, 355.7). "Unit" means a unit on the board
 * (355.9.a.1); the restrictions narrow it (355.9.b).
 */
export type TargetSpec = {
  readonly kind: 'unit';
  /** "a unit at a battlefield" (355.9.b). */
  readonly at?: 'battlefield';
  /** "a friendly unit", "an enemy unit": relative to the controller of the spell. */
  readonly controller?: 'friendly' | 'enemy';
};

/** An instruction of a spell's rules text, executed from top to bottom (158.1). */
export type Instruction =
  /** "Draw X." (414.3): its controller draws. */
  | { readonly kind: 'draw'; readonly amount: number }
  /** "Deal X to [target]." (418): `target` is the index of a target of the card. */
  | { readonly kind: 'deal'; readonly amount: number; readonly target: number };

/** The cost of an activated ability (377.1): Energy, Power, and exhausting its source ([E]). */
export type AbilityCost = {
  readonly energy?: number;
  readonly power?: readonly PowerSymbol[];
  /** [E]: exhaust the permanent the ability is on (415). */
  readonly exhaustSelf?: boolean;
};

/**
 * The Condition of a triggered ability (383.2.a). For now, the named ones on a permanent about
 * itself: "When you play me" (383.4.a), "When I conquer" (383.4.c), "When I hold" (383.4.d).
 */
export type Trigger =
  | { readonly kind: 'played' }
  | { readonly kind: 'conquer' }
  | { readonly kind: 'hold' };

/** An ability of a card (361). Passive and replacement abilities arrive with the layers. */
export type Ability =
  /** "[cost]: [effect]" (377.1): activated by its controller, it uses the Chain (377.3). */
  | {
      readonly kind: 'activated';
      readonly cost: AbilityCost;
      readonly keywords?: readonly Keyword[];
      readonly targets?: readonly TargetSpec[];
      readonly instructions: readonly Instruction[];
    }
  /**
   * "When …" (383): put on the Chain when its Condition is met (383.3). Choices at finalization
   * (targets, "you may", 383.3.a) arrive later.
   */
  | {
      readonly kind: 'triggered';
      readonly trigger: Trigger;
      readonly instructions: readonly Instruction[];
    };
