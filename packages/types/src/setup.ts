// What a game is created from: createGame(setup, seed).

import type { CardDefinition } from './cards.ts';
import type { CardId, PlayerId, RulesVersion } from './ids.ts';

/** Sanctioned modes of play (486–491). */
export type ModeId = '1v1-duel' | '1v1-match' | 'ffa3' | 'ffa4' | '2v2';

/** A player's deck (103). */
export type DeckList = {
  /** Champion Legend (103.2). */
  readonly legend: CardId;
  /** Chosen Champion (103.3.a). It is one of the cards of `mainDeck`. */
  readonly champion: CardId;
  /** Main Deck, at least 40 cards including the Chosen Champion (103.3). */
  readonly mainDeck: readonly CardId[];
  /** Rune Deck, 12 runes (103.4.a). */
  readonly runeDeck: readonly CardId[];
  /** Battlefields, their number set by the mode (103.5.a; 3 in 1v1, 487.4.a). */
  readonly battlefields: readonly CardId[];
};

export type PlayerSetup = {
  readonly id: PlayerId;
  readonly deck: DeckList;
};

export type GameSetup = {
  readonly mode: ModeId;
  readonly rulesVersion: RulesVersion;
  /** In seating order (115.1.b). */
  readonly players: readonly PlayerSetup[];
  /** Definitions of every card used by the decks, keyed by `CardId`. */
  readonly cards: Readonly<Record<CardId, CardDefinition>>;
};
