// What one player is allowed to see (ADR 0006). Built by viewFor(state, player) in `rules`.
// Hidden zones only expose their size: the type itself cannot carry hidden cards.

import type { Decision } from './decisions.ts';
import type { CardId, ObjectId, PlayerId, RulesVersion } from './ids.ts';
import type { ModeId } from './setup.ts';
import type { CombatState, GameStage, RunePool, ShowdownState } from './state.ts';

/** An object whose face the viewer may see. */
export type VisibleObject = {
  readonly id: ObjectId;
  readonly card: CardId;
  readonly owner: PlayerId;
  readonly exhausted: boolean;
  readonly damage: number;
};

/** A zone whose cards the viewer may not see: only its size is public (108.4.d, 108.7.e). */
export type HiddenZone = { readonly size: number };

type PublicZones = {
  readonly base: readonly VisibleObject[];
  readonly legendZone: readonly VisibleObject[];
  readonly championZone: readonly VisibleObject[];
  readonly trash: readonly VisibleObject[];
  readonly banishment: readonly VisibleObject[];
  /** The decks are secret, even to their owner (108.4.e, 108.5.d). */
  readonly mainDeck: HiddenZone;
  readonly runeDeck: HiddenZone;
};

/** The viewer's own zones: their hand is visible to them (108.7.c). */
export type OwnZones = PublicZones & { readonly hand: readonly VisibleObject[] };

/** Another player's zones: their hand is private to them (108.7.c). */
export type OpponentZones = PublicZones & { readonly hand: HiddenZone };

/** A battlefield and what is public about it (107.2.c). */
export type BattlefieldView = {
  readonly object: VisibleObject;
  readonly controller: PlayerId | null;
  readonly contestedBy: PlayerId | null;
  readonly showdownStaged: boolean;
  readonly combatStaged: boolean;
  readonly units: readonly VisibleObject[];
};

export type SelfView = {
  readonly id: PlayerId;
  readonly points: number;
  readonly scoredThisTurn: readonly ObjectId[];
  readonly runePool: RunePool;
  readonly zones: OwnZones;
};

export type OpponentView = {
  readonly id: PlayerId;
  readonly points: number;
  readonly scoredThisTurn: readonly ObjectId[];
  /** Rune Pools are public: resources are added by public runes. */
  readonly runePool: RunePool;
  readonly zones: OpponentZones;
};

export type PlayerView = {
  readonly viewer: PlayerId;
  readonly rulesVersion: RulesVersion;
  readonly mode: ModeId;
  readonly self: SelfView;
  /** The other players, in seating order. */
  readonly opponents: readonly OpponentView[];
  readonly turnOrder: readonly PlayerId[];
  readonly battlefields: readonly BattlefieldView[];
  readonly showdown: ShowdownState | null;
  readonly combat: CombatState | null;
  readonly stage: GameStage;
  /** The decision the viewer must make now, if any. */
  readonly decision: Decision | null;
  readonly winner: PlayerId | null;
};
