// Conceding (649–652): a player may concede at any time (650) and is removed from the game (651).

import type { Concede, GameState, IllegalReason } from '@foilengine/types';
import { type Draft, emit } from './draft.ts';
import { EngineInvariantError } from './errors.ts';

export function checkConcede(state: GameState, action: Concede): IllegalReason | null {
  if (state.stage.kind === 'ended') {
    return { code: 'no-pending-decision', message: 'The game is over', rule: '196' };
  }
  if (!state.players.some((player) => player.id === action.player)) {
    return {
      code: 'wrong-action',
      message: `${action.player} is not a player of this game`,
      rule: null,
    };
  }
  return null;
}

export function concede(draft: Draft, action: Concede): void {
  emit(draft, {
    type: 'PlayerConceded',
    rule: '651',
    visibility: { kind: 'public' },
    player: action.player,
  });
  const remaining = draft.players.filter((player) => player.id !== action.player);
  const [winner] = remaining;
  if (remaining.length !== 1 || winner === undefined) {
    // 651.2, 652: with several players left, the game goes on without the conceding player.
    // That needs the modes with three players or more.
    throw new EngineInvariantError(
      'Removing a player from a game that goes on is not implemented yet',
    );
  }
  // 651.1, 195: the only player remaining wins; the game ends (196).
  draft.winner = winner.id;
  draft.stage = { kind: 'ended' };
  draft.showdown = null;
  draft.combat = null;
  emit(draft, {
    type: 'GameWon',
    rule: '651.1',
    visibility: { kind: 'public' },
    player: winner.id,
  });
}
