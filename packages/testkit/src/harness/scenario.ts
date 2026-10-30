// scenario(): one rule, one behavior, its number in the title (docs/06-testing.md).
//
//   scenario('rule 117.2: the player draws as many cards as they set aside', {
//     rules: ['117.2'],
//     setup: board().firstPlayer('A').player('A', { hand: [...], mainDeckTop: [...] }),
//     act: (t) => t.act(t.mulligan('A', ['Vanilla 1', 'Vanilla 2'])),
//     check: (t) => t.expect(t.hand('A')).toEqual([...]),
//   });

import { apply, isLegal, pendingDecision } from '@foilengine/rules';
import type {
  Action,
  CardId,
  Decision,
  GameEvent,
  GameEventType,
  GameState,
  IllegalCode,
  IllegalReason,
  Mulligan,
  ObjectId,
  PlayerId,
  PlayerState,
} from '@foilengine/types';
import { expect, it } from 'vitest';
import { type BoardBuilder, type CardRef, resolveCard } from './board.ts';
import { ruleExists } from './core-rules.ts';

export type ScenarioContext = {
  /** The current state, updated by `act`. */
  readonly state: GameState;
  /** Events produced by the last `act` call. */
  readonly events: readonly GameEvent[];
  /** Applies actions in order; fails the test with the engine's reason if one is illegal. */
  act(...actions: Action[]): void;
  /** Checks that the action is refused, optionally with this code, and returns the reason. */
  actIllegal(action: Action, code?: IllegalCode): IllegalReason;
  expectLegal(action: Action): void;
  expectIllegal(action: Action, code?: IllegalCode): IllegalReason;
  /** Checks the types of the events of the last `act`, in order. */
  expectEvents(types: readonly GameEventType[]): void;
  expectDecision(decision: Partial<Decision> | null): void;
  /** Builds a Mulligan setting aside the given cards (ids or names) of the player's hand. */
  mulligan(player: string, cards: readonly CardRef[]): Mulligan;
  player(id: string): PlayerState;
  /** Cards in the player's hand, in order. */
  hand(id: string): CardId[];
  /** Cards of the player's Main Deck, top first. */
  mainDeck(id: string): CardId[];
  readonly expect: typeof expect;
};

export type ScenarioDefinition = {
  /** The rules under test, as printed in the Core Rules. The title starts with the first one. */
  readonly rules: readonly string[];
  readonly setup: BoardBuilder | (() => GameState);
  readonly act?: (t: ScenarioContext) => void;
  readonly check: (t: ScenarioContext) => void;
};

/** Problems with a scenario's title or rules, or an empty list. */
export function checkScenarioDefinition(title: string, rules: readonly string[]): string[] {
  const problems: string[] = [];
  const first = rules[0];
  if (first === undefined) problems.push('A scenario declares at least one rule');
  else if (!title.startsWith(`rule ${first}: `)) {
    problems.push(`The title must start with "rule ${first}: " (the first declared rule)`);
  }
  for (const rule of rules) {
    if (!ruleExists(rule)) problems.push(`Rule ${rule} does not exist in the current Core Rules`);
  }
  return problems;
}

export function scenario(title: string, definition: ScenarioDefinition): void {
  const problems = checkScenarioDefinition(title, definition.rules);
  if (problems.length > 0) throw new Error(`Invalid scenario "${title}": ${problems.join('; ')}`);

  it(title, () => {
    const initial =
      typeof definition.setup === 'function' ? definition.setup() : definition.setup.build();
    const t = createContext(initial);
    definition.act?.(t);
    definition.check(t);
  });
}

function createContext(initial: GameState): ScenarioContext {
  let state = initial;
  let events: GameEvent[] = [];

  const playerState = (id: string): PlayerState => {
    const found = state.players.find((p) => p.id === id);
    if (found === undefined) throw new Error(`No player ${id}`);
    return found;
  };
  const cardsOf = (ids: readonly ObjectId[]) => ids.map((id) => state.objects[id]?.card as CardId);
  const refused = (action: Action, code?: IllegalCode): IllegalReason => {
    const legality = isLegal(state, action);
    if (legality.ok) throw new Error(`Expected ${JSON.stringify(action)} to be illegal`);
    if (code !== undefined) expect(legality.reason.code).toBe(code);
    return legality.reason;
  };

  const t: ScenarioContext = {
    get state() {
      return state;
    },
    get events() {
      return events;
    },
    act(...actions) {
      events = [];
      for (const action of actions) {
        const legality = isLegal(state, action);
        if (!legality.ok) {
          throw new Error(`Illegal action ${JSON.stringify(action)}: ${legality.reason.message}`);
        }
        const result = apply(state, action);
        state = result.state;
        events.push(...result.events);
      }
    },
    actIllegal(action, code) {
      const before = state;
      const reason = refused(action, code);
      expect(() => apply(state, action)).toThrow(reason.message);
      expect(state).toBe(before);
      return reason;
    },
    expectLegal(action) {
      expect(isLegal(state, action)).toEqual({ ok: true });
    },
    expectIllegal: refused,
    expectEvents(types) {
      expect(events.map((event) => event.type)).toEqual(types);
    },
    expectDecision(decision) {
      if (decision === null) expect(pendingDecision(state)).toBeNull();
      else expect(pendingDecision(state)).toMatchObject(decision);
    },
    mulligan(player, cards) {
      const hand = [...playerState(player).zones.hand];
      const setAside = cards.map((ref) => {
        const card = resolveCard(state.cards, ref);
        const index = hand.findIndex((id) => state.objects[id]?.card === card);
        if (index === -1) throw new Error(`${player} has no "${ref}" in hand`);
        return hand.splice(index, 1)[0] as ObjectId;
      });
      return { type: 'Mulligan', player: player as PlayerId, setAside };
    },
    player: playerState,
    hand: (id) => cardsOf(playerState(id).zones.hand),
    mainDeck: (id) => cardsOf(playerState(id).zones.mainDeck),
    expect,
  };
  return t;
}
