// The instructions of a spell (158) or an ability, executed when it resolves (340.1, 359.3.d).
// Each instruction kind of the vocabulary (types/effects.ts, ADR 0019) has its interpreter here.

import {
  assertNever,
  type CardDefinition,
  type ChainItem,
  type Instruction,
  type InstructionObject,
  type ObjectId,
  type TargetSpec,
} from '@foilengine/types';
import { attach } from '../actions/attach.ts';
import { drawCards } from '../actions/draw.ts';
import { killPermanents } from '../actions/kill.ts';
import { playToken } from '../actions/play-token.ts';
import { type Draft, emit, locationOf, objectOf, playerOf, updateObject } from '../draft.ts';
import { EngineInvariantError } from '../errors.ts';
import { isValidTarget } from './targets.ts';

/**
 * Executes the instructions of `item`, a spell or an ability, from top to bottom (158.1). A target that is
 * no longer valid is unaffected (359.3.e.5), and an instruction whose targets are all invalid
 * does not execute (359.3.e.7); the spell still resolves (359.3.e.1). A target that changed
 * zones is a new object, so it is no longer found on the board (359.3.e.2, 359.3.e.4).
 *
 * It starts at instruction `from`, with the `token` an earlier instruction played. An instruction
 * that needs a player's choice records it in `draft.resolving` and stops (ADR 0020): it returns
 * false, and the resolution resumes once the choice is made. It returns true when the last
 * instruction has run.
 */
export function executeInstructions(
  draft: Draft,
  item: ChainItem,
  from = 0,
  played: ObjectId | null = null,
): boolean {
  const effect = effectOf(draft, item);
  const specs = effect.targets ?? [];
  const legal = (index: number) => {
    const spec = specs[index];
    const target = item.targets[index];
    return spec !== undefined &&
      target !== undefined &&
      isValidTarget(draft, spec, target, item.controller)
      ? target
      : null;
  };
  // The token an earlier instruction played, for a later linked instruction (359.3.e.14).
  let token = played;
  // The object an instruction affects: a valid target, or this permanent or the token if it is
  // still on the board.
  const affected = (object: InstructionObject): ObjectId | null => {
    if (typeof object === 'number') return legal(object);
    const found = object === 'self' ? (item.ability?.source ?? null) : token;
    return found !== null && locationOf(draft, found) !== null ? found : null;
  };
  const instructions = effect.instructions ?? [];
  for (let index = from; index < instructions.length; index++) {
    const instruction = instructions[index] as Instruction;
    if (draft.winner !== null) return true;
    switch (instruction.kind) {
      case 'draw':
        // 414.2.b: the player draws when instructed; "Draw X" draws for the spell's controller.
        drawCards(draft, item.controller, instruction.amount, '414.2.b');
        break;
      case 'deal': {
        const target = affected(instruction.target);
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
      case 'give-might': {
        // 479.4: "Give [target] +X [M] this turn": a continuous effect in the Arithmetic layer,
        // with a timestamp (482.1), until the end of the turn (317.2.c).
        const target = affected(instruction.target);
        if (target === null) break;
        draft.effects = [
          ...draft.effects,
          {
            timestamp: draft.eventSeq + 1,
            target,
            might: instruction.amount,
            until: 'end-of-turn',
          },
        ];
        emit(draft, {
          type: 'MightGiven',
          rule: '479.4',
          visibility: { kind: 'public' },
          unit: target,
          amount: instruction.amount,
        });
        break;
      }
      case 'buff': {
        // 702.2.a: place a buff on the unit; one that already has a buff gets none (702.3.a).
        const target = affected(instruction.target);
        if (target === null || objectOf(draft, target).buffs > 0) break;
        updateObject(draft, target, { buffs: 1 });
        emit(draft, {
          type: 'UnitBuffed',
          rule: '702.2.a',
          visibility: { kind: 'public' },
          unit: target,
        });
        break;
      }
      case 'kill': {
        // 429.1.a.1, 429.6: "Kill [target]", or "kill this" for the permanent the ability is on;
        // one that is no longer on the board is unaffected.
        const target = affected(instruction.target);
        if (target === null) break;
        killPermanents(draft, [target], '429.1.a.1');
        break;
      }
      case 'play-token':
        // 350.2, 184.2: the controller of the spell or ability plays the token into their base.
        token = playToken(draft, item.controller, instruction.token);
        break;
      case 'attach': {
        // 435, 818.1.c.2: "Attach this to [target]": the permanent the ability is on.
        const source = item.ability?.source ?? null;
        const target = affected(instruction.target);
        if (source === null || target === null) break;
        attach(draft, source, target);
        break;
      }
      case 'predict': {
        // 437.1, 437.1.a: its controller looks at the top cards of their Main Deck, as many as
        // there are (437.4), without burning out (437.4.a), then chooses (ADR 0020).
        const cards = playerOf(draft, item.controller).zones.mainDeck.slice(0, instruction.amount);
        if (cards.length === 0) break;
        emit(draft, {
          type: 'Predicted',
          rule: '437.1',
          visibility: { kind: 'public' },
          player: item.controller,
          count: cards.length,
        });
        draft.resolving = {
          item: item.object,
          next: index + 1,
          token,
          choice: { kind: 'predict', player: item.controller, cards },
        };
        return false;
      }
      default:
        assertNever(instruction);
    }
  }
  return true;
}

/** What a Chain item does: a card's targets and instructions, or one of its abilities'. */
export function effectOf(
  draft: Pick<Draft, 'cards'> & Parameters<typeof objectOf>[0],
  item: ChainItem,
): { targets?: readonly TargetSpec[]; instructions?: readonly Instruction[] } {
  if (item.ability === null) {
    return draft.cards[objectOf(draft, item.object).card] as CardDefinition;
  }
  const ability = (draft.cards[item.ability.card] as CardDefinition).abilities?.[
    item.ability.index
  ];
  if (ability === undefined || ability.kind === 'passive') {
    throw new EngineInvariantError(
      `${item.ability.card} has no ability ${item.ability.index} that uses the Chain`,
    );
  }
  return ability;
}
