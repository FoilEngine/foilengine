// Scoring (469–474): Conquer (471.1) and Hold (471.2), once per battlefield per turn (472).

import type { ObjectId, PlayerId } from '@foilengine/types';
import { trigger } from '../abilities/triggers.ts';
import { drawCards } from '../actions/draw.ts';
import { battlefieldOf, controllerOf, type Draft, emit, playerOf } from '../draft.ts';
import { DUEL_VICTORY_SCORE } from '../modes/duel.ts';

export function score(
  draft: Draft,
  playerId: PlayerId,
  battlefield: ObjectId,
  method: 'conquer' | 'hold',
): void {
  const player = playerOf(draft, playerId);
  if (player.scoredThisTurn.includes(battlefield)) return; // 472
  player.scoredThisTurn.push(battlefield);
  emit(draft, {
    type: 'BattlefieldScored',
    rule: method === 'conquer' ? '471.1' : '471.2',
    visibility: { kind: 'public' },
    player: playerId,
    battlefield,
    method,
  });
  // 473.2, 383.4.c, 383.4.d: the Conquer or Hold abilities of the player's units present there
  // trigger, even if the point is not gained (383.4.c.2.c, 383.4.d.2.c).
  const present = battlefieldOf(draft, battlefield).units.filter(
    (unit) => controllerOf(draft, unit) === playerId,
  );
  trigger(draft, method, present);

  // 473.1.b: a Conquer by a player 1 point or less from the Victory Score gives the Final Point
  // only if they Scored every battlefield this turn; otherwise they draw a card instead (473.1.b.1).
  // Points from other sources, such as Hold, are not restricted (473.1.a.1).
  if (method === 'conquer' && player.points >= DUEL_VICTORY_SCORE - 1) {
    const everyBattlefield = draft.battlefields.every((b) =>
      player.scoredThisTurn.includes(b.object),
    );
    if (!everyBattlefield) {
      drawCards(draft, playerId, 1, '473.1.b.1');
      return;
    }
  }
  player.points += 1;
  emit(draft, {
    type: 'PointsGained',
    rule: '473.1',
    visibility: { kind: 'public' },
    player: playerId,
    amount: 1,
    total: player.points,
  });
}
