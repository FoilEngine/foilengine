// Burn Out needs an empty Main Deck. The trash cannot fill up by play yet (no unit dies before
// combat, later in M2), so these scenarios move cards between zones by hand: legal states the
// engine cannot reach yet (see moveZone in support.ts).

import { apply, outcome } from '@foilengine/rules';
import { board, scenario } from '@foilengine/testkit';
import type { GameEvent, PlayerId } from '@foilengine/types';
import { describe } from 'vitest';
import { moveZone, withPoints } from '../../support.ts';

const A = 'A' as PlayerId;
const B = 'B' as PlayerId;
const ofType = <T extends GameEvent['type']>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);

/** A has just finished their first Main Phase; B's deck is moved to `zone`. */
const bDeckIn = (zone: 'trash' | 'banishment') => () =>
  moveZone(board().firstPlayer('A').afterMulligans().build(), B, 'mainDeck', zone);

describe('432 Burn Out', () => {
  scenario(
    'rule 432.2: drawing from an empty Main Deck, the player recycles their trash, an opponent gains 1 point, then they draw',
    {
      rules: ['432.2', '432.2.b', '432.2.c', '432.2.d', '315.4.b.1', '315.4.b.2', '194.1.d'],
      setup: bDeckIn('trash'),
      act: (t) => t.act({ type: 'EndTurn', player: A }),
      check: (t) => {
        const sequence = t.events
          .filter((e) =>
            ['CardRecycled', 'BurnedOut', 'PointsGained', 'CardDrawn'].includes(e.type),
          )
          .map((e) => e.type);
        t.expect(sequence).toEqual([
          ...Array(35).fill('CardRecycled'),
          'BurnedOut',
          'PointsGained',
          'CardDrawn',
        ]);
        t.expect(ofType(t.events, 'BurnedOut')).toMatchObject([
          { player: B, opponent: A, rule: '432.2' },
        ]);
        t.expect(ofType(t.events, 'PointsGained')).toMatchObject([
          { player: A, amount: 1, total: 1, rule: '432.2.c' },
        ]);
        t.expect(
          ofType(t.events, 'CardRecycled').every((e) => e.rule === '432.2.b' && e.from === 'trash'),
        ).toBe(true);
        t.expect(t.player('B').zones.trash).toEqual([]);
        t.expect(t.player('B').zones.mainDeck).toHaveLength(34);
        t.expect(t.hand('B')).toHaveLength(5);
        t.expectDecision({ kind: 'Priority', player: B });
      },
    },
  );

  scenario('rule 417.5: the trash is recycled into the Main Deck in a random order', {
    rules: ['417.5', '432.2.b'],
    setup: bDeckIn('trash'),
    check: (t) => {
      const before = t.player('B').zones.trash.map((id) => t.state.objects[id]?.card);
      t.act({ type: 'EndTurn', player: A });
      const recycled = ofType(t.events, 'CardRecycled').map((e) => e.card);
      t.expect([...recycled].sort()).toEqual([...before].sort());
      t.expect(recycled).not.toEqual(before);
    },
  });

  scenario(
    'rule 432.3: with an empty Main Deck and an empty trash, the player Burns Out again and again',
    {
      rules: ['432.3', '432.3.a', '432.3.c', '432.3.c.1'],
      setup: bDeckIn('banishment'),
      act: (t) => t.act({ type: 'EndTurn', player: A }),
      check: (t) => {
        t.expect(ofType(t.events, 'BurnedOut')).toHaveLength(8);
        t.expect(ofType(t.events, 'PointsGained').map((e) => e.total)).toEqual([
          1, 2, 3, 4, 5, 6, 7, 8,
        ]);
        // The 8th point wins at once, without waiting for a cleanup.
        t.expect(ofType(t.events, 'GameWon')).toMatchObject([{ player: A, rule: '432.3.c.1' }]);
        t.expect(t.events.at(-1)?.type).toBe('GameWon');
        t.expect(ofType(t.events, 'CardDrawn').filter((e) => e.player === B)).toEqual([]);
      },
    },
  );

  scenario(
    'rule 194.2: a player with the Victory Score and more points than any other player wins in a cleanup',
    {
      rules: ['194.2', '323.1', '487.3', '194.3'],
      setup: () => withPoints(bDeckIn('trash')(), A, 7),
      act: (t) => t.act({ type: 'EndTurn', player: A }),
      check: (t) => {
        // The first Burn Out does not win at once (432.3.c is about the following ones): the next cleanup does.
        const types = t.events.map((e) => e.type);
        t.expect(types.indexOf('GameWon')).toBeGreaterThan(types.indexOf('CardDrawn'));
        t.expect(ofType(t.events, 'GameWon')).toMatchObject([{ player: A, rule: '323.1' }]);
        t.expect(outcome(t.state)).toEqual({ kind: 'won', winner: A });
      },
    },
  );

  scenario('rule 196: when a player wins the game, the game ends', {
    rules: ['196'],
    setup: bDeckIn('banishment'),
    act: (t) => t.act({ type: 'EndTurn', player: A }),
    check: (t) => {
      t.expect(t.state.stage).toEqual({ kind: 'ended' });
      t.expect(t.state.winner).toBe(A);
      t.expectDecision(null);
      t.expectIllegal({ type: 'EndTurn', player: B }, 'no-pending-decision');
      t.expect(() => apply(t.state, { type: 'EndTurn', player: A })).toThrow();
    },
  });
});
