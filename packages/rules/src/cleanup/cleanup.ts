// Cleanup (318–323). It becomes an outstanding task after phase transitions (319.2),
// objects entering or leaving the board (319.6), status changes (319.7), moves (319.8, 455)…
// It repeats until it changes nothing (322).
//
// Steps implemented: 1 (victory), 3a (lethal damage), 4 (loss of control), 6 and 7 (stage
// showdowns and combats), 7a (unstage), 8 (remove Contested), 9 and 10 (begin a showdown or
// a combat). Step 2 has nothing to do: the Attacker and Defender designations live with the
// Combat (466.2.c.3). Step 5 recalls gear and misplaced runes, which cannot exist yet. Step 10a
// needs a unit to arrive during a non-combat Showdown, which needs spells (M3).

import { killLethalUnits, startCombat } from '../combat/combat.ts';
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
  const ongoingAt = (battlefield: string) =>
    draft.showdown?.battlefield === battlefield || draft.combat?.battlefield === battlefield;

  // 1 (323.1).
  if (checkVictory(draft, '323.1')) return true;

  // 3a (323.4): units with lethal damage are killed.
  if (killLethalUnits(draft)) changed = true;

  // 4 (323.5): players lose control of battlefields where they have no units, in an Open State
  // (no Chain, 309.2), with no Showdown or Combat there (190.4.c).
  for (const battlefield of draft.chain === null ? draft.battlefields : []) {
    const controller = battlefield.controller;
    if (controller === null || ongoingAt(battlefield.object)) continue;
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

  // 6 (323.7): stage a Showdown at each Contested battlefield with no ongoing Showdown or Combat.
  // 7 (323.8): stage a Combat where units of opposing players are present too.
  // 7a (323.9): a staged Combat stops being staged when they are no longer both present.
  for (const battlefield of draft.battlefields) {
    if (battlefield.contestedBy === null || ongoingAt(battlefield.object)) continue;
    if (!battlefield.showdownStaged) {
      battlefield.showdownStaged = true;
      changed = true;
    }
    const opposing = playersAt(draft, battlefield).size >= 2;
    if (opposing !== battlefield.combatStaged) {
      battlefield.combatStaged = opposing;
      changed = true;
    }
  }

  // 8 (323.10, 190.3.b.1): remove Contested where the player who applied it has no units,
  // and no Showdown or Combat is ongoing.
  for (const battlefield of draft.battlefields) {
    const applier = battlefield.contestedBy;
    if (applier === null || ongoingAt(battlefield.object)) continue;
    if (!playersAt(draft, battlefield).has(applier)) {
      battlefield.contestedBy = null;
      battlefield.showdownStaged = false;
      battlefield.combatStaged = false;
      changed = true;
    }
  }

  // 9 (323.11) and 10 (323.12): in a Neutral Open State, the Turn Player chooses a battlefield
  // with a staged Showdown without a staged Combat, and it begins (344); otherwise one with a
  // staged Combat, and it begins (462), opening with a Combat Showdown (463.3).
  const neutral = () =>
    draft.chain === null &&
    draft.showdown === null &&
    draft.combat === null &&
    draft.stage.kind === 'turn';
  if (neutral()) {
    const showdowns = draft.battlefields.filter((b) => b.showdownStaged && !b.combatStaged);
    const [showdown] = showdowns;
    if (showdowns.length > 1) throw tooManyStaged('Showdowns');
    if (showdown !== undefined) {
      startShowdown(draft, showdown.object);
      changed = true;
    }
  }
  if (neutral()) {
    const combats = draft.battlefields.filter((b) => b.combatStaged);
    const [combat] = combats;
    if (combats.length > 1) throw tooManyStaged('Combats');
    if (combat !== undefined) {
      startCombat(draft, combat.object);
      changed = true;
    }
  }

  return changed;
}

/**
 * The Turn Player's choice among several staged Showdowns or Combats (323.11, 323.12, 463.1) is a
 * Decision: a single Standard Move has one destination (144.3.a), so it needs effects (M3).
 */
function tooManyStaged(what: string): EngineInvariantError {
  return new EngineInvariantError(`Choosing among several staged ${what} is not implemented yet`);
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
      draft.combat = null;
      emit(draft, { type: 'GameWon', rule, visibility: { kind: 'public' }, player: player.id });
      return true;
    }
  }
  return false;
}
