import {
  apply,
  IllegalActionError,
  isLegal,
  legalActions,
  pendingDecision,
} from '@foilengine/rules';
import type { GameState, PlayerId } from '@foilengine/types';
import { describe, expect, it } from 'vitest';
import { cardsOf, eventsOfType, player, start, take } from '../../support.ts';

const first = (state: GameState) => state.turnOrder[0] as PlayerId;
const second = (state: GameState) => state.turnOrder[1] as PlayerId;
const hand = (state: GameState, id: PlayerId) => player(state, id).zones.hand;

describe('117 Mulligan', () => {
  it('rule 117: players perform their Mulligan in turn order', () => {
    const { state } = start();
    const refused = isLegal(state, { type: 'Mulligan', player: second(state), setAside: [] });
    expect(refused).toMatchObject({
      ok: false,
      reason: { code: 'not-your-decision', rule: '117' },
    });

    const after = apply(state, { type: 'Mulligan', player: first(state), setAside: [] }).state;
    expect(pendingDecision(after)).toMatchObject({ kind: 'Mulligan', player: second(state) });
  });

  it('rule 117.1: a player may set aside up to two cards', () => {
    const { state } = start();
    const [a, b, c] = take(hand(state, first(state)), 3);
    expect(isLegal(state, { type: 'Mulligan', player: first(state), setAside: [a, b] })).toEqual({
      ok: true,
    });
    expect(
      isLegal(state, { type: 'Mulligan', player: first(state), setAside: [a, b, c] }),
    ).toMatchObject({
      ok: false,
      reason: { code: 'too-many-cards', rule: '117.1' },
    });
  });

  it('rule 117.1: the cards set aside must come from the hand, each once', () => {
    const { state } = start();
    const [a] = take(hand(state, first(state)), 1);
    const [notInHand] = take(player(state, first(state)).zones.mainDeck, 1);
    expect(
      isLegal(state, { type: 'Mulligan', player: first(state), setAside: [notInHand] }),
    ).toMatchObject({
      ok: false,
      reason: { code: 'card-not-in-hand' },
    });
    expect(
      isLegal(state, { type: 'Mulligan', player: first(state), setAside: [a, a] }),
    ).toMatchObject({
      ok: false,
      reason: { code: 'duplicate-card' },
    });
  });

  it('rule 117.1: keeping the hand is setting aside no card', () => {
    const { state } = start();
    const before = hand(state, first(state));
    const { state: after, events } = apply(state, {
      type: 'Mulligan',
      player: first(state),
      setAside: [],
    });
    expect(hand(after, first(state))).toEqual(before);
    expect(events.map((e) => e.type)).toEqual(['MulliganTaken']);
    expect(events[0]).toMatchObject({ rule: '117', count: 0 });
  });

  it('rule 117.2: the player draws as many cards as they set aside', () => {
    const { state } = start();
    const [a, b] = take(hand(state, first(state)), 2);
    const { state: after, events } = apply(state, {
      type: 'Mulligan',
      player: first(state),
      setAside: [a, b],
    });
    expect(hand(after, first(state))).toHaveLength(4);
    expect(hand(after, first(state))).not.toContain(a);
    const draws = eventsOfType(events, 'CardDrawn');
    expect(draws).toHaveLength(2);
    expect(draws.every((e) => e.rule === '117.2')).toBe(true);
    // The new cards are the two top cards of the deck before the mulligan.
    expect(cardsOf(after, hand(after, first(state)).slice(2))).toEqual(
      cardsOf(state, player(state, first(state)).zones.mainDeck.slice(0, 2)),
    );
  });

  it('rule 117.3: the cards set aside are recycled to the bottom of the Main Deck', () => {
    const { state } = start();
    const [a, b] = take(hand(state, first(state)), 2);
    const { state: after, events } = apply(state, {
      type: 'Mulligan',
      player: first(state),
      setAside: [a, b],
    });
    const deck = player(after, first(state)).zones.mainDeck;
    expect(deck).toHaveLength(35);
    expect(cardsOf(after, deck.slice(-2)).sort()).toEqual(cardsOf(state, [a, b]).sort());
    const recycled = eventsOfType(events, 'CardRecycled');
    expect(recycled.map((e) => e.rule)).toEqual(['117.3', '117.3']);
    expect(recycled.every((e) => e.from === 'hand' && e.to === 'mainDeck')).toBe(true);
  });

  it('rule 417.5: two cards recycled together go to the bottom in a random order', () => {
    const orders = new Set<string>();
    for (let i = 0; i < 30; i++) {
      const { state } = start(undefined, `recycle-${i}`);
      const [a, b] = take(hand(state, first(state)), 2);
      const { state: after } = apply(state, {
        type: 'Mulligan',
        player: first(state),
        setAside: [a, b],
      });
      const bottom = player(after, first(state)).zones.mainDeck.slice(-2);
      const previous = bottom.map((id) => after.objects[id]?.previousObjectId);
      orders.add(previous[0] === a ? 'kept' : 'swapped');
    }
    expect(orders).toEqual(new Set(['kept', 'swapped']));
  });

  it('rule 124: a recycled card becomes a new object; its identity stays private (128.4)', () => {
    const { state } = start();
    const [a] = take(hand(state, first(state)), 1);
    const { state: after, events } = apply(state, {
      type: 'Mulligan',
      player: first(state),
      setAside: [a],
    });
    const [recycled] = eventsOfType(events, 'CardRecycled');
    expect(recycled?.previousObject).toBe(a);
    expect(recycled?.object).not.toBe(a);
    expect(after.objects[a]).toBeUndefined();
    expect(recycled?.visibility).toEqual({ kind: 'private', to: [first(state)] });
  });

  it('rule 117.1: the legal mulligans are every choice of up to two cards of the hand', () => {
    const { state } = start();
    const actions = legalActions(state, first(state));
    // 1 (keep) + 4 (one card) + 6 (two cards) for a hand of 4.
    expect(actions).toHaveLength(11);
    expect(actions.every((action) => isLegal(state, action).ok)).toBe(true);
    expect(legalActions(state, second(state))).toEqual([]);
  });

  it('refuses an illegal mulligan without changing anything', () => {
    const { state } = start();
    const copy = JSON.parse(JSON.stringify(state));
    expect(() => apply(state, { type: 'Mulligan', player: second(state), setAside: [] })).toThrow(
      IllegalActionError,
    );
    expect(state).toEqual(copy);
  });

  it('refuses any action once setup is complete', () => {
    let { state } = start();
    for (const id of [first(state), second(state)]) {
      state = apply(state, { type: 'Mulligan', player: id, setAside: [] }).state;
    }
    expect(isLegal(state, { type: 'Mulligan', player: first(state), setAside: [] })).toMatchObject({
      ok: false,
      reason: { code: 'no-pending-decision' },
    });
  });
});
