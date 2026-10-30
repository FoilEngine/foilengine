// Branded identifiers (docs/13-conventions.md). Values are created by `rules`
// (counters stored in the state, never randomness): this package has no functions.

/** A player in the game. */
export type PlayerId = string & { readonly __brand: 'PlayerId' };

/**
 * A game object (119). A new id is assigned every time an object changes zones
 * to or from a Non-Board Zone (124), e.g. when a card is drawn.
 */
export type ObjectId = string & { readonly __brand: 'ObjectId' };

/** A card definition, identified by its `riftbound_id` (docs/05-codex-data.md). */
export type CardId = string & { readonly __brand: 'CardId' };

/** Seed of a game. The whole game is a function of the setup, the seed and the actions. */
export type Seed = string & { readonly __brand: 'Seed' };

/** Exact number of a Core Rules rule, as printed: `117`, `315.3.b.1`. */
export type RuleNumber = `${number}` | `${number}.${string}`;

/** Version of the Core Rules, `CR-<last updated date>` (docs/rules/README.md). */
export type RulesVersion = `CR-${string}`;
