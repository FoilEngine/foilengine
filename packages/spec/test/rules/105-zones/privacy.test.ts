import { apply, viewFor } from '@foilengine/rules';
import { TEST_CARDS, testSetup } from '@foilengine/testkit';
import type { PlayerId } from '@foilengine/types';
import { describe, expect, it } from 'vitest';
import { A, B, player, start } from '../../support.ts';

describe('105–108 zones and 128 privacy, as seen by a player', () => {
  const { state } = start(testSetup({ distinctDecks: true }));
  const view = viewFor(state, A);
  const [opponent] = view.opponents;

  it('rule 108.7.c: a player sees the cards of their own hand', () => {
    expect(view.self.zones.hand.map((o) => o.id)).toEqual(player(state, A).zones.hand);
    expect(view.self.zones.hand.every((o) => o.card === state.objects[o.id]?.card)).toBe(true);
  });

  it("rule 108.7.c: the cards of an opponent's hand are private to them", () => {
    expect(opponent?.zones.hand).toEqual({ size: 4 });
  });

  it("rule 108.7.e: the number of cards in an opponent's hand is public", () => {
    expect(opponent?.zones.hand.size).toBe(player(state, B).zones.hand.length);
  });

  it('rule 108.4.d: the number of cards in each Main Deck is public', () => {
    expect(view.self.zones.mainDeck).toEqual({ size: 35 });
    expect(opponent?.zones.mainDeck).toEqual({ size: 35 });
  });

  it('rule 108.4.e: the order of the Main Deck is secret, to its owner too', () => {
    expect(view.self.zones.mainDeck).toEqual({ size: player(state, A).zones.mainDeck.length });
    expect(JSON.stringify(view)).not.toContain(`"${player(state, A).zones.mainDeck[0]}"`);
  });

  it('rule 108.5.d: the order of the Rune Deck is secret', () => {
    expect(view.self.zones.runeDeck).toEqual({ size: 12 });
    expect(opponent?.zones.runeDeck).toEqual({ size: 12 });
  });

  it('rule 107.4: the Champion Legends are public', () => {
    expect(opponent?.zones.legendZone.map((o) => o.card)).toEqual(['test:b:legend']);
    expect(view.self.zones.legendZone.map((o) => o.card)).toEqual([TEST_CARDS.legend.id]);
  });

  it('rule 108.3.e: the Champion Zones are public', () => {
    expect(opponent?.zones.championZone.map((o) => o.card)).toEqual(['test:b:champion']);
  });

  it('rule 107.2.c: the battlefields are public', () => {
    expect(view.battlefields.map((b) => b.owner)).toEqual([A, B]);
    expect(viewFor(state, B).battlefields).toEqual(view.battlefields);
  });

  it('a pending decision is only shown to the player who must make it', () => {
    const turnPlayer = state.turnOrder[0] as PlayerId;
    const other = state.turnOrder[1] as PlayerId;
    expect(viewFor(state, turnPlayer).decision).toMatchObject({
      kind: 'Mulligan',
      player: turnPlayer,
    });
    expect(viewFor(state, other).decision).toBeNull();
    const after = apply(state, { type: 'Mulligan', player: turnPlayer, setAside: [] }).state;
    expect(viewFor(after, other).decision).toMatchObject({ kind: 'Mulligan', player: other });
  });
});
