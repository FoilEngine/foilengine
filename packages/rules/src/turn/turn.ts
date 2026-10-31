// The turn (301–317): Start of Turn (315), Main Phase (316), Ending Phase (317).
// Phases without a player decision run on their own (305); the engine stops when the
// Turn Player gets Priority in their Main Phase (312.2.a) or when the game ends.

import {
  assertNever,
  type PlayerId,
  type Task,
  type TurnPhase,
  type TurnStep,
} from '@foilengine/types';
import { drawCards } from '../actions/draw.ts';
import { cleanup } from '../cleanup/cleanup.ts';
import { healAllUnits } from '../combat/combat.ts';
import {
  controllerOf,
  type Draft,
  emit,
  objectOf,
  playerOf,
  renewObject,
  updateObject,
} from '../draft.ts';
import { EngineInvariantError } from '../errors.ts';
import { DUEL_SECOND_PLAYER_EXTRA_RUNES } from '../modes/duel.ts';
import { asResources, emptyPool, isEmptyPool } from '../resources/rune-pool.ts';
import { score } from '../scoring/score.ts';

/** 315.3.b: the Turn Player channels 2 runes. */
export const RUNES_PER_CHANNEL = 2;

const PHASE_RULES = {
  awaken: '315.1',
  beginning: '315.2',
  channel: '315.3',
  draw: '315.4',
  main: '316',
  ending: '317',
} as const satisfies Record<TurnPhase, string>;

function enterPhase(draft: Draft, player: PlayerId, turnNumber: number, phase: TurnPhase): void {
  draft.stage = { kind: 'turn', turnPlayer: player, turnNumber, phase };
  emit(draft, {
    type: 'PhaseStarted',
    rule: PHASE_RULES[phase],
    visibility: { kind: 'public' },
    player,
    phase,
  });
}

/** The Turn Player and the turn number, during a turn. */
function currentTurn(draft: Draft): { player: PlayerId; turnNumber: number } {
  const stage = draft.stage;
  if (stage.kind !== 'turn') throw new EngineInvariantError('No turn in progress');
  return { player: stage.turnPlayer, turnNumber: stage.turnNumber };
}

/** Queues the steps of a turn, before any task already outstanding. */
function queueSteps(draft: Draft, steps: readonly TurnStep[]): void {
  draft.tasks = [...steps.map((step): Task => ({ kind: 'turn', step })), ...draft.tasks];
}

/**
 * Runs one step of the turn. Each step is an Outstanding Task (333.1): the engine runs them one
 * after the other, and stops when a Chain must be resolved first (334, 335) or when the Turn
 * Player gets Priority in their Main Phase (312.2.a).
 */
export function runTurnStep(draft: Draft, step: TurnStep): void {
  switch (step) {
    case 'next-turn':
      nextTurn(draft);
      return;
    case 'awaken':
      awaken(draft);
      return;
    case 'beginning': {
      // 315.2.a Beginning Step: start-of-phase effects (M3).
      const { player, turnNumber } = currentTurn(draft);
      enterPhase(draft, player, turnNumber, 'beginning');
      return;
    }
    case 'scoring': {
      // 315.2.b Scoring Step: the Turn Player Holds all battlefields they control (315.2.b.2, 471.2).
      const { player } = currentTurn(draft);
      for (const battlefield of draft.battlefields) {
        if (battlefield.controller === player) score(draft, player, battlefield.object, 'hold');
        if (draft.winner !== null) return;
      }
      cleanup(draft);
      return;
    }
    case 'channel':
      channel(draft);
      return;
    case 'draw': {
      // 315.4 Draw: draw 1 (315.4.b), Burning Out if the Main Deck is empty (315.4.b.1, 315.4.b.2).
      const { player, turnNumber } = currentTurn(draft);
      enterPhase(draft, player, turnNumber, 'draw');
      drawCards(draft, player, 1, '315.4.b');
      if (draft.winner === null) cleanup(draft);
      return;
    }
    case 'main': {
      // 316 Main Phase: every Rune Pool empties (316.3, 167), then start-of-phase effects
      // (316.4, M3). The Turn Player now has Priority in a Neutral Open State (312.2.a).
      const { player, turnNumber } = currentTurn(draft);
      enterPhase(draft, player, turnNumber, 'main');
      emptyRunePools(draft, '316.3');
      cleanup(draft);
      return;
    }
    case 'ending': {
      // 317.1 Ending Step: end-of-turn effects (M3).
      const { player, turnNumber } = currentTurn(draft);
      enterPhase(draft, player, turnNumber, 'ending');
      return;
    }
    case 'expiration': {
      // 317.2 Expiration Step: an Ending Special Cleanup (317.2.a) that heals all units
      // (317.2.b), expires "this turn" effects (317.2.c) and empties every Rune Pool (317.2.d).
      const { player, turnNumber } = currentTurn(draft);
      healAllUnits(draft, '317.2.b');
      // 317.2.c: all "this turn" effects expire simultaneously.
      if (draft.effects.length > 0) {
        const expired = draft.effects.filter((effect) => effect.until === 'end-of-turn').length;
        draft.effects = draft.effects.filter((effect) => effect.until !== 'end-of-turn');
        emit(draft, {
          type: 'EffectsExpired',
          rule: '317.2.c',
          visibility: { kind: 'public' },
          count: expired,
        });
      }
      emptyRunePools(draft, '317.2.d');
      cleanup(draft);
      if (draft.winner !== null) return;
      emit(draft, {
        type: 'TurnEnded',
        rule: '306',
        visibility: { kind: 'public' },
        player,
        turnNumber,
      });
      return;
    }
    default:
      assertNever(step);
  }
}

/**
 * 317.3, 115.1.c: the next player in the looping turn order becomes the Turn Player; after the
 * mulligans, the First Player takes the first turn (118). Their turn starts (315).
 */
function nextTurn(draft: Draft): void {
  const stage = draft.stage;
  const previous = stage.kind === 'turn' ? stage : null;
  const index = previous === null ? -1 : draft.turnOrder.indexOf(previous.turnPlayer);
  const playerId = draft.turnOrder[(index + 1) % draft.turnOrder.length];
  if (playerId === undefined) throw new EngineInvariantError('Empty turn order');
  const turnNumber = (previous?.turnNumber ?? 0) + 1;
  const player = playerOf(draft, playerId);
  player.turnsTaken += 1;
  // 472: a player Scores each battlefield once per turn; a new turn starts a new count.
  for (const p of draft.players) p.scoredThisTurn = [];
  emit(draft, {
    type: 'TurnStarted',
    rule: '315',
    visibility: { kind: 'public' },
    player: playerId,
    turnNumber,
  });
  draft.stage = { kind: 'turn', turnPlayer: playerId, turnNumber, phase: 'awaken' };
  queueSteps(draft, ['awaken', 'beginning', 'scoring', 'channel', 'draw', 'main']);
}

/** 315.1 Awaken: the Turn Player readies all game objects they control (315.1.b, 416.3.a). */
function awaken(draft: Draft): void {
  const { player: playerId, turnNumber } = currentTurn(draft);
  const player = playerOf(draft, playerId);
  // Permanents and runes they control are in their base (107.1.c), and their units at battlefields.
  enterPhase(draft, playerId, turnNumber, 'awaken');
  const controlled = [
    ...player.zones.base,
    ...draft.battlefields.flatMap((b) =>
      b.units.filter((unit) => controllerOf(draft, unit) === playerId),
    ),
  ];
  const exhausted = controlled.filter((id) => objectOf(draft, id).exhausted);
  for (const id of exhausted) updateObject(draft, id, { exhausted: false });
  if (exhausted.length > 0) {
    emit(draft, {
      type: 'ObjectsReadied',
      rule: '315.1.b',
      visibility: { kind: 'public' },
      player: playerId,
      objects: exhausted,
    });
  }
  cleanup(draft); // 319.2
}

/**
 * 315.3 Channel: 2 runes, or as many as possible (315.3.b, 315.3.b.1); in 1v1 the player going
 * second channels an extra rune during their first Channel Phase (487.7).
 */
function channel(draft: Draft): void {
  const { player: playerId, turnNumber } = currentTurn(draft);
  const player = playerOf(draft, playerId);
  enterPhase(draft, playerId, turnNumber, 'channel');
  const second = draft.turnOrder[1];
  const extra = playerId === second && player.turnsTaken === 1 ? DUEL_SECOND_PLAYER_EXTRA_RUNES : 0;
  channelRunes(draft, playerId, RUNES_PER_CHANNEL, '315.3.b');
  channelRunes(draft, playerId, extra, '487.7');
  cleanup(draft); // 319.2, 319.6
}

/** The Turn Player ended their turn (316.9): the Ending Phase, then the next turn (317.3). */
export function endTurn(draft: Draft): void {
  currentTurn(draft);
  queueSteps(draft, ['ending', 'expiration', 'next-turn']);
}

/** Every player's Rune Pool empties; unspent resources are lost (167, 167.1). */
function emptyRunePools(draft: Draft, rule: '316.3' | '317.2.d'): void {
  for (const player of draft.players) {
    if (isEmptyPool(player.runePool)) continue;
    const lost = asResources(player.runePool);
    player.runePool = emptyPool();
    emit(draft, {
      type: 'RunePoolEmptied',
      rule,
      visibility: { kind: 'public' },
      player: player.id,
      lost,
    });
  }
}

/** Channels up to `count` runes from the top of the Rune Deck to the base, ready (431.1, 431.2.a). */
function channelRunes(
  draft: Draft,
  playerId: PlayerId,
  count: number,
  rule: '315.3.b' | '487.7',
): void {
  const zones = playerOf(draft, playerId).zones;
  for (let i = 0; i < count && zones.runeDeck.length > 0; i++) {
    const top = zones.runeDeck.shift() as (typeof zones.runeDeck)[number];
    // From a Non-Board Zone to the board: a new object (124).
    const rune = renewObject(draft, top);
    zones.base.push(rune.id);
    emit(draft, {
      type: 'RuneChanneled',
      rule,
      visibility: { kind: 'public' },
      player: playerId,
      object: rune.id,
      card: rune.card,
      exhausted: rune.exhausted,
    });
  }
}
