import { createGame, SUPPORTED_MODES } from '@foilengine/rules';
import { TEST_CARDS, testDeck, testSetup } from '@foilengine/testkit';
import type { PlayerId, Seed } from '@foilengine/types';
import { describe, expect, it } from 'vitest';
import { A, B, eventsOfType, start } from '../../support.ts';

describe('487 1v1 (Duel)', () => {
  it('rule 487.1: a Duel has 2 players', () => {
    const three = testSetup({
      players: [
        { id: A, deck: testDeck() },
        { id: B, deck: testDeck() },
        { id: 'C' as PlayerId, deck: testDeck() },
      ],
    });
    const result = createGame(three, 'seed' as Seed);
    expect(result.ok ? [] : result.problems).toMatchObject([
      { code: 'wrong-player-count', rule: '487.1' },
    ]);
  });

  it('rule 487.4.a: each player provides three battlefields', () => {
    const setup = testSetup({
      players: [
        { id: A, deck: testDeck({ battlefields: testDeck().battlefields.slice(0, 2) }) },
        { id: B, deck: testDeck() },
      ],
    });
    const result = createGame(setup, 'seed' as Seed);
    expect(result.ok ? [] : result.problems).toMatchObject([
      { code: 'wrong-battlefield-count', player: A, rule: '487.4.a' },
    ]);
  });

  it('rule 487.4: two battlefields are in play, one per player', () => {
    const { state, events } = start();
    expect(state.battlefields).toHaveLength(2);
    const selected = eventsOfType(events, 'BattlefieldSelected');
    expect(selected.map((e) => [e.player, e.rule])).toEqual([
      [A, '487.5'],
      [B, '487.5'],
    ]);
    expect(state.battlefields.map((b) => state.objects[b.object]?.owner)).toEqual([A, B]);
  });

  it('rule 487.5: each player randomly selects one of their three battlefields', () => {
    const picked = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const { events } = start(testSetup(), `battlefield-${i}`);
      const [first] = eventsOfType(events, 'BattlefieldSelected');
      picked.add(first?.card ?? '');
    }
    expect(picked).toEqual(new Set(TEST_CARDS.battlefields.map((b) => b.id)));
  });

  it('rule 483: other modes of play are refused until they are implemented', () => {
    expect(SUPPORTED_MODES).toEqual(['1v1-duel']);
    const result = createGame(testSetup({ mode: 'ffa3' }), 'seed' as Seed);
    expect(result.ok ? [] : result.problems).toMatchObject([{ code: 'unsupported-mode' }]);
  });
});
