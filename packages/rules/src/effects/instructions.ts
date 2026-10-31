// The instructions of a spell (158), executed when it resolves (340.1, 359.3.d).
// Each instruction kind of the vocabulary (types/effects.ts, ADR 0019) has its interpreter here.

import { assertNever, type CardDefinition, type ChainItem } from '@foilengine/types';
import { drawCards } from '../actions/draw.ts';
import { type Draft, emit, objectOf, updateObject } from '../draft.ts';
import { isValidTarget } from './targets.ts';

/**
 * Executes the instructions of the card of `item`, from top to bottom (158.1). A target that is
 * no longer valid is unaffected (359.3.e.5), and an instruction whose targets are all invalid
 * does not execute (359.3.e.7); the spell still resolves (359.3.e.1). A target that changed
 * zones is a new object, so it is no longer found on the board (359.3.e.2, 359.3.e.4).
 */
export function executeInstructions(draft: Draft, item: ChainItem): void {
  const definition = draft.cards[objectOf(draft, item.object).card] as CardDefinition;
  const specs = definition.targets ?? [];
  const legal = (index: number) => {
    const spec = specs[index];
    const target = item.targets[index];
    return spec !== undefined &&
      target !== undefined &&
      isValidTarget(draft, spec, target, item.controller)
      ? target
      : null;
  };
  for (const instruction of definition.instructions ?? []) {
    if (draft.winner !== null) return;
    switch (instruction.kind) {
      case 'draw':
        // 414.2.b: the player draws when instructed; "Draw X" draws for the spell's controller.
        drawCards(draft, item.controller, instruction.amount, '414.2.b');
        break;
      case 'deal': {
        const target = legal(instruction.target);
        // 418.1.e.1: only Valid Damage, 1 or more, is dealt.
        if (target === null || instruction.amount < 1) break;
        const unit = objectOf(draft, target);
        updateObject(draft, target, { damage: unit.damage + instruction.amount });
        emit(draft, {
          type: 'DamageDealt',
          rule: '418.1.b',
          visibility: { kind: 'public' },
          damage: [{ unit: target, amount: instruction.amount }],
        });
        break;
      }
      default:
        assertNever(instruction);
    }
  }
}
