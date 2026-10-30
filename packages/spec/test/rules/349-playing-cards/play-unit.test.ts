import { apply } from '@foilengine/rules';
import { board, scenario } from '@foilengine/testkit';
import type { GameEvent, GameState, ObjectId, PlayerId } from '@foilengine/types';
import { describe } from 'vitest';

const A = 'A' as PlayerId;
const B = 'B' as PlayerId;
const v = (n: number) => `Vanilla ${n}`;
const ofType = <T extends GameEvent['type']>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);

const firstMainPhase = () =>
  board()
    .firstPlayer('A')
    .player('A', { hand: [v(1), v(2), v(3), v(4)], mainDeckTop: [v(5)] })
    .afterMulligans();

const inHand = (state: GameState, card: string) =>
  state.players
    .find((p) => p.id === A)
    ?.zones.hand.find((id) => state.objects[id]?.card === card) as ObjectId;
const baseRunes = (state: GameState) =>
  (state.players.find((p) => p.id === A)?.zones.base ?? []).filter(
    (id) => state.cards[state.objects[id]?.card as never]?.category === 'rune',
  );

describe('349–359 Playing a unit', () => {
  scenario('rule 359.2.c: a unit enters the board exhausted, at the chosen location', {
    rules: ['359.2.c', '351.1', '355.2.a'],
    setup: firstMainPhase(),
    check: (t) => {
      const card = inHand(t.state, 'test:vanilla-1');
      const [rune] = baseRunes(t.state);
      t.act({
        type: 'PlayCard',
        player: A,
        card,
        location: { kind: 'base' },
        payment: [{ rune: rune as ObjectId, use: 'exhaust' }],
      });
      const [played] = ofType(t.events, 'CardPlayed');
      t.expect(played).toMatchObject({
        rule: '359.2.c',
        previousObject: card,
        card: 'test:vanilla-1',
        from: 'hand',
        to: 'base',
      });
      const unit = played?.object as ObjectId;
      t.expect(t.player('A').zones.base).toContain(unit);
      t.expect(t.state.objects[unit]?.exhausted).toBe(true);
      t.expect(t.player('A').zones.hand).not.toContain(card);
    },
  });

  scenario('rule 124: a played unit leaves the hand, a Non-Board Zone, and becomes a new object', {
    rules: ['124'],
    setup: firstMainPhase(),
    check: (t) => {
      const card = inHand(t.state, 'test:vanilla-1');
      const [rune] = baseRunes(t.state);
      t.act({
        type: 'PlayCard',
        player: A,
        card,
        location: { kind: 'base' },
        payment: [{ rune: rune as ObjectId, use: 'exhaust' }],
      });
      const [played] = ofType(t.events, 'CardPlayed');
      t.expect(played?.object).not.toBe(card);
      t.expect(t.state.objects[card]).toBeUndefined();
      t.expect(t.state.objects[played?.object as ObjectId]?.previousObjectId).toBe(card);
    },
  });

  scenario(
    'rule 355.2.a: a unit cannot be played to a battlefield its controller does not control',
    {
      rules: ['355.2.a'],
      setup: firstMainPhase(),
      check: (t) => {
        const [rune] = baseRunes(t.state);
        t.actIllegal(
          {
            type: 'PlayCard',
            player: A,
            card: inHand(t.state, 'test:vanilla-1'),
            location: {
              kind: 'battlefield',
              battlefield: t.state.battlefields[0]?.object as ObjectId,
            },
            payment: [{ rune: rune as ObjectId, use: 'exhaust' }],
          },
          'invalid-location',
        );
      },
    },
  );

  scenario('rule 108.3.d: the Chosen Champion can be played from the Champion Zone', {
    rules: ['108.3.d'],
    setup: () => {
      // Turn 3: A has channeled 4 runes; the champion costs 3 Energy and 1 Fury Power.
      let state = firstMainPhase().build();
      for (let i = 0; i < 2; i++) {
        if (state.stage.kind !== 'turn') break;
        state = apply(state, { type: 'EndTurn', player: state.stage.turnPlayer }).state;
      }
      return state;
    },
    check: (t) => {
      const [r1, r2, r3, r4] = baseRunes(t.state) as ObjectId[];
      const champion = t.player('A').zones.championZone[0] as ObjectId;
      t.act({
        type: 'PlayCard',
        player: A,
        card: champion,
        location: { kind: 'base' },
        payment: [
          { rune: r1 as ObjectId, use: 'exhaust' },
          { rune: r2 as ObjectId, use: 'exhaust' },
          { rune: r3 as ObjectId, use: 'exhaust' },
          { rune: r4 as ObjectId, use: 'recycle' },
        ],
      });
      t.expect(ofType(t.events, 'CardPlayed')).toMatchObject([
        { card: 'test:champion', from: 'championZone' },
      ]);
      t.expect(t.player('A').zones.championZone).toEqual([]);
    },
  });

  scenario('rule 411.1.a: only the player with Priority plays cards in their Main Phase', {
    rules: ['411.1.a', '312.1'],
    setup: firstMainPhase(),
    check: (t) => {
      const card = t.player('B').zones.hand[0] as ObjectId;
      t.actIllegal(
        { type: 'PlayCard', player: B, card, location: { kind: 'base' }, payment: [] },
        'not-your-decision',
      );
    },
  });

  scenario('rule 108.3.d: a card in the Main Deck cannot be played', {
    rules: ['108.3.d'],
    setup: firstMainPhase(),
    check: (t) => {
      const card = t.player('A').zones.mainDeck[0] as ObjectId;
      t.actIllegal(
        { type: 'PlayCard', player: A, card, location: { kind: 'base' }, payment: [] },
        'card-not-playable',
      );
    },
  });
});
