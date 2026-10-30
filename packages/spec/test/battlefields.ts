// Helpers for the scenarios that put units on battlefields (447, 341, 469).
// Units enter exhausted (359.2.c), so these scenarios play a few turns to get ready units.

import { apply, autoPayment } from '@foilengine/rules';
import { board } from '@foilengine/testkit';
import type { Action, GameEvent, GameState, ObjectId, PlayerId } from '@foilengine/types';

export const A = 'A' as PlayerId;
export const B = 'B' as PlayerId;
export const v = (n: number) => `Vanilla ${n}`;

export const ofType = <T extends GameEvent['type']>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);

export function act(
  state: GameState,
  ...actions: Action[]
): { state: GameState; events: GameEvent[] } {
  let current = state;
  const events: GameEvent[] = [];
  for (const action of actions) {
    const result = apply(current, action);
    current = result.state;
    events.push(...result.events);
  }
  return { state: current, events };
}

export const zonesOf = (state: GameState, player: PlayerId) => {
  const found = state.players.find((p) => p.id === player);
  if (found === undefined) throw new Error(`No player ${player}`);
  return found.zones;
};

/** The object of `card` (an id like test:vanilla-1) in a player's hand. */
export function inHand(state: GameState, player: PlayerId, card: string): ObjectId {
  const id = zonesOf(state, player).hand.find((o) => state.objects[o]?.card === card);
  if (id === undefined) throw new Error(`${player} has no ${card} in hand`);
  return id;
}

/** Ready runes, or runes in general, in a player's base. */
export function runesOf(state: GameState, player: PlayerId, readyOnly = false): ObjectId[] {
  return zonesOf(state, player).base.filter((id) => {
    const object = state.objects[id];
    return (
      state.cards[object?.card as never]?.category === 'rune' &&
      (!readyOnly || object?.exhausted === false)
    );
  });
}

/** Units in a player's base. */
export function unitsInBase(state: GameState, player: PlayerId): ObjectId[] {
  return zonesOf(state, player).base.filter(
    (id) => state.cards[state.objects[id]?.card as never]?.category === 'unit',
  );
}

export const battlefield = (state: GameState, index: number): ObjectId => {
  const id = state.battlefields[index]?.object;
  if (id === undefined) throw new Error(`No battlefield ${index}`);
  return id;
};

export const endTurn = (state: GameState) => {
  if (state.stage.kind !== 'turn') throw new Error('No turn in progress');
  return act(state, { type: 'EndTurn', player: state.stage.turnPlayer });
};

/** Plays a 1-Energy vanilla from the hand, exhausting the first ready rune. */
export function playCheap(
  state: GameState,
  player: PlayerId,
  card: string,
): { state: GameState; events: GameEvent[] } {
  const [rune] = runesOf(state, player, true);
  if (rune === undefined) throw new Error(`${player} has no ready rune`);
  return act(state, {
    type: 'PlayCard',
    player,
    card: inHand(state, player, card),
    location: { kind: 'base' },
    payment: [{ rune, use: 'exhaust' }],
  });
}

export const move = (player: PlayerId, units: ObjectId[], to: ObjectId | 'base'): Action => ({
  type: 'StandardMove',
  player,
  units,
  destination: to === 'base' ? { kind: 'base' } : { kind: 'battlefield', battlefield: to },
});

/**
 * A goes first with Vanilla 1–4 in hand and draws Vanilla 5, then 6. On turn 1, A plays Vanilla 1
 * and Vanilla 5 (1 Energy + 1 Fury Power, from one rune exhausted then recycled). B has Vanilla 1–4
 * and plays Vanilla 1 on turn 2. The state is A's turn 3 Main Phase: A's two units are ready.
 */
export function turnThree(): GameState {
  let state = board()
    .firstPlayer('A')
    .player('A', { hand: [v(1), v(2), v(3), v(4)], mainDeckTop: [v(5), v(6), v(7)] })
    .player('B', { hand: [v(1), v(2), v(3), v(4)] })
    .afterMulligans()
    .build();
  state = playCheap(state, A, 'test:vanilla-1').state;
  const [r2] = runesOf(state, A, true);
  state = act(state, {
    type: 'PlayCard',
    player: A,
    card: inHand(state, A, 'test:vanilla-5'),
    location: { kind: 'base' },
    payment: [
      { rune: r2 as ObjectId, use: 'exhaust' },
      { rune: r2 as ObjectId, use: 'recycle' },
    ],
  }).state;
  state = endTurn(state).state;
  state = playCheap(state, B, 'test:vanilla-1').state;
  return endTurn(state).state;
}

/** turnThree, then A moves both units to the first battlefield and both players pass: A conquers it. */
export function afterConquest(): { state: GameState; events: GameEvent[] } {
  const state = turnThree();
  const units = unitsInBase(state, A);
  return act(
    state,
    move(A, units, battlefield(state, 0)),
    { type: 'PassFocus', player: A },
    { type: 'PassFocus', player: B },
  );
}

/** Plays `card` from the player's hand to their base, paid with autoPayment. */
export function playPaid(
  state: GameState,
  player: PlayerId,
  card: string,
): { state: GameState; events: GameEvent[] } {
  const object = inHand(state, player, card);
  const cost = state.cards[state.objects[object]?.card as never]?.cost;
  const payment = cost === undefined ? null : autoPayment(state, player, cost);
  if (payment === null) throw new Error(`${player} cannot pay for ${card}`);
  return act(state, {
    type: 'PlayCard',
    player,
    card: object,
    location: { kind: 'base' },
    payment,
  });
}

/** The unit of `card` (an id like test:vanilla-1) that a player has in their base. */
export function baseUnit(state: GameState, player: PlayerId, card: string): ObjectId {
  const id = unitsInBase(state, player).find((u) => state.objects[u]?.card === card);
  if (id === undefined) throw new Error(`${player} has no ${card} in base`);
  return id;
}

/**
 * Before a Combat. A plays Vanilla 1 (Might 1) and Vanilla 5 (Might 5) on turn 1; B plays
 * Vanilla 1 (Might 1) and Vanilla 2 (Might 2) on turn 2; on turn 3, A conquers the first
 * battlefield with `aSends` of its units. Returns B's turn 4 Main Phase: B's two units are ready.
 */
export function beforeCombat(aSends: 'both' | 'vanilla-1'): GameState {
  let state = board()
    .firstPlayer('A')
    .player('A', { hand: [v(1), v(2), v(3), v(4)], mainDeckTop: [v(5), v(6), v(7)] })
    .player('B', { hand: [v(1), v(2), v(3), v(4)] })
    .afterMulligans()
    .build();
  state = playCheap(state, A, 'test:vanilla-1').state;
  const [r2] = runesOf(state, A, true);
  state = act(state, {
    type: 'PlayCard',
    player: A,
    card: inHand(state, A, 'test:vanilla-5'),
    location: { kind: 'base' },
    payment: [
      { rune: r2 as ObjectId, use: 'exhaust' },
      { rune: r2 as ObjectId, use: 'recycle' },
    ],
  }).state;
  state = endTurn(state).state;
  state = playCheap(state, B, 'test:vanilla-1').state;
  state = playPaid(state, B, 'test:vanilla-2').state;
  state = endTurn(state).state;
  const sent = aSends === 'both' ? unitsInBase(state, A) : [baseUnit(state, A, 'test:vanilla-1')];
  state = act(
    state,
    move(A, sent, battlefield(state, 0)),
    { type: 'PassFocus', player: A },
    { type: 'PassFocus', player: B },
  ).state;
  return endTurn(state).state;
}
