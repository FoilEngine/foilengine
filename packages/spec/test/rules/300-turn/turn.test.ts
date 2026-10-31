import { apply, legalActions } from '@foilengine/rules';
import { board, scenario } from '@foilengine/testkit';
import type { GameEvent, GameState, ObjectId, PlayerId } from '@foilengine/types';
import { describe } from 'vitest';

const A = 'A' as PlayerId;
const B = 'B' as PlayerId;
const v = (n: number) => `Vanilla ${n}`;

/** A goes first; both players keep their hand. */
const mulligansDone = (t: {
  act: (...a: never[]) => void;
  mulligan: (p: string, c: string[]) => never;
}) => t.act(t.mulligan('A', []), t.mulligan('B', []));

const ofType = <T extends GameEvent['type']>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);

/** Ends turns until it is `player`'s turn number `turnNumber`, returning that turn's events. */
function playUntil(
  state: GameState,
  turnNumber: number,
): { state: GameState; events: GameEvent[] } {
  let current = state;
  let events: GameEvent[] = [];
  while (current.stage.kind === 'turn' && current.stage.turnNumber < turnNumber) {
    const player = current.stage.turnPlayer;
    const result = apply(current, { type: 'EndTurn', player });
    current = result.state;
    events = result.events;
  }
  return { state: current, events };
}

describe('315 Start of Turn', () => {
  scenario(
    'rule 315: the turn starts with the Awaken, Beginning, Channel and Draw phases, then the Main Phase',
    {
      rules: ['315', '315.1', '315.2', '315.3', '315.4', '316'],
      setup: board().firstPlayer('A'),
      act: mulligansDone as never,
      check: (t) => {
        const phases = ofType(t.events, 'PhaseStarted');
        t.expect(phases.map((e) => [e.phase, e.rule])).toEqual([
          ['awaken', '315.1'],
          ['beginning', '315.2'],
          ['channel', '315.3'],
          ['draw', '315.4'],
          ['main', '316'],
        ]);
        t.expect(t.state.stage).toEqual({
          kind: 'turn',
          turnPlayer: A,
          turnNumber: 1,
          phase: 'main',
        });
      },
    },
  );

  scenario('rule 315.3.b: the Turn Player channels 2 runes from the top of their Rune Deck', {
    rules: ['315.3.b', '431.1', '107.1.c'],
    setup: board().firstPlayer('A'),
    check: (t) => {
      const top = t.player('A').zones.runeDeck.slice(0, 2);
      mulligansDone(t as never);
      const channeled = ofType(t.events, 'RuneChanneled');
      t.expect(channeled.map((e) => [e.player, e.rule])).toEqual([
        [A, '315.3.b'],
        [A, '315.3.b'],
      ]);
      t.expect(t.player('A').zones.base).toEqual(channeled.map((e) => e.object));
      t.expect(channeled.map((e) => t.state.objects[e.object]?.previousObjectId)).toEqual(top);
      t.expect(t.player('A').zones.runeDeck).toHaveLength(10);
    },
  });

  scenario('rule 431.2.a: runes are channeled ready', {
    rules: ['431.2.a'],
    setup: board().firstPlayer('A'),
    act: mulligansDone as never,
    check: (t) => {
      for (const id of t.player('A').zones.base)
        t.expect(t.state.objects[id]?.exhausted).toBe(false);
    },
  });

  scenario('rule 124: a channeled rune leaves a Non-Board Zone and becomes a new object', {
    rules: ['124'],
    setup: board().firstPlayer('A'),
    check: (t) => {
      const top = t.player('A').zones.runeDeck[0] as ObjectId;
      mulligansDone(t as never);
      t.expect(t.state.objects[top]).toBeUndefined();
      t.expect(t.player('A').zones.base).not.toContain(top);
    },
  });

  scenario(
    'rule 487.7: the player going second channels an extra rune during their first Channel Phase',
    {
      rules: ['487.7', '485.7', '115.2'],
      setup: board().firstPlayer('A').afterMulligans(),
      act: (t) => t.act({ type: 'EndTurn', player: A }),
      check: (t) => {
        const channeled = ofType(t.events, 'RuneChanneled');
        t.expect(channeled.map((e) => [e.player, e.rule])).toEqual([
          [B, '315.3.b'],
          [B, '315.3.b'],
          [B, '487.7'],
        ]);
        t.expect(t.player('B').zones.base).toHaveLength(3);
        t.expect(t.player('A').zones.base).toHaveLength(2);
        // On B's second turn, back to 2 runes.
        t.act({ type: 'EndTurn', player: B }, { type: 'EndTurn', player: A });
        t.expect(ofType(t.events, 'RuneChanneled').filter((e) => e.player === B)).toHaveLength(2);
      },
    },
  );

  scenario(
    'rule 315.3.b.1: with fewer than 2 runes left, the Turn Player channels as many as possible',
    {
      rules: ['315.3.b.1', '431.3'],
      setup: board().firstPlayer('A').afterMulligans(),
      check: (t) => {
        // B channels 3 + 2 + 2 + 2 + 2 = 11 runes on turns 2, 4, 6, 8 and 10; 1 is left for turn 12.
        const { state, events } = playUntil(t.state, 12);
        const b = state.players.find((p) => p.id === B);
        t.expect(ofType(events, 'RuneChanneled').map((e) => e.player)).toEqual([B]);
        t.expect(b?.zones.runeDeck).toHaveLength(0);
        t.expect(b?.zones.base).toHaveLength(12);
        // Turn 14: nothing left to channel.
        t.expect(ofType(playUntil(state, 14).events, 'RuneChanneled')).toEqual([]);
      },
    },
  );

  scenario('rule 315.4.b: the Turn Player draws 1 in their Draw Phase, the First Player included', {
    rules: ['315.4.b', '414.1.a'],
    setup: board()
      .firstPlayer('A')
      .player('A', { mainDeckTop: [v(30)] }),
    act: mulligansDone as never,
    check: (t) => {
      const draws = ofType(t.events, 'CardDrawn').filter((e) => e.rule === '315.4.b');
      t.expect(draws.map((e) => [e.player, e.card])).toEqual([[A, 'test:vanilla-30']]);
      t.expect(t.hand('A')).toHaveLength(5);
    },
  });
});

describe('316 Main Phase, 317 Ending Phase', () => {
  scenario('rule 312.2.a: the Turn Player has Priority in their Main Phase', {
    rules: ['312.2.a', '312.1'],
    setup: board().firstPlayer('A').afterMulligans(),
    check: (t) => {
      t.expectDecision({ kind: 'Priority', player: A, rule: '312.2.a' });
      t.expectIllegal({ type: 'EndTurn', player: B }, 'not-your-decision');
      const actions = legalActions(t.state, A);
      t.expect(actions.at(-1)).toEqual({ type: 'Concede', player: A });
      t.expect(actions.at(-2)).toEqual({ type: 'EndTurn', player: A });
      t.expect(actions.slice(0, -2).every((action) => action.type === 'PlayCard')).toBe(true);
      t.expect(legalActions(t.state, B)).toEqual([{ type: 'Concede', player: B }]);
    },
  });

  scenario(
    "rule 316.9: the Turn Player ends their turn, the Ending Phase runs, then the next player's turn starts",
    {
      rules: ['316.9', '317', '306', '317.3'],
      setup: board().firstPlayer('A').afterMulligans(),
      act: (t) => t.act({ type: 'EndTurn', player: A }),
      check: (t) => {
        const kinds = t.events
          .slice(0, 3)
          .map((e) => (e.type === 'PhaseStarted' ? e.phase : e.type));
        t.expect(kinds).toEqual(['ending', 'TurnEnded', 'TurnStarted']);
        t.expect(ofType(t.events, 'TurnStarted')).toMatchObject([{ player: B, turnNumber: 2 }]);
        t.expectDecision({ kind: 'Priority', player: B });
      },
    },
  );

  scenario('rule 115.1.c: turns loop in turn order', {
    rules: ['115.1.c'],
    setup: board().firstPlayer('B').afterMulligans(),
    check: (t) => {
      const players: PlayerId[] = [];
      let state = t.state;
      for (let i = 0; i < 4; i++) {
        if (state.stage.kind !== 'turn') break;
        players.push(state.stage.turnPlayer);
        state = apply(state, { type: 'EndTurn', player: state.stage.turnPlayer }).state;
      }
      t.expect(players).toEqual([B, A, B, A]);
    },
  });
});

describe('316 Main Phase and 317 Ending Phase', () => {
  scenario(
    'rule 316.5: the Main Phase has no set structure: the Turn Player acts as many times as they wish',
    {
      rules: ['316.5', '316.5.a'],
      setup: board()
        .firstPlayer('A')
        .player('A', { hand: [v(1), v(2), v(3), v(4)], mainDeckTop: [v(5), v(6), v(7)] })
        .afterMulligans(),
      check: (t) => {
        // Turn 3 of A, with 4 runes: two cheap units, then the turn ends when A says so.
        t.act({ type: 'EndTurn', player: A }, { type: 'EndTurn', player: B });
        const plays = () => legalActions(t.state, A).filter((a) => a.type === 'PlayCard');
        const first = plays().find(
          (a) => a.type === 'PlayCard' && t.state.objects[a.card]?.card === 'test:vanilla-1',
        );
        if (first === undefined) throw new Error('A cannot play Vanilla 1');
        t.act(first);
        const second = plays().find(
          (a) => a.type === 'PlayCard' && t.state.objects[a.card]?.card === 'test:vanilla-2',
        );
        if (second === undefined) throw new Error('A cannot play Vanilla 2');
        t.act(second);
        t.expect(t.state.stage).toMatchObject({ turnPlayer: A, phase: 'main' });
        t.expectDecision({ kind: 'Priority', player: A });
      },
    },
  );

  scenario(
    'rule 316.5.b: in the Neutral Open State of the Main Phase, only the Turn Player can act',
    {
      rules: ['316.5.b'],
      setup: board()
        .firstPlayer('A')
        .player('B', { hand: [v(1), v(2), v(3), v(4)] })
        .afterMulligans(),
      check: (t) => {
        t.expect(legalActions(t.state, B)).toEqual([{ type: 'Concede', player: B }]);
        const card = t.player('B').zones.hand[0] as ObjectId;
        t.actIllegal(
          { type: 'PlayCard', player: B, card, location: { kind: 'base' }, payment: [] },
          'not-your-decision',
        );
      },
    },
  );

  scenario(
    'rule 316.9.a: ending the turn ends the Main Phase, and play proceeds to the Ending Phase',
    {
      rules: ['316.9.a', '316.9.b'],
      setup: board().firstPlayer('A').afterMulligans(),
      act: (t) => t.act({ type: 'EndTurn', player: A }),
      check: (t) => {
        t.expect(ofType(t.events, 'PhaseStarted')[0]).toMatchObject({ phase: 'ending', player: A });
      },
    },
  );

  scenario(
    'rule 317.2: the Expiration Step invokes the Ending Special Cleanup, which empties the Rune Pools',
    {
      rules: ['317.2', '317.2.a', '324', '324.1'],
      setup: board()
        .firstPlayer('A')
        .player('A', { hand: [v(1), v(2), v(3), v(4)] })
        .afterMulligans(),
      check: (t) => {
        // A pays Vanilla 1 (1 Energy) with two runes and keeps 1 Energy in their Rune Pool.
        const [r1, r2] = t.player('A').zones.base as [ObjectId, ObjectId];
        const card = t
          .player('A')
          .zones.hand.find((id) => t.state.objects[id]?.card === 'test:vanilla-1') as ObjectId;
        t.act({
          type: 'PlayCard',
          player: A,
          card,
          location: { kind: 'base' },
          payment: [
            { rune: r1, use: 'exhaust' },
            { rune: r2, use: 'exhaust' },
          ],
        });
        t.expect(t.player('A').runePool.energy).toBe(1);
        t.act({ type: 'EndTurn', player: A });
        // 324.1: the Ending Phase defines the steps it adds to that Cleanup, among them 3e.
        const types = t.events.map((e) => (e.type === 'PhaseStarted' ? e.phase : e.type));
        const emptied = types.indexOf('RunePoolEmptied');
        t.expect(types.indexOf('ending')).toBeLessThan(emptied);
        t.expect(emptied).toBeLessThan(types.indexOf('TurnEnded'));
      },
    },
  );
});
