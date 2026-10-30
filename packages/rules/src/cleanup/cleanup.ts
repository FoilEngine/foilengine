// Cleanup (318–323). It becomes an outstanding task after phase transitions (319.2),
// objects entering or leaving the board (319.6), status changes (319.7), etc.
//
// Only step 1 is implemented: the other steps act on combat roles, lethal damage,
// battlefield control, recalls, showdowns and combats, which do not exist yet (M2).

import { type Draft, emit } from '../draft.ts';
import { DUEL_VICTORY_SCORE } from '../modes/duel.ts';

export function cleanup(draft: Draft): void {
  if (draft.winner !== null) return;
  checkVictory(draft, '323.1');
}

/**
 * 323.1, 194.2: a player with points greater than or equal to the Victory Score, and more
 * points than every opponent, wins. The game then ends (196).
 */
export function checkVictory(draft: Draft, rule: '323.1' | '432.3.c.1'): boolean {
  for (const player of draft.players) {
    const others = draft.players.filter((p) => p.id !== player.id);
    if (
      player.points >= DUEL_VICTORY_SCORE &&
      others.every((other) => player.points > other.points)
    ) {
      draft.winner = player.id;
      draft.stage = { kind: 'ended' };
      emit(draft, { type: 'GameWon', rule, visibility: { kind: 'public' }, player: player.id });
      return true;
    }
  }
  return false;
}
