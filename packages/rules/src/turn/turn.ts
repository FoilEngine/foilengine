// The turn (301–317): Start of Turn (315), Main Phase (316), Ending Phase (317).
// Phases without a player decision run on their own (305); the engine stops when the
// Turn Player gets Priority in their Main Phase (312.2.a) or when the game ends.

import type { PlayerId, TurnPhase } from '@foilengine/types';
import { drawCards } from '../actions/draw.ts';
import { cleanup } from '../cleanup/cleanup.ts';
import { type Draft, emit, objectOf, playerOf, renewObject, updateObject } from '../draft.ts';
import { EngineInvariantError } from '../errors.ts';
import { DUEL_SECOND_PLAYER_EXTRA_RUNES } from '../modes/duel.ts';
import { asResources, emptyPool, isEmptyPool } from '../resources/rune-pool.ts';

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

/** Starts a turn and runs it until the Turn Player gets Priority in their Main Phase. */
export function startTurn(draft: Draft, playerId: PlayerId, turnNumber: number): void {
  const player = playerOf(draft, playerId);
  player.turnsTaken += 1;
  emit(draft, {
    type: 'TurnStarted',
    rule: '315',
    visibility: { kind: 'public' },
    player: playerId,
    turnNumber,
  });

  // 315.1 Awaken: the Turn Player readies all game objects they control (315.1.b, 416.3.a).
  // Permanents and runes they control are in their base (107.1.c); units at battlefields arrive later.
  enterPhase(draft, playerId, turnNumber, 'awaken');
  const exhausted = player.zones.base.filter((id) => objectOf(draft, id).exhausted);
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
  if (draft.winner !== null) return;

  // 315.2 Beginning: start-of-phase effects (M3), then the scoring step where the
  // Turn Player holds the battlefields they control (315.2.b, arrives with control).
  enterPhase(draft, playerId, turnNumber, 'beginning');
  cleanup(draft);
  if (draft.winner !== null) return;

  // 315.3 Channel: 2 runes, or as many as possible (315.3.b, 315.3.b.1); in 1v1 the player
  // going second channels an extra rune during their first Channel Phase (487.7).
  enterPhase(draft, playerId, turnNumber, 'channel');
  const second = draft.turnOrder[1];
  const extra = playerId === second && player.turnsTaken === 1 ? DUEL_SECOND_PLAYER_EXTRA_RUNES : 0;
  channelRunes(draft, playerId, RUNES_PER_CHANNEL, '315.3.b');
  channelRunes(draft, playerId, extra, '487.7');
  cleanup(draft); // 319.2, 319.6
  if (draft.winner !== null) return;

  // 315.4 Draw: draw 1 (315.4.b), Burning Out if the Main Deck is empty (315.4.b.1, 315.4.b.2).
  enterPhase(draft, playerId, turnNumber, 'draw');
  drawCards(draft, playerId, 1, '315.4.b');
  if (draft.winner !== null) return;
  cleanup(draft);
  if (draft.winner !== null) return;

  // 316 Main Phase: every Rune Pool empties (316.3, 167), then start-of-phase effects
  // (316.4, M3). The Turn Player now has Priority in a Neutral Open State (312.2.a).
  enterPhase(draft, playerId, turnNumber, 'main');
  emptyRunePools(draft, '316.3');
  cleanup(draft);
}

/** The Turn Player ended their turn (316.9): Ending Phase, then the next turn (317.3). */
export function endTurn(draft: Draft): void {
  const stage = draft.stage;
  if (stage.kind !== 'turn') throw new EngineInvariantError('No turn in progress');
  const { turnPlayer, turnNumber } = stage;

  // 317 Ending Phase: the Ending Step (317.1, effects in M3), then the Expiration Step (317.2):
  // an Ending Special Cleanup that heals units (no damage yet), expires "this turn" effects
  // (none yet) and empties every Rune Pool (317.2.d, 167).
  enterPhase(draft, turnPlayer, turnNumber, 'ending');
  emptyRunePools(draft, '317.2.d');
  cleanup(draft);
  if (draft.winner !== null) return;
  emit(draft, {
    type: 'TurnEnded',
    rule: '306',
    visibility: { kind: 'public' },
    player: turnPlayer,
    turnNumber,
  });

  // 317.3, 115.1.c: the next player in the looping turn order becomes the Turn Player.
  const index = draft.turnOrder.indexOf(turnPlayer);
  const next = draft.turnOrder[(index + 1) % draft.turnOrder.length];
  if (next === undefined) throw new EngineInvariantError('Empty turn order');
  startTurn(draft, next, turnNumber + 1);
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
