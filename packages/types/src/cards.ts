// Card definitions: the card as a rule, shared by all its printings (docs/05-codex-data.md).
// Effects are plain data interpreted by the engine (ADR 0019, effects.ts).

import type { Ability, Instruction, Keyword, TargetSpec, ValuedKeyword } from './effects.ts';
import type { CardId } from './ids.ts';

/** The six domains (134.2). */
export type Domain = 'fury' | 'calm' | 'mind' | 'body' | 'chaos' | 'order';

/** Card categories (133.4–133.6). */
export type CardCategory = 'unit' | 'gear' | 'spell' | 'rune' | 'battlefield' | 'legend';

/** The six domains, in a fixed order used wherever the engine iterates over them. */
export const DOMAINS: readonly Domain[] = ['fury', 'calm', 'mind', 'body', 'chaos', 'order'];

/** A Power cost symbol: one Power of a domain, or `any` for [A], Power of any domain (135.2.e.5.a). */
export type PowerSymbol = Domain | 'any';

/** The cost printed in the upper left corner of a Main Deck card (131). */
export type Cost = {
  /** Energy cost: the numeral (131.2.a). */
  readonly energy: number;
  /** Power cost: the symbols listed vertically, possibly none (131.3). */
  readonly power: readonly PowerSymbol[];
};

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
  /** Main Deck cards (131.1). */
  readonly cost?: Cost;
  /** Units (143). */
  readonly might?: number;
  /** Rules text in force, errata included. The engine reads the fields below, not this text. */
  readonly text: string;
  /** Keywords printed on the card (800+). */
  readonly keywords?: readonly (Keyword | ValuedKeyword)[];
  /** What the card chooses as it is played (355.5): instructions refer to these by index. */
  readonly targets?: readonly TargetSpec[];
  /** A spell's instructions, executed from top to bottom when it resolves (158.1). */
  readonly instructions?: readonly Instruction[];
  /** The abilities of the card (361), in printed order. */
  readonly abilities?: readonly Ability[];
  /**
   * Effect Text (136): inactive unless the card is Attached (136.2.b); then appended to the Rules
   * Text of its Top-Most Card (136.2.c, 718.3). For now, keywords only.
   */
  readonly effectText?: { readonly keywords?: readonly (Keyword | ValuedKeyword)[] };
  /** "Repeat [Cost]" (820.1.c): the cost to execute a spell's instructions one more time. */
  readonly repeat?: Cost;
  /** Might Bonus (137): modulates the Might of the card it is Attached to (137.3). */
  readonly mightBonus?: number;
  /**
   * A token, not a card (185.1): the definition of a token that effects play (`play-token`).
   * It has no cost (185.3.a) and no domain (185.3.b), and is never in a deck.
   */
  readonly token?: boolean;
};
