// Cleanup (318–323). It becomes an outstanding task after phase transitions (319.2),
// objects entering or leaving the board (319.6), status changes (319.7), moves (319.8, 455)…
// It repeats until it changes nothing (322).
//
// Steps implemented: 1 (victory), 4 (loss of control), 6 (stage showdowns), 8 (remove Contested)
// and 9 (begin a showdown). Steps 2, 3, 7 and 10 act on combat and damage, which arrive with
// combat; step 5 recalls gear and misplaced runes, which cannot exist yet.

import { type Draft, emit, playersAt } from '../draft.ts';
import { EngineInvariantError } from '../errors.ts';
import { DUEL_VICTORY_SCORE } from '../modes/duel.ts';
import { startShowdown } from '../showdown/showdown.ts';

/** A cleanup that keeps changing the state this many times is a bug. */
const MAX_CLEANUP_ROUNDS = 50;

export function cleanup(draft: Draft): void {
  for (let round = 0; round < MAX_CLEANUP_ROUNDS; round++) {
    if (draft.winner !== null) return;
    if (!cleanupOnce(draft)) return;
  }
  throw new EngineInvariantError(`Cleanup did not settle after ${MAX_CLEANUP_ROUNDS} rounds`);
}

/** One cleanup, in the order of 323. Returns whether it changed the state. */
function cleanupOnce(draft: Draft): boolean {
  let changed = false;

  // 1 (323.1).
  if (checkVictory(draft, '323.1')) return true;

  // 4 (323.5): players lose control of battlefields where they have no units, in an Open State,
  // with no Showdown or Combat there (190.4.c). M2 has no chain: the state is always Open.
  for (const battlefield of draft.battlefields) {
    const controller = battlefield.controller;
    if (controller === null || draft.showdown?.battlefield === battlefield.object) continue;
    if (!playersAt(draft, battlefield).has(controller)) {
      battlefield.controller = null;
      emit(draft, {
        type: 'ControlLost',
        rule: '323.5',
        visibility: { kind: 'public' },
        player: controller,
        battlefield: battlefield.object,
      });
      changed = true;
    }
  }

  // 6 (323.7): stage a Showdown at each Contested battlefield where none is ongoing or staged.
  for (const battlefield of draft.battlefields) {
    if (
      battlefield.contestedBy !== null &&
      !battlefield.showdownStaged &&
      draft.showdown?.battlefield !== battlefield.object
    ) {
      battlefield.showdownStaged = true;
      changed = true;
    }
  }

  // 8 (323.10, 190.3.b.1): remove Contested where the player who applied it has no units,
  // and no Showdown is ongoing.
  for (const battlefield of draft.battlefields) {
    const applier = battlefield.contestedBy;
    if (applier === null || draft.showdown?.battlefield === battlefield.object) continue;
    if (!playersAt(draft, battlefield).has(applier)) {
      battlefield.contestedBy = null;
      battlefield.showdownStaged = false;
      changed = true;
    }
  }

  // 9 (323.11): in a Neutral Open State, the Turn Player chooses a battlefield with a staged
  // Showdown, and it begins there (344).
  if (draft.showdown === null && draft.stage.kind === 'turn') {
    const staged = draft.battlefields.filter((b) => b.showdownStaged);
    if (staged.length > 1) {
      // The Turn Player's choice is a Decision: a single Standard Move has one destination
      // (144.3.a), so two staged Showdowns need effects that arrive with M3.
      throw new EngineInvariantError(
        'Choosing among several staged Showdowns is not implemented yet',
      );
    }
    const [battlefield] = staged;
    if (battlefield !== undefined) {
      startShowdown(draft, battlefield.object);
      changed = true;
    }
  }

  return changed;
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
      draft.showdown = null;
      emit(draft, { type: 'GameWon', rule, visibility: { kind: 'public' }, player: player.id });
      return true;
    }
  }
  return false;
}
