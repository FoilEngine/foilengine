// Zones (105–108) and privacy (128).

/** Privacy levels (128.3–128.5). */
export type Privacy = 'secret' | 'private' | 'public';

/**
 * Zones each player has. Board: `base` (107.1), `legendZone` (107.4).
 * Non-Board: `championZone` (108.3), `mainDeck` (108.4), `runeDeck` (108.5),
 * `banishment` (108.6), `hand` (108.7), `trash` (108.2).
 * The Battlefield Zone, the Facedown Zones and the Chain are shared (107.2, 107.3, 108.1).
 */
export type PlayerZoneId =
  | 'base'
  | 'legendZone'
  | 'championZone'
  | 'mainDeck'
  | 'runeDeck'
  | 'hand'
  | 'trash'
  | 'banishment';

/** Default privacy of the cards in each player zone (128.2.a). */
export const PLAYER_ZONE_PRIVACY: { readonly [Z in PlayerZoneId]: Privacy } = {
  base: 'public', // 107.1.d
  legendZone: 'public', // 107.4
  championZone: 'public', // 108.3.e
  mainDeck: 'secret', // 108.4.c, 108.4.e
  runeDeck: 'secret', // 108.5.c, 108.5.d
  hand: 'private', // 108.7.c
  trash: 'public', // 108.2.d
  banishment: 'public', // 108.6.e
};

/** Zones whose order matters: the decks (108.4.e, 108.5.d). Trash, hand and banishment are unordered. */
export const ORDERED_PLAYER_ZONES: readonly PlayerZoneId[] = ['mainDeck', 'runeDeck'];
