# 02 — Game model

This document describes how the state of a Riftbound game is represented in `@foilengine/types` and `@foilengine/rules`. It was written from the **Core Rules 1.4 (Vendetta, updated 2026-03-30)**; the current version is **`CR-2026-10-09`**, and the numbers quoted here will be re-checked with `/rules-update` at the start of M1. The numbers quoted here are landmarks: **the reference remains the PDF in `docs/rules/`**. Before implementing a rule, re-read its exact text in the PDF and check its number: it can change from one version to the next.

## Map of the Core Rules

| Section | Content | Package |
| --- | --- | --- |
| 000–056 | Golden rule (card text overrides the rules) and silver rule (terminology, "Can't" beats "Can", do as much as possible) | `rules`, `cards` |
| 100–118 | Concepts, deck construction, setup, mulligan | `rules` (setup), `codex` (deck validation) |
| 119–124 | Game objects. **124: changing zones creates a new object** | `types`, `rules` |
| 125–139 | Card anatomy (cost, name, category, domain, text, might bonus) | `types`, `codex` |
| 140–159 | Units (damage, standard move, location), gear, spells | `rules`, `cards` |
| 160–168 | Runes, energy and power, rune pool | `rules` |
| 169–176 | Battlefields and legends (neither is a permanent) | `rules` |
| 177–187 | Multiple types, tokens (tokens are not cards) | `rules`, `cards` |
| 188–192 | Control | `rules` |
| 193–196 | Victory | `rules` |
| 197–206 | Locations, costs | `rules` |
| 300–318 | The turn: states, priority and focus, phases | `rules` |
| 318–324 | Cleanups | `rules` |
| 325–348 | Chain (HOT FEPR process) and showdowns | `rules` |
| 349–359 | Playing a card (steps of the play process, total cost) | `rules` |
| 360–406 | Abilities (passive, replacement, activated, triggered) | `rules`, `cards` |
| 407–444 | Game actions (draw, recycle, exhaust, ready, channel, kill, heal, add, recall, banish, deal…) | `rules` |
| 445–458 | Movement | `rules` |
| 459–466 | Combat and its steps | `rules` |
| 467–472 | Scoring: hold and conquer | `rules` |
| 473–480 | Layers (application order of continuous effects) | `rules` |
| 481–648 | Game modes (1v1, free-for-all, 2v2…) | `rules` |
| 649 | Conceding | `rules` |
| 700–766 | Additional rules: buffs, Mighty, bonus damage, attachment, inactive, XP, extra turns, counters, choices, untargetable, naming, ignoring effects | `rules`, `cards` |
| 800+ | Keywords (Accelerate, Action, Assault, Deflect, Ganking, Hidden, Reaction, Temporary, Equip, Quick-Draw, etc.) | `cards` |

The numbers from 360 to 800 come from an index of an earlier version (December 2025). Check them in the current PDF before quoting them.

## Game objects and identity

- Every game object has an **`ObjectId`**, unique within the game, assigned by a counter in the state (deterministic).
- **Rule 124: a zone change creates a new object.** A card going from the hand to the board, or from the board to the trash, gets a new `ObjectId`. We keep the **`CardRef`** (which printed card it is) and the history (`previousObjectId`) separately, for effects that must follow it.
- A card has an **owner** (`owner`, never changes) and, on the board, a **controller** (`controller`, can change, section 188).
- **Tokens** are not cards (185): they have a `TokenDef` instead of a `CardRef`, and cease to exist when they leave the board.

## Zones

Per-player zones (sections 104–108):

| Zone | Visibility | Ordered | Notes |
| --- | --- | --- | --- |
| `mainDeck` | Hidden from everyone | Yes | Drawn from the top |
| `runeDeck` | Hidden from everyone | Yes | 12 runes (161.2.a); recycled runes return here |
| `hand` | Visible to the owner | No | |
| `base` | Public | No | Units, gear, runes in play |
| `legendZone` | Public | — | The Champion Legend (111) |
| `championZone` | Public | — | The Chosen Champion before it is played (112) |
| `trash` | Public | Yes | |
| `banishment` | Public | No | |

Shared zones:

| Zone | Notes |
| --- | --- |
| `battlefields[]` | Each battlefield has an optional controller, units from each player, statuses (Contested, etc.). Their number depends on the mode (172). |
| `chain` | Temporary zone that only exists while a card is being played or an ability activated (328). Items are `pending` or `finalized` (329). |

Objects on a board are public information (109). Face-down cards (Hidden, 811) are the exception, to be modeled explicitly.

## Game state (high-level shape)

```ts
interface GameState {
  version: number;              // state schema version
  rulesVersion: string;         // e.g. "CR-2026-10-09"
  mode: ModeId;                 // e.g. "duel-1v1"
  rng: RngState;                // seed and counter, serializable
  nextObjectId: number;
  players: Record<PlayerId, PlayerState>;
  turnOrder: PlayerId[];        // circular queue (115.1.c)
  turn: TurnState;              // active player, phase, step, turn number
  battlefields: BattlefieldState[];
  chain: ChainItem[];
  priority: PlayerId | null;    // 312
  focus: PlayerId | null;       // 313
  showdown: ShowdownState | null;
  combat: CombatState | null;
  pendingCleanup: boolean;      // 319
  continuousEffects: ContinuousEffect[]; // applied by layers (473+)
  winner: PlayerId | null;
  log: { eventSeq: number };
}

interface PlayerState {
  id: PlayerId;
  points: number;               // never goes below 0 (194.4)
  zones: PlayerZones;
  runePool: { energy: number; power: Partial<Record<Domain | 'universal', number>> }; // 165–167
  scoredThisTurn: BattlefieldId[]; // for the once-per-turn conquer rule
  // ...
}
```

The exact names are fixed in `@foilengine/types`. Any change to the shape of the state increments `version` and must stay replayable (see `log`).

## The turn

### States (307–310)

Two independent axes:
- **Neutral** or **Showdown** (308): a showdown or a combat is in progress. In a showdown, only Action or Reaction cards and abilities can be played.
- **Open** or **Closed** (309): a chain exists (Closed, only Reactions can be played) or not (Open).

That gives four states: Neutral Open, Neutral Closed, Showdown Open, Showdown Closed (310). `legalActions` depends directly on this combined state.

### Priority and focus (311–313)

- At most one player has **priority**, needed for discretionary actions (312.1). Some limited actions do not require it (312.1.b.1).
- **Focus** lets a player act during an open showdown (313). Getting it also gives priority. Passing priority does not lose focus. Nobody has focus in the Neutral state.

### Phases (314–317)

1. **Start of turn (315)**
   - **Awaken**: the active player readies everything they control that can be readied.
   - **Beginning**: start-of-phase effects, then the scoring step where the active player **holds** the battlefields they control.
   - **Channel**: they channel 2 runes from their rune deck, or whatever remains (315.3). First-turn exception in 1v1: the first player channels 2 runes, the second player channels 3 (see Q-001 in `docs/rules/questions.md`; rule number to be confirmed in the PDF, 115.2 or the mode section).
   - **Draw**: they draw 1 card. Empty deck: they **Burn Out** (315.4.b.1), then draw anyway.
2. **Main phase (316)**: the rune pool empties, then start-of-main-phase effects. After that, no imposed structure: the active player acts in the Neutral Open state (316.5). Combat happens when opposing units are on the same battlefield (316.7). A showdown comes with every combat, and a non-combat showdown happens when a player arrives on an empty battlefield (316.8).
3. **End of turn (317)**: end step (end-of-turn effects), then the expiration step: special end cleanup, units healed, "this turn" effects expire, the rune pool empties. Then the next player becomes the active player.

### Cleanups (318–324)

A cleanup is queued after most state changes (319). It repeats until the state no longer changes (322). Its steps, in order (323):

1. Check whether there is a winner.
2. Assign or remove the attacker and defender roles in combat.
3. Manage the board: queue the triggers of units that took lethal damage (Deathknell…), then send those units to their owner's trash.
4. Empty battlefields in the Open state, with no showdown or combat, lose their controller.
5. Recall unattached gear and misplaced runes, remove Hidden cards from battlefields their owner does not control.
6. Prepare showdowns and combats where the Contested status was applied.
7. Remove the Contested status where it no longer applies.
8. In the Neutral Open state, the active player starts the prepared showdown or combat.

The cleanup is **a pure function called in a loop until a fixed point**, with an iteration bound that raises an engine error (and a metric) when reached.

### The chain and the HOT FEPR process (327–340)

One chain at a time (330). Items enter it as **pending** and become **finalized** once the legality check step has passed (329). The engine loops over:

- **HOT, Handle Outstanding Tasks**: handle all pending tasks first (334).
- **F, Finalize** (337): the controller of the oldest pending item finalizes it. Units, gear and abilities that add resources resolve immediately.
- **E, Execute** (338): the player with priority may play something legal (back to F), or pass.
- **P, Pass** (339): if everyone passes in a row without adding anything, go to R. Otherwise, back to E.
- **R, Resolve** (340): the most recent finalized item resolves entirely. If the chain is empty, the state becomes Open again. In a showdown, focus passes to the next player, unless the chain was opened by a triggered ability or an ability that adds resources.

This loop must be explicit in the code, with one name per step, because that is where most bugs will be born.

### Showdowns (341–348)

- A showdown starts during a cleanup in the Neutral Open state when control of a battlefield is Contested (344). The player who applied Contested gets focus (345).
- The player with focus plays a legal card or ability (which opens a chain; focus passes when it closes) or passes. If all players pass once in a row, the showdown closes (347).
- A combat showdown moves on to the combat steps. A non-combat showdown gives control to the only remaining player, with a possible conquer if they have not already scored that battlefield this turn (348).

## Setup (104–118)

1. Each player puts their Champion Legend in their legend zone (111) and their Chosen Champion in their champion zone (112).
2. Battlefields are set aside, then placed according to the mode (113).
3. Each player shuffles their main deck and rune deck separately (114): with the state's RNG.
4. Turn order is drawn at random (115), with the state's RNG.
5. Each player draws 4 cards (116).
6. Mulligan, in turn order: each player sets aside up to 2 cards, draws as many, then recycles the cards set aside (117).
7. The first player starts their turn (118).

Deck construction (101) is validated by `codex`/`rules` before the game is created: number of cards, legend, champion, 12 runes, battlefields, domains.

## Resources (160–168)

- A rune produces **energy** (for numeric costs, domainless) by exhausting, or **power** of its domain (for domain costs) by being recycled (163–164).
- Resources go through the **rune pool**, which empties at the start of each main phase and at the end of each turn (167). Unspent resources are lost.
- Automatic payment (as on Rift Atlas) is a `rules` function that proposes a set of runes to exhaust or recycle. The player can always pay by hand. It is a help, not a rule.

## Victory (193–196)

- Points are scored by **holding** a battlefield, by **conquering** it, through spells or abilities, and through the opponent's Burn Outs (194.1).
- A player wins during a cleanup if they have at least the victory score and more points than everyone else (194.2). The default victory score is 8; the mode or effects can change it (194.3).
- Points never go below 0 (194.4).
- A player also wins if an effect says so, or if they are the last player remaining (195).
- The last-point conquer rule (you do not win by conquering unless you also scored the other battlefields this turn) is in the scoring section (467–472): read and test it first.

## Actions

An `Action` is a **player's intent**, serializable, with no reference to JavaScript objects. Families:

- `Mulligan { cards }`
- `PlayCard { card, choices, payment }` (choice of targets, modes, additional costs, 349–359)
- `ActivateAbility { source, ability, choices, payment }`
- `StandardMove { units, destination }` (144, 445+)
- `PassPriority`, `PassFocus`
- `EndTurn`
- `Concede` (649)
- `ManualOverride { description, patch }`: manual mode, always marked as such in the log

`legalActions(state)` returns the possible actions **up to structure** (for example `PlayCard` with the valid targets), and a function `isLegal(state, action)` checks a complete action, with a reason when it refuses.

## Events

A `GameEvent` describes **what happened**, in the exact order, with a sequence number. Examples: `CardDrawn`, `RuneChanneled`, `CardPlayed`, `ChainItemAdded`, `ChainItemFinalized`, `ChainItemResolved`, `UnitMoved`, `DamageDealt`, `UnitKilled`, `ShowdownStarted`, `FocusPassed`, `BattlefieldConquered`, `BattlefieldHeld`, `PointsScored`, `TurnStarted`, `PhaseChanged`, `CleanupRan`, `GameWon`.

Each event carries the **rule that produced it** (`rule: "315.3"`) when relevant. That is what enables rule coverage in production, and debugging.

Events have a **visibility**: public, or restricted to some players (a drawn card is only visible to its owner; the others see "a card was drawn"). Filtering is done by `log`, not by hand in the server.

## Per-player views

`viewFor(state, player)` returns what that player is allowed to see: their hand, their decks reduced to their size, the opponent's hand reduced to its size, public objects, the chain, the pending choices that concern them. It is used by the server, by the AI (which must not cheat) and by the tests.
