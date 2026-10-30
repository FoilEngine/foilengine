// Using runes to pay (164.2, 357.1.a): exhaust a rune to add 1 Energy, recycle it to add
// 1 Power of its domain. Rune abilities that Add resources resolve at once (430.2).

import type {
  CardDefinition,
  Cost,
  Domain,
  GameState,
  IllegalReason,
  ObjectId,
  PlayerId,
  RuneUse,
} from '@foilengine/types';
import { type Draft, emit, objectOf, playerOf, renewObject, updateObject } from '../draft.ts';
import { EngineInvariantError } from '../errors.ts';
import { payFromPool } from './rune-pool.ts';

/** The Power a rune adds when recycled: its domain; [A] for a domainless one (135.2.e.6.b). */
export function powerOfRune(definition: CardDefinition): Domain | 'any' {
  const [domain, ...others] = definition.domains;
  if (domain === undefined) return 'any';
  if (others.length > 0) {
    // 135.2.e.6.c makes it a choice among the rune's domains: no Basic Rune has two domains.
    throw new EngineInvariantError(
      `Rune ${definition.id} has several domains: not implemented yet`,
    );
  }
  return domain;
}

/** Applies the rune uses in order, adding their resources to the pool. Returns why it fails, if it does. */
export function useRunes(
  draft: Draft,
  state: GameState,
  playerId: PlayerId,
  uses: readonly RuneUse[],
): IllegalReason | null {
  const player = playerOf(draft, playerId);
  for (const { rune, use } of uses) {
    // Runes a player controls are in their base (107.1.c).
    if (
      !player.zones.base.includes(rune) ||
      state.cards[objectOf(draft, rune).card]?.category !== 'rune'
    ) {
      return {
        code: 'invalid-payment',
        message: `${rune} is not a rune in ${playerId}'s base`,
        rule: '107.1.c',
      };
    }
    const object = objectOf(draft, rune);
    if (use === 'exhaust') {
      // 164.2.a: [E]: Add [1]. An exhausted rune cannot be exhausted again to pay (415.4).
      if (object.exhausted) {
        return { code: 'invalid-payment', message: `${rune} is already exhausted`, rule: '415.4' };
      }
      updateObject(draft, rune, { exhausted: true });
      emit(draft, {
        type: 'ObjectExhausted',
        rule: '164.2.a',
        visibility: { kind: 'public' },
        player: playerId,
        object: rune,
      });
      player.runePool.energy += 1;
      emit(draft, {
        type: 'ResourcesAdded',
        rule: '164.2.a',
        visibility: { kind: 'public' },
        player: playerId,
        source: rune,
        resources: { energy: 1, power: {} },
      });
    } else {
      // 164.2.b: Recycle this: Add [C], Power of the rune's domain (164.2.b.1).
      // Recycled to the bottom of the Rune Deck (417.1.b, 161.2.b): a new object (124).
      const power = powerOfRune(state.cards[object.card] as CardDefinition);
      player.zones.base = player.zones.base.filter((id) => id !== rune);
      const recycled = renewObject(draft, rune);
      player.zones.runeDeck.push(recycled.id);
      emit(draft, {
        type: 'CardRecycled',
        rule: '164.2.b',
        visibility: { kind: 'public' },
        player: playerId,
        object: recycled.id,
        previousObject: rune,
        card: recycled.card,
        from: 'base',
        to: 'runeDeck',
      });
      player.runePool.power[power] += 1;
      emit(draft, {
        type: 'ResourcesAdded',
        rule: '164.2.b',
        visibility: { kind: 'public' },
        player: playerId,
        source: rune,
        resources: { energy: 0, power: { [power]: 1 } },
      });
    }
  }
  return null;
}

/** Pays a cost from the player's pool (357.1, 445.1). Returns why it fails, if it does. */
export function payCost(draft: Draft, playerId: PlayerId, cost: Cost): IllegalReason | null {
  const player = playerOf(draft, playerId);
  const payment = payFromPool(player.runePool, cost);
  if (payment === null) {
    return { code: 'cannot-pay', message: 'The Rune Pool does not cover the cost', rule: '358.2' };
  }
  player.runePool = payment.pool;
  if (payment.paid.energy > 0 || Object.keys(payment.paid.power).length > 0) {
    emit(draft, {
      type: 'ResourcesPaid',
      rule: '357.1',
      visibility: { kind: 'public' },
      player: playerId,
      resources: payment.paid,
    });
  }
  return null;
}

/**
 * Proposes runes to pay `cost`, on top of what the pool already holds, or null if the player
 * cannot pay it. A help, not a rule (docs/02-game-model.md): any legal payment can be played instead.
 * It recycles only for Power, prefers runes already exhausted, and exhausts a rune for Energy
 * before recycling it when Energy is still needed.
 */
export function autoPayment(state: GameState, playerId: PlayerId, cost: Cost): RuneUse[] | null {
  const player = state.players.find((p) => p.id === playerId);
  if (player === undefined) return null;
  const pool = { energy: player.runePool.energy, power: { ...player.runePool.power } };
  const runes = player.zones.base.filter(
    (id) => state.cards[state.objects[id]?.card as never]?.category === 'rune',
  );
  const exhausted = new Set(runes.filter((id) => state.objects[id]?.exhausted === true));
  const recycled = new Set<ObjectId>();
  const uses: RuneUse[] = [];
  const domainOf = (id: ObjectId) =>
    powerOfRune(state.cards[state.objects[id]?.card as never] as CardDefinition);

  // Power first: use the pool, then recycle runes of the right domain.
  let energyNeed = Math.max(0, cost.energy - pool.energy);
  const recycleFor = (accepts: (power: Domain | 'any') => boolean): boolean => {
    const candidates = runes.filter((id) => !recycled.has(id) && accepts(domainOf(id)));
    const rune = candidates.find((id) => exhausted.has(id)) ?? candidates[0];
    if (rune === undefined) return false;
    if (!exhausted.has(rune) && energyNeed > 0) {
      uses.push({ rune, use: 'exhaust' });
      exhausted.add(rune);
      energyNeed -= 1;
    }
    uses.push({ rune, use: 'recycle' });
    recycled.add(rune);
    return true;
  };
  for (const symbol of cost.power) {
    if (symbol !== 'any') {
      if (pool.power[symbol] > 0) pool.power[symbol] -= 1;
      else if (pool.power.any > 0) pool.power.any -= 1;
      else if (!recycleFor((power) => power === symbol || power === 'any')) return null;
    }
  }
  for (const symbol of cost.power) {
    if (symbol === 'any') {
      const domain = (Object.keys(pool.power) as (Domain | 'any')[]).find(
        (key) => pool.power[key] > 0,
      );
      if (domain !== undefined) pool.power[domain] -= 1;
      else if (!recycleFor(() => true)) return null;
    }
  }

  // Then Energy: exhaust ready runes that are not recycled.
  for (const rune of runes) {
    if (energyNeed === 0) break;
    if (!exhausted.has(rune) && !recycled.has(rune)) {
      uses.push({ rune, use: 'exhaust' });
      exhausted.add(rune);
      energyNeed -= 1;
    }
  }
  return energyNeed === 0 ? uses : null;
}
