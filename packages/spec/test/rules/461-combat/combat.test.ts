import { legalActions } from '@foilengine/rules';
import { scenario } from '@foilengine/testkit';
import type { Action, GameState, ObjectId } from '@foilengine/types';
import { describe, expect } from 'vitest';
import {
  A,
  act,
  B,
  baseUnit,
  battlefield,
  beforeCombat,
  move,
  ofType,
  unitsInBase,
} from '../../battlefields.ts';

const ofCard = (state: GameState, card: string) =>
  (state.battlefields[0]?.units ?? []).find((u) => state.objects[u]?.card === card) as ObjectId;
const sorted = (assignment: { unit: ObjectId; amount: number }[]) =>
  [...assignment].sort((a, b) => (a.unit < b.unit ? -1 : 1));
const assign = (player: typeof A, assignment: { unit: ObjectId; amount: number }[]): Action => ({
  type: 'AssignCombatDamage',
  player,
  assignment,
});

/** B moves both units (Might 1 + 2) to A's battlefield, defended by A's Vanilla 1 and 5. */
const attack = () => {
  const state = beforeCombat('both');
  return act(state, move(B, unitsInBase(state, B), battlefield(state, 0))).state;
};
/** The Combat Showdown is over: B (the Attacker) must assign 3 damage. */
const damageStep = () =>
  act(attack(), { type: 'PassFocus', player: B }, { type: 'PassFocus', player: A }).state;

describe('461–468 Combat', () => {
  scenario('rule 454: units that move to a battlefield with enemy units cause a Combat there', {
    rules: ['454', '463', '323.8', '323.12', '462', '463.3'],
    setup: () => beforeCombat('both'),
    check: (t) => {
      const target = battlefield(t.state, 0);
      t.act(move(B, unitsInBase(t.state, B), target));
      t.expect(ofType(t.events, 'BattlefieldContested')).toMatchObject([{ player: B }]);
      t.expect(ofType(t.events, 'CombatStarted')).toMatchObject([
        { battlefield: target, attacker: B, defender: A },
      ]);
      t.expect(t.state.combat).toMatchObject({ battlefield: target, step: 'showdown' });
    },
  });

  scenario(
    'rule 466.2.c.1: the Attacker applied Contested, the Defender did not; the Attacker gains Focus',
    {
      rules: ['466.2.c.1', '466.2.c.2', '466.2.c.1.a', '466.2'],
      setup: attack,
      check: (t) => {
        t.expect(t.state.combat).toMatchObject({ attacker: B, defender: A });
        t.expect(ofType(t.events, 'ShowdownStarted')).toEqual([]);
        t.expectDecision({ kind: 'Focus', player: B });
      },
    },
  );

  scenario('rule 348.1: when the Combat Showdown closes, the Combat Damage Step begins', {
    rules: ['348.1', '467.1', '467.2.a', '467.2.b', '467.2.c'],
    setup: attack,
    check: (t) => {
      t.act({ type: 'PassFocus', player: B }, { type: 'PassFocus', player: A });
      t.expect(ofType(t.events, 'ShowdownEnded')).toMatchObject([{ rule: '348.1' }]);
      t.expect(t.state.combat?.step).toBe('damage');
      // Starting with the Attacker: B assigns the summed Might of its units, 1 + 2.
      t.expectDecision({ kind: 'AssignDamage', player: B, amount: 3 });
      const defenders = (t.state.battlefields[0]?.units ?? []).filter(
        (u) => t.state.objects[u]?.owner === A,
      );
      t.expectDecision({ kind: 'AssignDamage', player: B, targets: defenders });
    },
  });

  scenario(
    'rule 467.2.c.3: lethal damage is assigned in full to a unit before another one gets any',
    {
      rules: ['467.2.c.3', '467.2.c.4'],
      setup: damageStep,
      check: (t) => {
        const v1 = ofCard(t.state, 'test:vanilla-1');
        const v5 = ofCard(t.state, 'test:vanilla-5');
        // 3 damage on A's Vanilla 1 (lethal 1) and Vanilla 5 (lethal 5): 1 then 2, or 3 on Vanilla 5.
        const options = legalActions(t.state, B).map((a) =>
          a.type === 'AssignCombatDamage' ? sorted([...a.assignment]) : [],
        );
        t.expect(options).toHaveLength(2);
        t.expect(options).toEqual(
          expect.arrayContaining([
            sorted([
              { unit: v1, amount: 1 },
              { unit: v5, amount: 2 },
            ]),
            [{ unit: v5, amount: 3 }],
          ]),
        );
        t.expectLegal(assign(B, [{ unit: v5, amount: 3 }]));
        t.expectIllegal(assign(B, [{ unit: v1, amount: 3 }]), 'invalid-assignment');
        t.expectIllegal(assign(B, [{ unit: v1, amount: 1 }]), 'invalid-assignment');
      },
    },
  );

  scenario(
    'rule 467.2.d: once all damage is assigned, it is dealt to every unit at the same time',
    {
      rules: ['467.2.d', '467.2.c.1.a', '418.1.b'],
      setup: damageStep,
      check: (t) => {
        const v1 = ofCard(t.state, 'test:vanilla-1');
        const v5 = ofCard(t.state, 'test:vanilla-5');
        t.act(
          assign(B, [
            { unit: v1, amount: 1 },
            { unit: v5, amount: 2 },
          ]),
        );
        t.expect(ofType(t.events, 'DamageDealt')).toEqual([]);
        t.expectDecision({ kind: 'AssignDamage', player: A, amount: 6 });
        const [b1, b2] = (t.state.battlefields[0]?.units ?? []).filter(
          (u) => t.state.objects[u]?.owner === B,
        ) as [ObjectId, ObjectId];
        t.act(
          assign(A, [
            { unit: b1, amount: 1 },
            { unit: b2, amount: 5 },
          ]),
        );
        t.expect(ofType(t.events, 'DamageDealt')).toHaveLength(1);
        t.expect(ofType(t.events, 'DamageDealt')[0]?.damage).toHaveLength(4);
      },
    },
  );

  scenario(
    "rule 323.4: units with lethal damage are killed and put in their owner's trash as new objects",
    {
      rules: ['323.4', '429.2', '143.2.b', '142.4.b', '124'],
      setup: damageStep,
      check: (t) => {
        const v1 = ofCard(t.state, 'test:vanilla-1');
        const v5 = ofCard(t.state, 'test:vanilla-5');
        t.act(
          assign(B, [
            { unit: v1, amount: 1 },
            { unit: v5, amount: 2 },
          ]),
        );
        const [b1, b2] = (t.state.battlefields[0]?.units ?? []).filter(
          (u) => t.state.objects[u]?.owner === B,
        ) as [ObjectId, ObjectId];
        t.act(
          assign(A, [
            { unit: b1, amount: 1 },
            { unit: b2, amount: 5 },
          ]),
        );
        const killed = ofType(t.events, 'UnitKilled');
        t.expect(killed.map((e) => e.unit).sort()).toEqual([v1, b1, b2].sort());
        t.expect(t.player('B').zones.trash).toHaveLength(2);
        t.expect(t.player('A').zones.trash).toEqual(
          killed.filter((e) => e.player === A).map((e) => e.object),
        );
        t.expect(t.state.battlefields[0]?.units).toEqual([v5]);
      },
    },
  );

  scenario('rule 468.1.a.1: the Combat Cleanup heals the units that survived', {
    rules: ['468.1.a.1', '468.1', '419.1'],
    setup: damageStep,
    check: (t) => {
      const v1 = ofCard(t.state, 'test:vanilla-1');
      const v5 = ofCard(t.state, 'test:vanilla-5');
      t.act(
        assign(B, [
          { unit: v1, amount: 1 },
          { unit: v5, amount: 2 },
        ]),
      );
      const [b1, b2] = (t.state.battlefields[0]?.units ?? []).filter(
        (u) => t.state.objects[u]?.owner === B,
      ) as [ObjectId, ObjectId];
      t.act(
        assign(A, [
          { unit: b1, amount: 1 },
          { unit: b2, amount: 5 },
        ]),
      );
      t.expect(ofType(t.events, 'UnitsHealed')).toMatchObject([{ units: [v5], rule: '468.1.a.1' }]);
      t.expect(t.state.objects[v5]?.damage).toBe(0);
    },
  });

  scenario(
    'rule 468.3.a: the only player with units left wins the Combat; a Defender keeps Control',
    {
      rules: ['468.3.a', '468.5', '468.5.a', '468.7'],
      setup: damageStep,
      check: (t) => {
        const v1 = ofCard(t.state, 'test:vanilla-1');
        const v5 = ofCard(t.state, 'test:vanilla-5');
        t.act(
          assign(B, [
            { unit: v1, amount: 1 },
            { unit: v5, amount: 2 },
          ]),
        );
        const [b1, b2] = (t.state.battlefields[0]?.units ?? []).filter(
          (u) => t.state.objects[u]?.owner === B,
        ) as [ObjectId, ObjectId];
        t.act(
          assign(A, [
            { unit: b1, amount: 1 },
            { unit: b2, amount: 5 },
          ]),
        );
        t.expect(ofType(t.events, 'CombatEnded')).toMatchObject([{ winner: A, rule: '468.7' }]);
        t.expect(ofType(t.events, 'ControlEstablished')).toEqual([]);
        t.expect(t.state.battlefields[0]).toMatchObject({
          controller: A,
          contestedBy: null,
          combatStaged: false,
        });
        t.expect(t.state.combat).toBeNull();
        t.expectDecision({ kind: 'Priority', player: B });
      },
    },
  );

  scenario('rule 468.5.d: an Attacker who wins establishes Control, and it is a Conquer', {
    rules: ['468.5.d', '468.5.e', '468.3.c'],
    // A defends with Vanilla 1 only (Might 1) against Vanilla 1 and 2 (Might 3).
    setup: () => {
      const state = beforeCombat('vanilla-1');
      return act(
        state,
        move(B, unitsInBase(state, B), battlefield(state, 0)),
        { type: 'PassFocus', player: B },
        { type: 'PassFocus', player: A },
      ).state;
    },
    check: (t) => {
      const target = battlefield(t.state, 0);
      const defender = ofCard(t.state, 'test:vanilla-1');
      t.act(assign(B, [{ unit: defender, amount: 3 }]));
      const b2 = (t.state.battlefields[0]?.units ?? []).find(
        (u) => t.state.objects[u]?.card === 'test:vanilla-2' && t.state.objects[u]?.owner === B,
      ) as ObjectId;
      t.act(assign(A, [{ unit: b2, amount: 1 }]));
      t.expect(ofType(t.events, 'CombatEnded')).toMatchObject([{ winner: B }]);
      t.expect(ofType(t.events, 'ControlLost')).toMatchObject([{ player: A, battlefield: target }]);
      t.expect(ofType(t.events, 'ControlEstablished')).toMatchObject([
        { player: B, battlefield: target },
      ]);
      t.expect(ofType(t.events, 'BattlefieldScored')).toMatchObject([
        { player: B, method: 'conquer' },
      ]);
      t.expect(t.player('B').points).toBe(1);
    },
  });

  scenario(
    'rule 468.5.b: when no unit is left, the battlefield becomes Uncontrolled and nobody wins',
    {
      rules: ['468.5.b', '468.3.d'],
      // A's Vanilla 1 (Might 1) against B's Vanilla 1 (Might 1): both die.
      setup: () => {
        const state = beforeCombat('vanilla-1');
        return act(
          state,
          move(B, [baseUnit(state, B, 'test:vanilla-1')], battlefield(state, 0)),
          { type: 'PassFocus', player: B },
          { type: 'PassFocus', player: A },
        ).state;
      },
      check: (t) => {
        const [a1] = (t.state.battlefields[0]?.units ?? []).filter(
          (u) => t.state.objects[u]?.owner === A,
        ) as [ObjectId];
        const [b1] = (t.state.battlefields[0]?.units ?? []).filter(
          (u) => t.state.objects[u]?.owner === B,
        ) as [ObjectId];
        t.act(assign(B, [{ unit: a1, amount: 1 }]), assign(A, [{ unit: b1, amount: 1 }]));
        t.expect(ofType(t.events, 'UnitKilled')).toHaveLength(2);
        t.expect(ofType(t.events, 'CombatEnded')).toMatchObject([{ winner: null }]);
        t.expect(t.state.battlefields[0]).toMatchObject({ controller: null, units: [] });
      },
    },
  );

  scenario('rule 313.4: in the Combat Damage Step, only the player who must assign damage acts', {
    rules: ['313.4'],
    setup: damageStep,
    check: (t) => {
      t.expectIllegal(assign(A, []), 'not-your-decision');
      t.expectIllegal({ type: 'EndTurn', player: B }, 'wrong-action');
    },
  });
});
