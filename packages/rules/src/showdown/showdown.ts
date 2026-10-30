// Showdowns without spells (341–348). M2 has no spell or ability to play, so the player with
// Focus can only pass (347.2). Combat Showdowns arrive with combat.

import type { ObjectId } from '@foilengine/types';
import { cleanup } from '../cleanup/cleanup.ts';
import { closeCombatShowdown } from '../combat/combat.ts';
import { battlefieldOf, type Draft, emit, playersAt } from '../draft.ts';
import { EngineInvariantError } from '../errors.ts';
import { score } from '../scoring/score.ts';

/** 344, 345: a Showdown begins at the battlefield; the player who applied Contested gains Focus. */
export function startShowdown(draft: Draft, battlefieldId: ObjectId): void {
  const battlefield = battlefieldOf(draft, battlefieldId);
  const focus = battlefield.contestedBy;
  if (focus === null)
    throw new EngineInvariantError(`Showdown at ${battlefieldId}, which is not Contested`);
  battlefield.showdownStaged = false;
  draft.showdown = { battlefield: battlefieldId, focus, passes: 0 };
  emit(draft, {
    type: 'ShowdownStarted',
    rule: '345',
    visibility: { kind: 'public' },
    battlefield: battlefieldId,
    focus,
  });
}

/** 347.2: the player with Focus passes. When all have passed in sequence, the Showdown closes (347.2.a, 348). */
export function passFocus(draft: Draft): void {
  const showdown = draft.showdown;
  if (showdown === null) throw new EngineInvariantError('No Showdown in progress');
  const passes = showdown.passes + 1;
  if (passes >= draft.turnOrder.length && draft.combat?.battlefield === showdown.battlefield) {
    emit(draft, {
      type: 'FocusPassed',
      rule: '347.2.a',
      visibility: { kind: 'public' },
      player: showdown.focus,
      next: null,
    });
    closeCombatShowdown(draft); // 348.1
    return;
  }
  if (passes >= draft.turnOrder.length) {
    emit(draft, {
      type: 'FocusPassed',
      rule: '347.2.a',
      visibility: { kind: 'public' },
      player: showdown.focus,
      next: null,
    });
    closeShowdown(draft);
    return;
  }
  // 347.2.b: the next player in turn order gains Focus.
  const index = draft.turnOrder.indexOf(showdown.focus);
  const next = draft.turnOrder[(index + 1) % draft.turnOrder.length];
  if (next === undefined) throw new EngineInvariantError('Empty turn order');
  draft.showdown = { ...showdown, focus: next, passes };
  emit(draft, {
    type: 'FocusPassed',
    rule: '347.2.b',
    visibility: { kind: 'public' },
    player: showdown.focus,
    next,
  });
}

/**
 * 348.2: a Non-Combat Showdown closes. If only one player's units remain and that player does not
 * control the battlefield, they establish Control (348.2.a, 190.4), which is a Conquer if they have
 * not Scored it this turn (348.2.a.1, 471.1). Control established ends Contested (190.3.b).
 */
function closeShowdown(draft: Draft): void {
  const showdown = draft.showdown;
  if (showdown === null) throw new EngineInvariantError('No Showdown in progress');
  const battlefield = battlefieldOf(draft, showdown.battlefield);
  draft.showdown = null;
  emit(draft, {
    type: 'ShowdownEnded',
    rule: '348.2',
    visibility: { kind: 'public' },
    battlefield: battlefield.object,
  });

  const present = [...playersAt(draft, battlefield)];
  const [only] = present;
  if (present.length === 1 && only !== undefined && battlefield.controller !== only) {
    if (battlefield.controller !== null) {
      emit(draft, {
        type: 'ControlLost',
        rule: '348.2.a',
        visibility: { kind: 'public' },
        player: battlefield.controller,
        battlefield: battlefield.object,
      });
    }
    battlefield.controller = only;
    battlefield.contestedBy = null;
    emit(draft, {
      type: 'ControlEstablished',
      rule: '348.2.a',
      visibility: { kind: 'public' },
      player: only,
      battlefield: battlefield.object,
    });
    score(draft, only, battlefield.object, 'conquer');
  }
  cleanup(draft); // 319.1: the turn returns to a Neutral State.
}
