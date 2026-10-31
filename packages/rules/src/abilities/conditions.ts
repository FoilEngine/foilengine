// Dependent Keywords (726, 727): an ability whose Condition is not met is Inactive (727.1.b): a
// passive one does not apply (727.1.c.2), a triggered one does not trigger (727.1.c.1), an
// activated one cannot be activated (727.1.c.3). Level N: its controller has N or more XP (824).
// Legion: its controller has finalized a card other than this one this turn (812).

import {
  type AbilityCondition,
  assertNever,
  type ObjectId,
  type PlayerId,
} from '@foilengine/types';

/** What the Conditions read. */
export type ConditionContext = {
  readonly xpOf: (player: PlayerId) => number;
  /** The cards a player finalized this turn, as their objects on the Chain (812.1.c). */
  readonly finalizedBy: (player: PlayerId) => readonly ObjectId[];
  /** The object the card with the ability was on the Chain, if it was played: it is not "another card". */
  readonly self: ObjectId | null;
  /** Whether the permanent with the ability has the Empowered status (442.2). */
  readonly empowered: boolean;
};

/** Whether every Condition of the ability is met for `controller` (727.1.b.3). */
export function conditionsMet(
  requires: readonly AbilityCondition[] | undefined,
  controller: PlayerId,
  context: ConditionContext,
): boolean {
  return failedCondition(requires, controller, context) === null;
}

/** The first Condition of the ability that is not met, if any. */
export function failedCondition(
  requires: readonly AbilityCondition[] | undefined,
  controller: PlayerId,
  context: ConditionContext,
): AbilityCondition | null {
  if (requires === undefined) return null;
  const met = (condition: AbilityCondition): boolean => {
    switch (condition.kind) {
      case 'level':
        // 824.1.c, 824.1.d: active while the controller has N or more XP.
        return context.xpOf(controller) >= condition.xp;
      case 'legion':
        // 812.1.c, 812.2: a card other than this one was finalized by its controller this turn.
        return context.finalizedBy(controller).some((card) => card !== context.self);
      case 'empowered':
        // 828.1.c: active while it has the Empowered status.
        return context.empowered;
      case 'not-empowered':
        // 827.1.c.1: "Play only if not Empowered."
        return !context.empowered;
      default:
        return assertNever(condition);
    }
  };
  return requires.find((condition) => !met(condition)) ?? null;
}
