// Type-level tests: they fail at `pnpm typecheck` when a type breaks a contract.
// The few runtime assertions check the constants.

import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  type Action,
  assertNever,
  type CardDrawn,
  type CardRecycled,
  type Decision,
  type EventOfType,
  type GameEvent,
  type GameEventType,
  type GameSetup,
  type GameState,
  type HiddenZone,
  type IllegalReason,
  type Json,
  type ObjectId,
  type OpponentZones,
  type OwnZones,
  PLAYER_ZONE_PRIVACY,
  type PlayerId,
  type PlayerView,
  PRIVATE_EVENT_FIELDS,
  type RedactedEvent,
  type RuleNumber,
  type SetupProblem,
  STATE_VERSION,
  type VisibleEvent,
  type VisibleObject,
} from '../src/index.ts';

describe('pure JSON (ADR 0004)', () => {
  it('state, setup, actions, events, decisions and views are JSON', () => {
    expectTypeOf<GameState>().toExtend<Json>();
    expectTypeOf<GameSetup>().toExtend<Json>();
    expectTypeOf<Action>().toExtend<Json>();
    expectTypeOf<GameEvent>().toExtend<Json>();
    expectTypeOf<VisibleEvent>().toExtend<Json>();
    expectTypeOf<Decision>().toExtend<Json>();
    expectTypeOf<PlayerView>().toExtend<Json>();
    expectTypeOf<IllegalReason>().toExtend<Json>();
    expectTypeOf<SetupProblem>().toExtend<Json>();
  });

  it('the state has a schema version', () => {
    expect(STATE_VERSION).toBe(3);
    expectTypeOf<GameState['version']>().toEqualTypeOf<3>();
  });
});

describe('identifiers', () => {
  it('a plain string is not an ObjectId or a PlayerId', () => {
    // @ts-expect-error a raw string must be branded by the engine
    const object: ObjectId = 'o1';
    // @ts-expect-error a raw string must be branded by the engine
    const player: PlayerId = 'p1';
    // @ts-expect-error ids of different kinds do not mix
    const mixed: PlayerId = object;
    expect([object, player, mixed]).toHaveLength(3);
  });

  it('rule numbers are written as printed in the Core Rules', () => {
    const numbers: RuleNumber[] = ['000', '117', '315.3.b.1', '103.2.b'];
    // @ts-expect-error not a rule number
    const wrong: RuleNumber = 'rule 117';
    expect([...numbers, wrong]).toHaveLength(5);
  });
});

describe('event visibility (ADR 0005)', () => {
  type RedactedDraw = Extract<RedactedEvent, { type: 'CardDrawn' }>;
  type RedactedRecycle = Extract<RedactedEvent, { type: 'CardRecycled' }>;

  it('a redacted draw says who drew, not what or which object', () => {
    expectTypeOf<RedactedDraw>().toHaveProperty('player');
    expectTypeOf<RedactedDraw>().not.toHaveProperty('card');
    expectTypeOf<RedactedDraw>().not.toHaveProperty('object');
  });

  it('a redacted recycle hides the card and both object ids', () => {
    expectTypeOf<RedactedRecycle>().not.toHaveProperty('card');
    expectTypeOf<RedactedRecycle>().not.toHaveProperty('object');
    expectTypeOf<RedactedRecycle>().not.toHaveProperty('previousObject');
  });

  it('private fields are real fields of their event', () => {
    expectTypeOf<'card' | 'object'>().toExtend<keyof CardDrawn>();
    expectTypeOf<'card' | 'object' | 'previousObject'>().toExtend<keyof CardRecycled>();
  });

  it('every event type has its private fields declared', () => {
    const types: GameEventType[] = Object.keys(PRIVATE_EVENT_FIELDS) as GameEventType[];
    expect(types).toHaveLength(22);
    expect(PRIVATE_EVENT_FIELDS.CardDrawn).toEqual(['object', 'card']);
  });
});

describe('player views (ADR 0006)', () => {
  it("an opponent's hand and decks only expose their size", () => {
    expectTypeOf<OpponentZones['hand']>().toEqualTypeOf<HiddenZone>();
    expectTypeOf<OpponentZones['mainDeck']>().toEqualTypeOf<HiddenZone>();
    expectTypeOf<OpponentZones['runeDeck']>().toEqualTypeOf<HiddenZone>();
    expectTypeOf<HiddenZone>().toEqualTypeOf<{ readonly size: number }>();
  });

  it('the viewer sees their own hand but not their own decks', () => {
    expectTypeOf<OwnZones['hand']>().toEqualTypeOf<readonly VisibleObject[]>();
    expectTypeOf<OwnZones['mainDeck']>().toEqualTypeOf<HiddenZone>();
  });

  it('a view carries no card definitions that could reveal a deck list', () => {
    expectTypeOf<PlayerView>().not.toHaveProperty('cards');
    expectTypeOf<PlayerView>().not.toHaveProperty('objects');
  });
});

describe('zones (107–108, 128)', () => {
  it('have the privacy the Core Rules give them', () => {
    expect(PLAYER_ZONE_PRIVACY.hand).toBe('private');
    expect(PLAYER_ZONE_PRIVACY.mainDeck).toBe('secret');
    expect(PLAYER_ZONE_PRIVACY.runeDeck).toBe('secret');
    expect(PLAYER_ZONE_PRIVACY.trash).toBe('public');
  });
});

describe('assertNever', () => {
  it('makes switches over actions and events exhaustive', () => {
    const describeAction = (action: Action): string => {
      switch (action.type) {
        case 'Mulligan':
          return 'mulligan';
        case 'EndTurn':
          return 'end turn';
        case 'PlayCard':
          return 'play card';
        default:
          return assertNever(action);
      }
    };
    const isPublicByDefault = (event: GameEvent): boolean => {
      const type: GameEventType = event.type;
      return PRIVATE_EVENT_FIELDS[type].length === 0;
    };
    expectTypeOf(describeAction).returns.toEqualTypeOf<string>();
    expectTypeOf(isPublicByDefault).parameter(0).toEqualTypeOf<GameEvent>();
    expectTypeOf<EventOfType<'CardDrawn'>>().toEqualTypeOf<CardDrawn>();
  });

  it('throws when reached at runtime', () => {
    expect(() => assertNever('unexpected' as never)).toThrow('Unexpected value: "unexpected"');
  });
});
