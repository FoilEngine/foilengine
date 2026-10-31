// Handling Outstanding Tasks (332–336): after each action, the engine runs the tasks it made
// outstanding, one at a time. Triggered abilities go on the Chain once a task is complete
// (334.1, 334.2), and the engine stops while a Chain must be resolved (336) or a player must
// decide; it resumes when the Chain is empty (335).

import { assertNever, type Task } from '@foilengine/types';
import { finalizePending, placeTriggered } from '../abilities/triggers.ts';
import { endCombat, resolveCombatResult } from '../combat/combat.ts';
import type { Draft } from '../draft.ts';
import { EngineInvariantError } from '../errors.ts';
import { runTurnStep } from '../turn/turn.ts';

/** More tasks than this in one action is a loop: a bug (03-rules-engine.md, Bounded). */
const MAX_TASKS_PER_ACTION = 1000;

export function settle(draft: Draft): void {
  for (let count = 0; ; count++) {
    if (count > MAX_TASKS_PER_ACTION) {
      throw new EngineInvariantError(`More than ${MAX_TASKS_PER_ACTION} tasks in one action`);
    }
    if (draft.winner !== null || draft.stage.kind === 'ended') return;
    if (draft.triggered.length > 0) {
      if (!placeTriggered(draft)) return; // a player orders their triggered abilities
      continue;
    }
    if (draft.chain !== null) {
      // FEPR (336): finalize what is Pending (337), then the player with Priority acts (338).
      // If nothing is left on the Chain (items removed at finalization), play goes on.
      if (draft.chain.items.some((item) => item.status === 'pending')) {
        finalizePending(draft);
        if (draft.chain === null) continue;
      }
      return;
    }
    const [task, ...rest] = draft.tasks;
    if (task === undefined) return;
    draft.tasks = rest;
    runTask(draft, task);
  }
}

function runTask(draft: Draft, task: Task): void {
  switch (task.kind) {
    case 'turn':
      runTurnStep(draft, task.step);
      return;
    case 'combat-result':
      resolveCombatResult(draft, task.battlefield, task.recalled);
      return;
    case 'combat-end':
      endCombat(draft, task.battlefield, task.winner);
      return;
    default:
      assertNever(task);
  }
}
