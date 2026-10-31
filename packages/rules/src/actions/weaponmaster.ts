// Weaponmaster (821): as its Play Effect resolves, its controller may choose an Equipment they
// control, pay the cost of its Equip ability reduced by [A], and attach it to the unit with
// Weaponmaster (821.1.c). A choice during the resolution (ADR 0020).

import type {
  CardDefinition,
  Cost,
  IllegalReason,
  ObjectId,
  PlayerId,
  Weaponmaster,
} from '@foilengine/types';
import { controllerOf, type Draft, findObject, topMostOf } from '../draft.ts';
import { payCost, useRunes } from '../resources/payment.ts';
import { attach } from './attach.ts';

/**
 * The cost of the Equip ability of a card (818.1.c): its activated ability that attaches it. Null
 * without one (821.1.c.4).
 */
export function equipCost(definition: CardDefinition): Cost | null {
  for (const ability of definition.abilities ?? []) {
    if (ability.kind === 'activated' && ability.instructions.some((i) => i.kind === 'attach')) {
      return { energy: ability.cost.energy ?? 0, power: ability.cost.power ?? [] };
    }
  }
  return null;
}

/** 821.1.c, 821.1.c.3: the Equip cost reduced by [A], if it contains [A]. */
export function reducedEquipCost(cost: Cost): Cost {
  const index = cost.power.indexOf('any');
  if (index < 0) return cost;
  return { energy: cost.energy, power: cost.power.filter((_, i) => i !== index) };
}

/**
 * The Equipment `player` controls (150.1) that Weaponmaster can attach to `unit`: on the board,
 * attached or not (725.3), with an Equip cost to pay (821.1.c.4), and not attached to `unit`
 * already (435.1.g). Choosing one that cannot be attached would change nothing (821.1.c.5).
 */
export function weaponmasterOptions(draft: Draft, player: PlayerId, unit: ObjectId): ObjectId[] {
  const units = [
    ...draft.players.flatMap((p) => p.zones.base),
    ...draft.battlefields.flatMap((b) => b.units),
  ];
  const candidates = [
    ...units,
    ...draft.battlefields.flatMap((b) => b.gear),
    ...units.flatMap((id) => findObject(draft, id)?.attached ?? []),
  ];
  return candidates.filter((id) => {
    const object = findObject(draft, id);
    const definition = object === undefined ? undefined : draft.cards[object.card];
    if (definition === undefined || !definition.tags.includes('Equipment')) return false;
    return (
      controllerOf(draft, id) === player &&
      equipCost(definition) !== null &&
      topMostOf(draft, id) !== unit
    );
  });
}

/**
 * Makes the Weaponmaster choice on the draft: none, or an option whose reduced Equip cost is paid
 * (runes adding resources first, 357.1.a), then attached. Returns why it is illegal, if it is.
 */
export function chooseWeapon(draft: Draft, action: Weaponmaster): IllegalReason | null {
  const choice = draft.resolving?.choice;
  if (choice?.kind !== 'weaponmaster') {
    return { code: 'wrong-action', message: 'No Weaponmaster choice waits', rule: '821.1.c' };
  }
  if (action.gear === null) return null;
  if (!choice.options.includes(action.gear)) {
    return {
      code: 'invalid-choice',
      message: `${action.gear} is not an Equipment this unit can be equipped with`,
      rule: '821.1.c',
    };
  }
  const definition = draft.cards[findObject(draft, action.gear)?.card as never] as CardDefinition;
  const cost = reducedEquipCost(equipCost(definition) as Cost);
  const runes = useRunes(draft, draft, action.player, action.payment ?? []);
  if (runes !== null) return runes;
  const paid = payCost(draft, action.player, cost);
  if (paid !== null) return paid;
  // 821.1.c.6: the Equip ability is not activated; the Equipment is attached (435).
  attach(draft, action.gear, choice.unit);
  return null;
}
