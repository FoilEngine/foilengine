// The zones of each player (106–108) and what every player may see of them (107.1.d, 108.2.d,
// 108.6.e, 109.2). Privacy of hands and decks is in privacy.test.ts.

import { viewFor } from '@foilengine/rules';
import { scenario, TEST_CARDS, testSetup } from '@foilengine/testkit';
import type { GameState, ObjectId, PlayerZoneId } from '@foilengine/types';
import { describe } from 'vitest';
import { A, B, battlefield, move, turnThree, zonesOf } from '../../battlefields.ts';
import { start } from '../../support.ts';

const PLAYER_ZONES: PlayerZoneId[] = [
  'base',
  'legendZone',
  'championZone',
  'mainDeck',
  'runeDeck',
  'hand',
  'trash',
  'banishment',
];

/**
 * A's turn 3 (turnThree), with one card of B's hand put in B's trash and one in B's banishment.
 * Nothing is banished in M2, so this state is built by hand; it stays legal (every card in one zone).
 */
function withTrashAndBanishment(): GameState {
  const state = turnThree();
  const [toTrash, toBanishment, ...hand] = zonesOf(state, B).hand as [ObjectId, ObjectId];
  return {
    ...state,
    players: state.players.map((p) =>
      p.id === B
        ? { ...p, zones: { ...p.zones, hand, trash: [toTrash], banishment: [toBanishment] } }
        : p,
    ),
  };
}

describe('106–108 Zones', () => {
  scenario(
    'rule 106: each player has their own Base, Trash, Champion Zone, decks, Banishment and Hand',
    {
      rules: [
        '106',
        '107.1.a',
        '108.2.a',
        '108.3.a',
        '108.4.a',
        '108.4.b',
        '108.5.a',
        '108.5.b',
        '108.6.a',
        '108.7.a',
      ],
      setup: () => start(testSetup({ distinctDecks: true })).state,
      check: (t) => {
        for (const id of [A, B]) {
          t.expect(Object.keys(t.player(id).zones).sort()).toEqual([...PLAYER_ZONES].sort());
          // A player's zones hold only the cards of that player's deck.
          for (const zone of PLAYER_ZONES) {
            for (const object of t.player(id).zones[zone]) {
              t.expect(t.state.objects[object]?.owner).toBe(id);
            }
          }
        }
        // The Main Deck and the Rune Deck are in their own zones: B's main deck cards are B's.
        t.expect(t.player(B).zones.mainDeck.map((o) => t.state.objects[o]?.card)).not.toContain(
          TEST_CARDS.vanillas[0]?.id,
        );
      },
    },
  );

  scenario('rule 107.2.a: the Battlefield Zone houses the battlefields of the game', {
    rules: ['107.2.a'],
    setup: () => start(testSetup({ distinctDecks: true })).state,
    check: (t) => {
      t.expect(t.state.battlefields).toHaveLength(2);
      t.expect(t.state.battlefields.map((b) => t.state.objects[b.object]?.owner)).toEqual([A, B]);
    },
  });

  scenario('rule 107.4.a: the Legend Zone holds the Champion Legend, which is a Game Object', {
    rules: ['107.4.a', '107.4.c'],
    setup: () => start().state,
    check: (t) => {
      for (const id of [A, B]) {
        const [legend] = t.player(id).zones.legendZone;
        t.expect(t.state.objects[legend as ObjectId]).toMatchObject({
          card: TEST_CARDS.legend.id,
          owner: id,
        });
      }
    },
  });

  scenario('rule 107.4.d: the Champion Legend cannot be moved out of the Legend Zone', {
    rules: ['107.4.d'],
    setup: turnThree,
    check: (t) => {
      const [legend] = t.player(A).zones.legendZone as [ObjectId];
      t.actIllegal(move(A, [legend], battlefield(t.state, 0)), 'invalid-move');
      t.actIllegal(move(A, [legend], 'base'), 'invalid-move');
      t.expect(t.player(A).zones.legendZone).toEqual([legend]);
    },
  });

  scenario(
    'rule 108.3.b: each player puts their Chosen Champion in their Champion Zone at the start',
    {
      rules: ['108.3.b'],
      setup: () => start().state,
      check: (t) => {
        for (const id of [A, B]) {
          t.expect(t.player(id).zones.championZone.map((o) => t.state.objects[o]?.card)).toEqual([
            TEST_CARDS.champion.id,
          ]);
        }
      },
    },
  );

  scenario('rule 108.7.b: a drawn card goes to the hand', {
    rules: ['108.7.b'],
    setup: () => start().state,
    check: (t) => {
      const drawn = start().events.flatMap((e) => (e.type === 'CardDrawn' ? [e] : []));
      for (const draw of drawn) t.expect(t.player(draw.player).zones.hand).toContain(draw.object);
    },
  });

  scenario(
    'rule 108.4.c: the decks are face down: their cards are seen by nobody, the owner included',
    {
      rules: ['108.4.c', '108.5.c'],
      setup: () => start(testSetup({ distinctDecks: true })).state,
      check: (t) => {
        const view = viewFor(t.state, A);
        t.expect(view.self.zones.mainDeck).toEqual({ size: t.player(A).zones.mainDeck.length });
        t.expect(view.self.zones.runeDeck).toEqual({ size: t.player(A).zones.runeDeck.length });
        const text = JSON.stringify(view);
        for (const id of [...t.player(A).zones.mainDeck, ...t.player(A).zones.runeDeck]) {
          t.expect(text).not.toContain(`"${id}"`);
        }
      },
    },
  );
});

describe('107.1.d, 108.2.d, 108.6.e, 109.2 Public information', () => {
  scenario(
    "rule 107.1.d: an opponent's permanents and runes in their base are public, with their state",
    {
      rules: ['107.1.d', '109.2'],
      setup: turnThree,
      check: (t) => {
        // B played Vanilla 1 on turn 2: it is still exhausted, and so is the rune B paid with.
        const seen = viewFor(t.state, A).opponents[0]?.zones.base ?? [];
        const base = t.player(B).zones.base;
        t.expect(seen.map((o) => o.id)).toEqual(base);
        for (const object of seen) {
          t.expect(object).toMatchObject({
            card: t.state.objects[object.id]?.card,
            exhausted: t.state.objects[object.id]?.exhausted,
            damage: t.state.objects[object.id]?.damage,
          });
        }
        t.expect(seen.some((o) => o.exhausted)).toBe(true);
      },
    },
  );

  scenario("rule 108.2.d: the cards in an opponent's Trash are public", {
    rules: ['108.2.d'],
    setup: withTrashAndBanishment,
    check: (t) => {
      const trash = viewFor(t.state, A).opponents[0]?.zones.trash ?? [];
      t.expect(trash.map((o) => [o.id, o.card])).toEqual(
        t.player(B).zones.trash.map((id) => [id, t.state.objects[id]?.card]),
      );
    },
  });

  scenario("rule 108.6.e: the cards in an opponent's Banishment are public", {
    rules: ['108.6.e'],
    setup: withTrashAndBanishment,
    check: (t) => {
      const banishment = viewFor(t.state, A).opponents[0]?.zones.banishment ?? [];
      t.expect(banishment.map((o) => [o.id, o.card])).toEqual(
        t.player(B).zones.banishment.map((id) => [id, t.state.objects[id]?.card]),
      );
    },
  });
});
