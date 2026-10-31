// Deflect (809): "Spells and abilities an opponent controls that target me cost an amount of Power
// equal to my Deflect Value more to play, as an additional cost, for each time they choose me"
// (809.1.c), Power of any domain (809.1.c.1). A Mandatory Additional Cost (809.1.d, 356.2.a.2),
// paid by spells (356) and by abilities, which follow the same steps (400, 401).

import type { Cost, ObjectId, PlayerId, PowerSymbol } from '@foilengine/types';
import { controllerOf, type Draft, findObject } from '../draft.ts';
import { keywordsWith } from '../layers/characteristics.ts';

/** The Power that `controller`'s spell or ability choosing `targets` pays for Deflect. */
export function deflectCost(
  draft: Draft,
  controller: PlayerId,
  targets: readonly ObjectId[],
): PowerSymbol[] {
  let amount = 0;
  for (const target of targets) {
    if (findObject(draft, target) === undefined || controllerOf(draft, target) === controller) {
      continue;
    }
    amount += keywordsWith(draft.cards, (id) => findObject(draft, id), target).deflect;
  }
  const power: PowerSymbol[] = [];
  for (let i = 0; i < amount; i++) power.push('any');
  return power;
}

/** `cost` with the Deflect cost of `targets` added (356.2.a.2). */
export function withDeflect(
  draft: Draft,
  controller: PlayerId,
  cost: Cost,
  targets: readonly ObjectId[],
): Cost {
  if (targets.length === 0) return cost;
  const extra = deflectCost(draft, controller, targets);
  return extra.length === 0 ? cost : { energy: cost.energy, power: [...cost.power, ...extra] };
}
