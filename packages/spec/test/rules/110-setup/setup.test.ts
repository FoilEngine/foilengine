import { createGame, pendingDecision } from '@foilengine/rules';
import { TEST_CARDS, testDeck, testSetup } from '@foilengine/testkit';
import type { CardId, PlayerId, Seed } from '@foilengine/types';
import { describe, expect, it } from 'vitest';
import { A, B, cardsOf, eventsOfType, keepAll, player, start } from '../../support.ts';

describe('110 Setup Process', () => {
  it('rule 110: creating a game starts with GameCreated and the rules version', () => {
    const { events } = start();
    expect(events[0]).toMatchObject({
      type: 'GameCreated',
      rule: '110',
      seq: 1,
      mode: '1v1-duel',
      rulesVersion: 'CR-2026-10-09',
      players: [A, B],
    });
  });

  it('rule 111: each player places their Champion Legend in the Legend Zone', () => {
    const { state, events } = start();
    for (const id of [A, B]) {
      expect(cardsOf(state, player(state, id).zones.legendZone)).toEqual([TEST_CARDS.legend.id]);
    }
    expect(eventsOfType(events, 'CardPlaced').filter((e) => e.rule === '111')).toHaveLength(2);
  });

  it('rule 112: each player places their Chosen Champion in the Champion Zone', () => {
    const { state, events } = start();
    for (const id of [A, B]) {
      expect(cardsOf(state, player(state, id).zones.championZone)).toEqual([
        TEST_CARDS.champion.id,
      ]);
    }
    expect(eventsOfType(events, 'CardPlaced').filter((e) => e.rule === '112')).toHaveLength(2);
  });

  it('rule 103.3: the Chosen Champion is one of the Main Deck cards and leaves it for the Champion Zone', () => {
    const { state } = start();
    const a = player(state, A);
    // 40 cards: champion + 39; the champion is set apart, 4 are drawn.
    expect(a.zones.mainDeck.length + a.zones.hand.length).toBe(39);
    expect(cardsOf(state, [...a.zones.mainDeck, ...a.zones.hand])).not.toContain(
      TEST_CARDS.champion.id,
    );
  });

  it('rule 114: each player shuffles their Main and Rune Decks separately', () => {
    const { state, events } = start();
    const shuffles = eventsOfType(events, 'DeckShuffled');
    expect(shuffles.map((e) => [e.player, e.zone, e.size])).toEqual([
      [A, 'mainDeck', 39],
      [A, 'runeDeck', 12],
      [B, 'mainDeck', 39],
      [B, 'runeDeck', 12],
    ]);
    expect(shuffles.every((e) => e.rule === '114')).toBe(true);
    expect(player(state, A).zones.runeDeck).toHaveLength(12);
  });

  it('rule 114: the Main Deck order depends on the seed', () => {
    const order = (seed: string) => {
      const { state } = start(testSetup(), seed);
      const a = player(state, A);
      return cardsOf(state, [...a.zones.hand, ...a.zones.mainDeck]);
    };
    const listOrder = TEST_CARDS.vanillas.map((card) => card.id);
    expect(order('seed-1')).toEqual(order('seed-1'));
    expect(order('seed-1')).not.toEqual(order('seed-2'));
    expect(order('seed-1')).not.toEqual(listOrder);
    expect([...order('seed-1')].sort()).toEqual([...listOrder].sort());
  });

  it('rule 115: turn order is random, and the other player follows the First Player (115.1.b)', () => {
    const orders = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const { state, events } = start(testSetup(), `order-${i}`);
      const [determined] = eventsOfType(events, 'TurnOrderDetermined');
      expect(determined?.rule).toBe('115');
      expect(determined?.order).toEqual(state.turnOrder);
      expect([...state.turnOrder].sort()).toEqual([A, B]);
      orders.add(state.turnOrder.join(','));
    }
    expect(orders).toEqual(new Set(['A,B', 'B,A']));
  });

  it('rule 116: players each draw 4, in turn order', () => {
    const { state, events } = start();
    for (const id of [A, B]) {
      expect(player(state, id).zones.hand).toHaveLength(4);
      expect(player(state, id).zones.mainDeck).toHaveLength(35);
    }
    const draws = eventsOfType(events, 'CardDrawn');
    expect(draws).toHaveLength(8);
    expect(draws.every((e) => e.rule === '116')).toBe(true);
    expect(draws.map((e) => e.player)).toEqual([
      ...Array(4).fill(state.turnOrder[0]),
      ...Array(4).fill(state.turnOrder[1]),
    ]);
  });

  it('rule 116: a drawn card is private to the player who drew it (108.7.c)', () => {
    const { events } = start();
    for (const draw of eventsOfType(events, 'CardDrawn')) {
      expect(draw.visibility).toEqual({ kind: 'private', to: [draw.player] });
    }
  });

  it('rule 124: a drawn card becomes a new object, which remembers the previous one', () => {
    const { state } = start();
    for (const id of player(state, A).zones.hand) {
      const object = state.objects[id];
      expect(object?.previousObjectId).not.toBeNull();
      expect(state.objects[object?.previousObjectId as never]).toBeUndefined();
    }
  });

  it("rule 117: after the draws, the first decision is the First Player's mulligan", () => {
    const { state } = start();
    expect(state.stage).toEqual({ kind: 'mulligan', pending: state.turnOrder });
    expect(pendingDecision(state)).toEqual({
      kind: 'Mulligan',
      player: state.turnOrder[0],
      max: 2,
      rule: '117.1',
    });
  });

  it('rule 118: once both players have taken their mulligan, the First Player takes their turn', () => {
    const { state } = start();
    const after = keepAll(state);
    expect(after.state.stage).toMatchObject({
      kind: 'turn',
      turnPlayer: state.turnOrder[0],
      turnNumber: 1,
    });
    expect(eventsOfType(after.events, 'SetupCompleted')[0]).toMatchObject({
      rule: '118',
      firstPlayer: state.turnOrder[0],
    });
  });
});

describe('103 deck structure checked before setup', () => {
  const refuse = (deck: Parameters<typeof testDeck>[0]) => {
    const setup = testSetup({
      players: [
        { id: A, deck: testDeck(deck) },
        { id: B, deck: testDeck() },
      ],
    });
    const result = createGame(setup, 'seed' as Seed);
    if (result.ok) throw new Error('expected the setup to be refused');
    return result.problems;
  };

  it('rule 103.2: the Champion Legend must be a legend', () => {
    expect(refuse({ legend: TEST_CARDS.champion.id })).toMatchObject([
      { code: 'wrong-category', player: A, rule: '103.2' },
    ]);
  });

  it('rule 103.3.a.2: the Chosen Champion must be a champion unit', () => {
    const vanilla = TEST_CARDS.vanillas[0]?.id as CardId;
    expect(refuse({ champion: vanilla })).toMatchObject([
      { code: 'not-a-champion', rule: '103.3.a.2' },
    ]);
  });

  it('rule 103.3: the Chosen Champion must be in the Main Deck', () => {
    const mainDeck = [...TEST_CARDS.vanillas.map((c) => c.id), TEST_CARDS.gear.id];
    expect(refuse({ mainDeck })).toMatchObject([
      { code: 'champion-not-in-main-deck', rule: '103.3' },
    ]);
  });

  it('rule 103.3: the Main Deck has at least 40 cards', () => {
    const mainDeck = testDeck().mainDeck.slice(0, 39);
    expect(refuse({ mainDeck })).toMatchObject([{ code: 'main-deck-too-small', rule: '103.3' }]);
  });

  it('rule 103.4.a: the Rune Deck has exactly 12 runes', () => {
    expect(refuse({ runeDeck: testDeck().runeDeck.slice(0, 11) })).toMatchObject([
      { code: 'wrong-rune-count', rule: '103.4.a' },
    ]);
  });

  it('rule 133.5: the Rune Deck only holds runes', () => {
    const runeDeck = [...testDeck().runeDeck.slice(0, 11), TEST_CARDS.spell.id];
    expect(refuse({ runeDeck })).toMatchObject([{ code: 'wrong-category', rule: '133.5' }]);
  });

  it('rule 133.4: the Main Deck only holds units, gear and spells', () => {
    const mainDeck = [...testDeck().mainDeck, TEST_CARDS.rune.id];
    expect(refuse({ mainDeck })).toMatchObject([{ code: 'wrong-category', rule: '133.4' }]);
  });

  it('refuses unknown cards', () => {
    expect(refuse({ legend: 'nope' as CardId })).toMatchObject([{ code: 'unknown-card' }]);
  });

  it('refuses a setup for another version of the Core Rules', () => {
    const result = createGame(testSetup({ rulesVersion: 'CR-1999-01-01' }), 'seed' as Seed);
    expect(result.ok ? [] : result.problems).toMatchObject([{ code: 'rules-version-mismatch' }]);
  });

  it('refuses two players with the same id', () => {
    const setup = testSetup({
      players: [
        { id: A, deck: testDeck() },
        { id: A as PlayerId, deck: testDeck() },
      ],
    });
    const result = createGame(setup, 'seed' as Seed);
    expect(result.ok ? [] : result.problems).toMatchObject([{ code: 'duplicate-player' }]);
  });
});
