// Dependent Keywords (726, 727): an ability whose Condition is not met is Inactive (727.1.b): a
// passive one does not apply (727.1.c.2), a triggered one does not trigger (727.1.c.1), an
// activated one cannot be activated (727.1.c.3). Level N: its controller has N or more XP (824).

import { type AbilityCondition, assertNever, type PlayerId } from '@foilengine/types';

/** Whether every Condition of the ability is met for `controller` (727.1.b.3). */
export function conditionsMet(
  requires: readonly AbilityCondition[] | undefined,
  controller: PlayerId,
  xpOf: (player: PlayerId) => number,
): boolean {
  if (requires === undefined) return true;
  return requires.every((condition) => {
    switch (condition.kind) {
      case 'level':
        // 824.1.c, 824.1.d: active while the controller has N or more XP.
        return xpOf(controller) >= condition.xp;
      default:
        return assertNever(condition.kind);
    }
  });
}
