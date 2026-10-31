// Combat (461–468) between units without abilities: the Combat Showdown (466), the Combat
// Damage Step (467) and the Resolution Step (468). Damage, kills, heals and recalls with it.

import type {
  AssignCombatDamage,
  AssignDamageDecision,
  DamageAssignment,
  GameState,
  IllegalReason,
  ObjectId,
  PlayerId,
} from '@foilengine/types';
import { trigger } from '../abilities/triggers.ts';
import { cleanup } from '../cleanup/cleanup.ts';
import {
  battlefieldOf,
  controllerOf,
  type Draft,
  emit,
  objectOf,
  playerOf,
  playersAt,
  renewObject,
  updateObject,
} from '../draft.ts';
import { EngineInvariantError } from '../errors.ts';
import {
  type BoardReader,
  characteristics,
  characteristicsWith,
  readerOfDraft,
  readerOfState,
} from '../layers/characteristics.ts';
import { score } from '../scoring/score.ts';

/**
 * A unit's Might as spells, abilities and combat damage use it (143.2): its Effective Might, layers
 * applied (characteristics), treated as 0 when below 0 (143.2.c).
 */
export function mightOf(state: GameState, unit: ObjectId): number {
  return Math.max(0, characteristics(state, unit).might ?? 0);
}

/** Damage still needed to make the unit's damage lethal: non-zero and at least its Might (142.4.b). */
export function lethalAmount(state: GameState, unit: ObjectId): number {
  return lethalWith(readerOfState(state), state, unit);
}

/** mightOf, with a reader shared by several units of the same state. */
function mightWith(reader: BoardReader, unit: ObjectId): number {
  return Math.max(0, characteristicsWith(reader, unit).might ?? 0);
}

function lethalWith(reader: BoardReader, state: GameState, unit: ObjectId): number {
  const might = mightWith(reader, unit);
  return Math.max(1, might - (state.objects[unit]?.damage ?? 0));
}

const unitsOf = (draft: Draft, battlefield: ObjectId, player: PlayerId) =>
  battlefieldOf(draft, battlefield).units.filter((unit) => controllerOf(draft, unit) === player);

const sumMight = (draft: Draft, units: readonly ObjectId[]) => {
  const reader = readerOfDraft(draft);
  return units.reduce((total, unit) => total + mightWith(reader, unit), 0);
};

/**
 * 323.12, 466: a Combat begins at a battlefield where it is staged. It opens with a Combat
 * Showdown (463.3, 466.2); the player who applied Contested is the Attacker and gains Focus
 * (466.2.c.1, 466.2.c.1.a), the other player is the Defender (466.2.c.2). Their units there
 * gain the same designation (466.2.c.3), and their Attack and Defend abilities trigger (383.4.e,
 * 383.4.f); they go on the Combat Chain once this task is complete (466.2.d).
 */
export function startCombat(draft: Draft, battlefieldId: ObjectId): void {
  const battlefield = battlefieldOf(draft, battlefieldId);
  const attacker = battlefield.contestedBy;
  const defender = [...playersAt(draft, battlefield)].find((p) => p !== attacker);
  if (attacker === null || defender === undefined) {
    throw new EngineInvariantError(`Combat at ${battlefieldId} without an attacker and a defender`);
  }
  battlefield.combatStaged = false;
  battlefield.showdownStaged = false;
  const attackers = unitsOf(draft, battlefieldId, attacker);
  const defenders = unitsOf(draft, battlefieldId, defender);
  draft.combat = {
    battlefield: battlefieldId,
    attacker,
    defender,
    step: 'showdown',
    attackerAssignment: null,
    defenderAssignment: null,
    attackers,
    defenders,
  };
  emit(draft, {
    type: 'CombatStarted',
    rule: '466.2.c',
    visibility: { kind: 'public' },
    battlefield: battlefieldId,
    attacker,
    defender,
  });
  draft.showdown = { battlefield: battlefieldId, focus: attacker, passes: 0 };
  emit(draft, {
    type: 'ShowdownStarted',
    rule: '466.2.c.1.a',
    visibility: { kind: 'public' },
    battlefield: battlefieldId,
    focus: attacker,
  });
  trigger(draft, 'attack', attackers);
  trigger(draft, 'defend', defenders);
}

/**
 * 323.2: during a Combat, units at its battlefield without a designation, or with the wrong one,
 * get their controller's (323.2.a, 323.2.b); units elsewhere lose theirs (323.2.c). Returns
 * whether anything changed.
 */
export function updateDesignations(draft: Draft): boolean {
  const combat = draft.combat;
  if (combat === null || combat.step === 'resolution') return false;
  const attackers = unitsOf(draft, combat.battlefield, combat.attacker);
  const defenders = unitsOf(draft, combat.battlefield, combat.defender);
  const same = (a: readonly ObjectId[], b: readonly ObjectId[]) =>
    a.length === b.length && a.every((id, i) => id === b[i]);
  if (same(attackers, combat.attackers) && same(defenders, combat.defenders)) return false;
  draft.combat = { ...combat, attackers, defenders };
  return true;
}

/** 348.1: the Combat Showdown closed; proceed with the Combat Damage Step (467). */
export function closeCombatShowdown(draft: Draft): void {
  const combat = draft.combat;
  if (combat === null) throw new EngineInvariantError('No Combat in progress');
  draft.showdown = null;
  emit(draft, {
    type: 'ShowdownEnded',
    rule: '348.1',
    visibility: { kind: 'public' },
    battlefield: combat.battlefield,
  });

  // 467.1: the damage step happens only if both Attacking and Defending units remain.
  const attacking = unitsOf(draft, combat.battlefield, combat.attacker);
  const defending = unitsOf(draft, combat.battlefield, combat.defender);
  if (attacking.length === 0 || defending.length === 0) {
    resolveCombat(draft);
    return;
  }
  // A player whose units have no Might has no damage to assign.
  draft.combat = {
    ...combat,
    step: 'damage',
    attackerAssignment: sumMight(draft, attacking) === 0 ? [] : null,
    defenderAssignment: sumMight(draft, defending) === 0 ? [] : null,
  };
  dealIfAssigned(draft);
}

/** Who must assign damage now: the Attacker first, then the Defender (467.2.c). */
export function damageDecision(state: GameState): AssignDamageDecision | null {
  const combat = state.combat;
  if (combat === null || combat.step !== 'damage') return null;
  const reader = readerOfState(state);
  const battlefield = state.battlefields.find((b) => b.object === combat.battlefield);
  if (battlefield === undefined) return null;
  const unitsOfPlayer = (player: PlayerId) =>
    battlefield.units.filter((unit) => state.objects[unit]?.owner === player);
  const decide = (player: PlayerId, opponent: PlayerId): AssignDamageDecision => ({
    kind: 'AssignDamage',
    player,
    battlefield: combat.battlefield,
    amount: unitsOfPlayer(player).reduce((total, unit) => total + mightWith(reader, unit), 0),
    targets: unitsOfPlayer(opponent),
    rule: '467.2.c',
  });
  if (combat.attackerAssignment === null) return decide(combat.attacker, combat.defender);
  if (combat.defenderAssignment === null) return decide(combat.defender, combat.attacker);
  return null;
}

/**
 * Checks an assignment against 467.2.c: all the damage is assigned among the opposing units;
 * lethal damage is assigned in full to a unit before another one gets any (467.2.c.3), so at
 * most one unit gets non-lethal damage; and no unit gets more than lethal damage unless every
 * unit already gets lethal damage (467.2.c.4).
 */
export function checkAssignment(
  state: GameState,
  action: AssignCombatDamage,
): IllegalReason | null {
  const decision = damageDecision(state);
  if (decision === null)
    return { code: 'wrong-action', message: 'No combat damage to assign', rule: null };
  const invalid = (message: string, rule: IllegalReason['rule']): IllegalReason => ({
    code: 'invalid-assignment',
    message,
    rule,
  });
  const amounts = new Map<ObjectId, number>();
  for (const { unit, amount } of action.assignment) {
    if (!decision.targets.includes(unit))
      return invalid(`${unit} is not an opposing unit at this battlefield`, '467.2.c');
    if (amounts.has(unit)) return invalid(`${unit} is assigned damage twice`, '467.2.c');
    if (!Number.isInteger(amount) || amount < 0)
      return invalid(`Invalid amount ${amount}`, '418.1.e');
    amounts.set(unit, amount);
  }
  const total = [...amounts.values()].reduce((a, b) => a + b, 0);
  if (total !== decision.amount) {
    return invalid(`${decision.amount} damage must be assigned, not ${total}`, '467.2.c');
  }
  const reader = readerOfState(state);
  const lethal = new Map(decision.targets.map((unit) => [unit, lethalWith(reader, state, unit)]));
  const assigned = (unit: ObjectId) => amounts.get(unit) ?? 0;
  const partial = decision.targets.filter(
    (unit) => assigned(unit) > 0 && assigned(unit) < (lethal.get(unit) ?? 1),
  );
  if (partial.length > 1) {
    return invalid(
      'Lethal damage must be assigned in full before damaging another unit',
      '467.2.c.3',
    );
  }
  const allLethal = decision.targets.every((unit) => assigned(unit) >= (lethal.get(unit) ?? 1));
  if (!allLethal && decision.targets.some((unit) => assigned(unit) > (lethal.get(unit) ?? 1))) {
    return invalid(
      'No unit gets more than lethal damage while another one can still get some',
      '467.2.c.4',
    );
  }
  const full = (unit: ObjectId) => assigned(unit) >= (lethal.get(unit) ?? 1);
  if (!respectsRanks(reader, decision.targets, assigned, full)) {
    return invalid(
      'Units with Tank get lethal damage before the others, and units with Backline after them',
      '467.2.c.6',
    );
  }
  return null;
}

/**
 * 467.2.c.6, 815.1.b, 826.3: units with Tank are assigned lethal damage first, units with Backline
 * last, the others in between; within a rank, in any order (467.2.c.7). A unit with both chooses
 * which one applies, first or last, never in between (467.2.c.8, 467.2.c.9). An assignment
 * respects the ranks if, for some such choice, no unit of a later rank gets damage while a unit
 * of an earlier rank has not got lethal damage. All the targets have the same controller (the
 * opponent of the assigning player).
 */
function respectsRanks(
  reader: BoardReader,
  targets: readonly ObjectId[],
  assigned: (unit: ObjectId) => number,
  full: (unit: ObjectId) => boolean,
): boolean {
  const choices = targets.map((unit): readonly number[] => {
    const keywords = characteristicsWith(reader, unit).keywords;
    const tank = keywords.includes('tank');
    const backline = keywords.includes('backline');
    return tank && backline ? [0, 2] : tank ? [0] : backline ? [2] : [1];
  });
  const fits = (ranks: readonly number[]) =>
    targets.every(
      (later, j) =>
        assigned(later) === 0 ||
        targets.every((earlier, i) => (ranks[i] ?? 1) >= (ranks[j] ?? 1) || full(earlier)),
    );
  const search = (index: number, ranks: number[]): boolean =>
    index === targets.length
      ? fits(ranks)
      : (choices[index] ?? [1]).some((rank) => search(index + 1, [...ranks, rank]));
  return search(0, []);
}

/**
 * The assignments legalActions offers: for each order of the opposing units, lethal damage in
 * that order, the rest on the last unit. Every other valid assignment is accepted by isLegal.
 */
export function assignmentOptions(state: GameState): AssignCombatDamage[] {
  const decision = damageDecision(state);
  if (decision === null) return [];
  const options = new Map<string, AssignCombatDamage>();
  // The lethal amount of each unit, once: the same for every order.
  const reader = readerOfState(state);
  const lethal = new Map(decision.targets.map((unit) => [unit, lethalWith(reader, state, unit)]));
  // Tank first, Backline last (467.2.c.6): the first orders generated respect the ranks, so the
  // cap on orders never leaves none that does.
  const rank = (unit: ObjectId) => {
    const keywords = characteristicsWith(reader, unit).keywords;
    return keywords.includes('tank') ? 0 : keywords.includes('backline') ? 2 : 1;
  };
  const targets = [...decision.targets].sort((a, b) => rank(a) - rank(b));
  for (const order of permutations(targets)) {
    let remaining = decision.amount;
    const assignment: DamageAssignment[] = [];
    for (const unit of order) {
      const amount = Math.min(lethal.get(unit) ?? 1, remaining);
      remaining -= amount;
      if (amount > 0) assignment.push({ unit, amount });
    }
    const last = assignment.at(-1);
    if (remaining > 0 && last !== undefined)
      assignment[assignment.length - 1] = { ...last, amount: last.amount + remaining };
    const sorted = [...assignment].sort((a, b) => (a.unit < b.unit ? -1 : 1));
    // An order that breaks Tank or Backline (467.2.c.6) gives no legal assignment.
    const full = (unit: ObjectId) =>
      (sorted.find((a) => a.unit === unit)?.amount ?? 0) >= (lethal.get(unit) ?? 1);
    const amountOf = (unit: ObjectId) => sorted.find((a) => a.unit === unit)?.amount ?? 0;
    if (!respectsRanks(reader, decision.targets, amountOf, full)) continue;
    options.set(JSON.stringify(sorted), {
      type: 'AssignCombatDamage',
      player: decision.player,
      assignment: sorted,
    });
  }
  return [...options.values()];
}

/** Every order of the units; capped so that a large combat stays cheap (isLegal accepts the rest). */
function permutations<T>(items: readonly T[], cap = 720): T[][] {
  if (items.length <= 1) return [[...items]];
  const result: T[][] = [];
  for (const [index, item] of items.entries()) {
    for (const rest of permutations([...items.slice(0, index), ...items.slice(index + 1)], cap)) {
      result.push([item, ...rest]);
      if (result.length >= cap) return result;
    }
  }
  return result;
}

/** Records an assignment (467.2.c); when both are in, damage is dealt and the combat resolves. */
export function assignDamage(draft: Draft, action: AssignCombatDamage): void {
  const combat = draft.combat;
  if (combat === null) throw new EngineInvariantError('No Combat in progress');
  emit(draft, {
    type: 'DamageAssigned',
    rule: '467.2.c',
    visibility: { kind: 'public' },
    player: action.player,
    assignment: action.assignment,
  });
  draft.combat =
    action.player === combat.attacker
      ? { ...combat, attackerAssignment: action.assignment }
      : { ...combat, defenderAssignment: action.assignment };
  dealIfAssigned(draft);
}

/** 467.2.c.1.a, 467.2.d: once all damage is assigned, it is dealt simultaneously. Then 468. */
function dealIfAssigned(draft: Draft): void {
  const combat = draft.combat;
  if (combat === null || combat.attackerAssignment === null || combat.defenderAssignment === null)
    return;
  const damage = [...combat.attackerAssignment, ...combat.defenderAssignment].filter(
    (d) => d.amount > 0,
  );
  for (const { unit, amount } of damage) {
    updateObject(draft, unit, { damage: objectOf(draft, unit).damage + amount });
  }
  if (damage.length > 0) {
    emit(draft, { type: 'DamageDealt', rule: '467.2.d', visibility: { kind: 'public' }, damage });
  }
  resolveCombat(draft); // 467.3
}

/** 323.4: units with lethal damage are killed and put in their owners' trash (429). Returns whether any was. */
export function killLethalUnits(draft: Draft): boolean {
  let killed = false;
  const locations: { list: ObjectId[]; set: (next: ObjectId[]) => void }[] = [
    ...draft.players.map((player) => ({
      list: player.zones.base,
      set: (next: ObjectId[]) => {
        player.zones.base = next;
      },
    })),
    ...draft.battlefields.map((b) => ({
      list: b.units,
      set: (next: ObjectId[]) => {
        b.units = next;
      },
    })),
  ];
  // 323.4: every unit with lethal damage is killed at the same time: which ones is decided on the
  // board as it is, before any of them leaves it (a dying unit's passive ability still counts).
  // 142.4.b, 143.2.b: non-zero damage equal to or greater than its Might. Only damaged units can
  // die: the board is read only if there are some.
  const damaged = locations.map((location) =>
    location.list.filter((id) => objectOf(draft, id).damage > 0),
  );
  if (damaged.every((units) => units.length === 0)) return false;
  const reader = readerOfDraft(draft);
  const dying = damaged.map((units) =>
    units.filter((id) => objectOf(draft, id).damage >= mightWith(reader, id)),
  );
  // 808.1.d.2, 383.2.c.3: abilities that trigger on their source's death are processed just
  // before it goes to the trash, while what they need about it can still be noted.
  for (const units of dying) trigger(draft, 'dies', units);
  for (const [index, location] of locations.entries()) {
    const units = dying[index] ?? [];
    if (units.length === 0) continue;
    location.set(location.list.filter((id) => !units.includes(id)));
    for (const unit of units) {
      // 429.2: from the board to its owner's trash; a Non-Board Zone, so a new object (124).
      const owner = objectOf(draft, unit).owner;
      const dead = renewObject(draft, unit);
      playerOf(draft, owner).zones.trash.push(dead.id);
      emit(draft, {
        type: 'UnitKilled',
        rule: '323.4',
        visibility: { kind: 'public' },
        player: owner,
        unit,
        object: dead.id,
        card: dead.card,
      });
      killed = true;
    }
  }
  return killed;
}

/** Heals every damaged unit on the board (419). */
export function healAllUnits(draft: Draft, rule: '468.1.a.1' | '317.2.b'): void {
  const units = [
    ...draft.players.flatMap((p) => p.zones.base),
    ...draft.battlefields.flatMap((b) => b.units),
  ].filter((id) => objectOf(draft, id).damage > 0);
  for (const unit of units) updateObject(draft, unit, { damage: 0 });
  if (units.length > 0)
    emit(draft, { type: 'UnitsHealed', rule, visibility: { kind: 'public' }, units });
}

/** 468: the Resolution Step. */
function resolveCombat(draft: Draft): void {
  const combat = draft.combat;
  if (combat === null) throw new EngineInvariantError('No Combat in progress');
  const battlefield = battlefieldOf(draft, combat.battlefield);

  // 468.1: a Combat Special Cleanup: 3a kills units with lethal damage (323.4), then the inserted
  // steps heal all units (468.1.a.1) and recall the Attackers if Defenders are still present (468.1.a.2).
  killLethalUnits(draft);
  healAllUnits(draft, '468.1.a.1');
  let recalled = false;
  const attackers = unitsOf(draft, combat.battlefield, combat.attacker);
  if (attackers.length > 0 && unitsOf(draft, combat.battlefield, combat.defender).length > 0) {
    // 457, 460: a Recall is not a Move and leaves the units' statuses as they are.
    battlefield.units = battlefield.units.filter((unit) => !attackers.includes(unit));
    playerOf(draft, combat.attacker).zones.base.push(...attackers);
    emit(draft, {
      type: 'UnitsRecalled',
      rule: '468.1.a.2',
      visibility: { kind: 'public' },
      player: combat.attacker,
      units: attackers,
    });
    recalled = true;
  }

  // 468.2: what the damage and the Combat Cleanup put on the Chain resolves first; then the
  // combat result.
  draft.combat = { ...combat, step: 'resolution' };
  draft.tasks = [
    { kind: 'combat-result', battlefield: battlefield.object, recalled },
    ...draft.tasks,
  ];
}

/** 468.3 and 468.5: the combat result, then Control of the battlefield. */
export function resolveCombatResult(
  draft: Draft,
  battlefieldId: ObjectId,
  recalled: boolean,
): void {
  const combat = draft.combat;
  if (combat === null) throw new EngineInvariantError('No Combat in progress');
  const battlefield = battlefieldOf(draft, battlefieldId);

  // 468.3: the combat result.
  const present = [...playersAt(draft, battlefield)];
  const [only] = present;
  const winner = !recalled && present.length === 1 && only !== undefined ? only : null;
  if (present.length > 1) {
    // 468.3.d.1: No Result with units of both players: stage a Showdown and a Combat again.
    battlefield.showdownStaged = true;
    battlefield.combatStaged = true;
  } else {
    // 468.5: the player with units remaining establishes Control if they did not have it,
    // which is a Conquer if they have not Scored it this turn (468.5.d); Contested is cleared
    // (468.5.a); with no units left, the battlefield becomes Uncontrolled (468.5.b).
    battlefield.contestedBy = null;
    if (only !== undefined && battlefield.controller !== only) {
      if (battlefield.controller !== null) {
        emit(draft, {
          type: 'ControlLost',
          rule: '468.5',
          visibility: { kind: 'public' },
          player: battlefield.controller,
          battlefield: battlefield.object,
        });
      }
      battlefield.controller = only;
      emit(draft, {
        type: 'ControlEstablished',
        rule: '468.5',
        visibility: { kind: 'public' },
        player: only,
        battlefield: battlefield.object,
      });
      score(draft, only, battlefield.object, 'conquer');
    } else if (only === undefined && battlefield.controller !== null) {
      emit(draft, {
        type: 'ControlLost',
        rule: '468.5.b',
        visibility: { kind: 'public' },
        player: battlefield.controller,
        battlefield: battlefield.object,
      });
      battlefield.controller = null;
    }
  }

  // 468.4, 468.6, 468.7: once what the resolution put on the Chain has resolved, the Combat ends.
  draft.tasks = [{ kind: 'combat-end', battlefield: battlefield.object, winner }, ...draft.tasks];
}

/** 468.7: Combat ends; Attacker and Defender designations go with it (468.7.a). */
export function endCombat(draft: Draft, battlefield: ObjectId, winner: PlayerId | null): void {
  draft.combat = null;
  emit(draft, {
    type: 'CombatEnded',
    rule: '468.7',
    visibility: { kind: 'public' },
    battlefield,
    winner,
  });
  cleanup(draft);
}
