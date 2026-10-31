// Mulligan (117): in turn order, each player may set aside up to two cards (117.1),
// draws as many (117.2), then recycles the cards set aside (117.3).

import type {
  GameState,
  IllegalReason,
  Mulligan,
  MulliganDecision,
  ObjectId,
} from '@foilengine/types';
import { drawCards } from '../actions/draw.ts';
import { type Draft, draftOf, emit, objectOf, playerOf, renewObject, stateOf } from '../draft.ts';
import { EngineInvariantError } from '../errors.ts';
import { shuffle } from '../rng/xoshiro128.ts';
import { settle } from '../tasks/tasks.ts';

/** 117.1: up to two cards. */
export const MULLIGAN_MAX = 2;

export function mulliganDecision(state: GameState): MulliganDecision | null {
  if (state.stage.kind !== 'mulligan') return null;
  const player = state.stage.pending[0];
  return player === undefined
    ? null
    : { kind: 'Mulligan', player, max: MULLIGAN_MAX, rule: '117.1' };
}

export function checkMulligan(state: GameState, action: Mulligan): IllegalReason | null {
  const decision = mulliganDecision(state);
  if (decision === null) {
    return { code: 'wrong-action', message: 'No mulligan is pending', rule: '117' };
  }
  if (action.player !== decision.player) {
    return {
      code: 'not-your-decision',
      message: `Players perform their Mulligan in turn order: ${decision.player} decides first`,
      rule: '117',
    };
  }
  if (action.setAside.length > MULLIGAN_MAX) {
    return {
      code: 'too-many-cards',
      message: `At most ${MULLIGAN_MAX} cards can be set aside, got ${action.setAside.length}`,
      rule: '117.1',
    };
  }
  if (new Set(action.setAside).size !== action.setAside.length) {
    return { code: 'duplicate-card', message: 'A card was chosen twice', rule: '117.1' };
  }
  const hand = state.players.find((player) => player.id === action.player)?.zones.hand ?? [];
  const missing = action.setAside.filter((id) => !hand.includes(id));
  if (missing.length > 0) {
    return {
      code: 'card-not-in-hand',
      message: `Not in ${action.player}'s hand: ${missing.join(', ')}`,
      rule: '117.1',
    };
  }
  return null;
}

/** Every legal Mulligan for the player: every subset of the hand of at most two cards. */
export function mulliganActions(state: GameState): Mulligan[] {
  const decision = mulliganDecision(state);
  if (decision === null) return [];
  const hand = state.players.find((player) => player.id === decision.player)?.zones.hand ?? [];
  const actions: Mulligan[] = [{ type: 'Mulligan', player: decision.player, setAside: [] }];
  hand.forEach((a, i) => {
    actions.push({ type: 'Mulligan', player: decision.player, setAside: [a] });
    for (const b of hand.slice(i + 1)) {
      actions.push({ type: 'Mulligan', player: decision.player, setAside: [a, b] });
    }
  });
  return actions;
}

/** Applies a Mulligan already checked by `checkMulligan`. */
export function applyMulligan(
  state: GameState,
  action: Mulligan,
): { state: GameState; events: Draft['events'] } {
  if (state.stage.kind !== 'mulligan') throw new EngineInvariantError('No mulligan is pending');
  const draft = draftOf(state);
  const player = playerOf(draft, action.player);

  // 117.1: set the chosen cards aside.
  player.zones.hand = player.zones.hand.filter((id) => !action.setAside.includes(id));
  emit(draft, {
    type: 'MulliganTaken',
    rule: '117',
    visibility: { kind: 'public' },
    player: action.player,
    count: action.setAside.length,
  });

  // 117.2: draw as many cards as were set aside.
  drawCards(draft, action.player, action.setAside.length, '117.2');

  // 117.3: recycle the cards set aside to the bottom of the Main Deck (417.1.a),
  // in a random order when there are two or more (417.5). Each becomes a new object (124).
  const order = shuffle(draft.rng, action.setAside);
  draft.rng = order.rng;
  const renewed = new Map<ObjectId, ObjectId>();
  for (const id of order.value as ObjectId[]) {
    const recycled = renewObject(draft, id);
    player.zones.mainDeck.push(recycled.id);
    renewed.set(id, recycled.id);
  }
  // The order of the Main Deck is secret, to its owner too (108.4.e): the events follow the
  // cards as they were set aside, and the new objects are hidden from every player.
  for (const id of action.setAside) {
    const recycled = renewed.get(id) as ObjectId;
    emit(draft, {
      type: 'CardRecycled',
      rule: '117.3',
      visibility: { kind: 'private', to: [] },
      player: action.player,
      object: recycled,
      previousObject: id,
      card: objectOf(draft, recycled).card,
      from: 'hand',
      to: 'mainDeck',
    });
  }

  const pending = state.stage.pending.slice(1);
  if (pending.length > 0) {
    draft.stage = { kind: 'mulligan', pending };
    return { state: stateOf(state, draft), events: draft.events };
  }

  // 118: begin play with the First Player taking their turn.
  const first = state.turnOrder[0];
  if (first === undefined) throw new EngineInvariantError('Empty turn order');
  emit(draft, {
    type: 'SetupCompleted',
    rule: '118',
    visibility: { kind: 'public' },
    firstPlayer: first,
  });
  draft.tasks = [{ kind: 'turn', step: 'next-turn' }];
  settle(draft);
  return { state: stateOf(state, draft), events: draft.events };
}
