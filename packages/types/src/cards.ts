// Card definitions: the card as a rule, shared by all its printings (docs/05-codex-data.md).
// M1 only holds what setup needs; costs, might and keywords arrive with M2 and M3.

import type { CardId } from './ids.ts';

/** The six domains (134.2). */
export type Domain = 'fury' | 'calm' | 'mind' | 'body' | 'chaos' | 'order';

/** Card categories (133.4–133.6). */
export type CardCategory = 'unit' | 'gear' | 'spell' | 'rune' | 'battlefield' | 'legend';

/** Supertypes (133.7). */
export type Supertype = 'champion' | 'signature';

export type CardDefinition = {
  readonly id: CardId;
  readonly name: string;
  readonly category: CardCategory;
  readonly supertypes: readonly Supertype[];
  /** Tags (133.8), including Champion Tags (133.8.b). */
  readonly tags: readonly string[];
  readonly domains: readonly Domain[];
  /** Rules text in force, errata included. Informative: effects are implemented in `cards`. */
  readonly text: string;
};
