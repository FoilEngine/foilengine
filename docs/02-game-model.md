# 02 — Game model

This document describes how the state of a Riftbound game is represented in `@foilengine/types` and `@foilengine/rules`. Every rule number quoted here was checked against **`CR-2026-10-09`** (`docs/rules/index/CR-2026-10-09.json`) on 2026-10-30. The numbers are landmarks: **the reference remains the PDF in `docs/rules/`**. Before implementing a rule, re-read its exact text in the PDF and check its number: it can change from one version to the next.

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
| 300–317 | The turn: states, priority and focus, phases | `rules` |
| 318–324 | Cleanups | `rules` |
| 325–348 | Chain (HOT FEPR process) and showdowns | `rules` |
| 349–359 | Playing a card (steps of the play process, total cost) | `rules` |
| 360–407 | Abilities (passive, replacement, activated, triggered, reflexive, delayed, linked) and how they are played | `rules`, `cards` |
| 408–446 | Game actions (draw, exhaust, ready, recycle, deal, heal, move, kill, add, channel, burn out, banish…) | `rules` |
| 447–460 | Movement (447–455) and recalls (456–460) | `rules` |
| 461–468 | Combat and its steps | `rules` |
| 469–474 | Scoring: hold and conquer, the final point | `rules` |
| 475–482 | Layers (application order of continuous effects) | `rules` |
| 483–491 | Modes of play (1v1 Duel and Match, FFA3, FFA4, 2v2), including each mode's first-turn process | `rules` |
| 649–652 | Conceding | `rules` |
| 700–767 | Additional rules: buffs, Mighty, bonus damage, attachment, inactive, dependent keywords, XP, additional turns, counters, new choices, untargetability, naming, ignoring effects | `rules`, `cards` |
| 800+ | Keywords (Accelerate, Action, Assault, Deflect, Ganking, Hidden, Reaction, Temporary, Equip, Quick-Draw, etc.) | `cards` |

From section 400 on, CR-2026-10-09 shifted the numbers by one to three compared with 1.4 (see `docs/rules/changes/CR-2026-10-09.md`). Always look a number up in the index before quoting it.

## Game objects and identity

- Every game object has an **`ObjectId`**, unique within the game, assigned by a counter in the state (deterministic): `o1`, `o2`…
- **Rule 124: a change to or from a Non-Board Zone creates a new object.** Drawing (main deck → hand), recycling (hand → deck), playing a card (hand → chain), a unit dying (board → trash): each gives a new `ObjectId`. The object keeps its `card` (the `CardId` of its definition) and its `previousObjectId`, for effects that must follow it.
- A card has an **owner** (`owner`, the player who brought it into the game, 127.1, never changes) and, on the board, a **controller** (`controller`, can change, section 188; arrives with M2).
- **Tokens** are not cards (185): they will have a token definition instead of a `CardId`, and cease to exist when they leave the board (186).

## Zones

Each player has these zones (107–108). Privacy is the default privacy of the cards there (128.2.a): **secret** (no one sees the face, 128.3), **private** (only the owner, or the controller on the board, 128.4), **public** (everyone, 128.5).

| Zone | Board? | Privacy | Ordered | Rules |
| --- | --- | --- | --- | --- |
| `base` | Board | Public | No | 107.1 |
| `legendZone` | Board | Public | — | 107.4; the Champion Legend never leaves it (107.4.d) |
| `championZone` | Non-Board | Public | — | 108.3; the Chosen Champion before it is played |
| `mainDeck` | Non-Board | Secret | Yes, top first | 108.4; its size is public (108.4.d) |
| `runeDeck` | Non-Board | Secret | Yes, top first | 108.5; 12 runes (103.4.a) |
| `hand` | Non-Board | Private | No | 108.7; its size is public (108.7.e) |
| `trash` | Non-Board | Public | No | 108.2 |
| `banishment` | Non-Board | Public | No | 108.6 |

Shared zones:

| Zone | Board? | Rules | Notes |
| --- | --- | --- | --- |
| Battlefield Zone (`battlefields`) | Board | 107.2 | Each battlefield is a location (107.2.b). Their number depends on the mode (172; 2 in 1v1, 487.4). |
| Facedown Zones | Board | 107.3 | One per battlefield, one card by default (107.3.b). A public zone holding private cards (107.3.f). Arrives with M2 or M3. |
| Chain | Non-Board | 108.1, 327 | Exists only while a card or ability is being played (328). Public (108.1.b). Arrives with M3. |

The zone privacy table is `PLAYER_ZONE_PRIVACY` in `@foilengine/types`.

## Game state

The exact types are in `@foilengine/types` (`src/state.ts`); they hold what M1 needs and grow with each milestone. The state is pure JSON, written as `type` aliases so that a test checks it against `Json`.

```ts
type GameState = {
  version: 8;                       // STATE_VERSION, incremented on every shape change
  rulesVersion: RulesVersion;       // e.g. "CR-2026-10-09"
  mode: ModeId;                     // '1v1-duel' | '1v1-match' | 'ffa3' | 'ffa4' | '2v2' (487–491)
  rng: RngState;                    // xoshiro128** state, four uint32 words (ADR 0003)
  nextObjectId: number;             // counter for ObjectIds
  eventSeq: number;                 // sequence number of the last event
  cards: Record<CardId, CardDefinition>;   // definitions of this game's cards: a state is self-contained
  objects: Record<ObjectId, GameObject>;   // every object, by id
  players: PlayerState[];           // seating order; points, turnsTaken, runePool, zones (lists of ObjectIds)
  turnOrder: PlayerId[];            // looping queue (115.1.c)
  battlefields: BattlefieldState[]; // controller, contestedBy, showdownStaged, combatStaged, units present
  showdown: ShowdownState | null;   // battlefield, player with Focus, passes in sequence
  combat: CombatState | null;       // battlefield, attacker, defender, step, damage assigned, units with each designation
  chain: ChainState | null;         // items (oldest first: card or ability, controller, status, targets), priority, passes, begun by a trigger
  triggered: TriggeredAbility[];    // triggered abilities waiting to be put on the Chain (383.3)
  tasks: Task[];                    // Outstanding Tasks: the next steps of the turn or of a combat (333)
  stage: GameStage;                 // mulligan | turn (turnPlayer, turnNumber, phase) | ended
  winner: PlayerId | null;
};
```

Each `GameObject` also carries `exhausted` (415, 416); a new object starts ready, since statuses do not follow an object through a zone change (124.1). Units are on the board either in their controller's base or in a battlefield's `units`; a unit's location (146.1) is where its id is listed. Each player also keeps `scoredThisTurn`, the battlefields they Scored this turn (472). Each `GameObject` carries the `damage` marked on it (142). The Chain (327–340) is a Non-Board Zone that exists while it holds an item (330): each item is a card being played, as a new object (124), or an ability, which has no card (377.3.a.1) and gets an id of its own (123); each has its controller, its status (Pending, then Finalized, 329) and its chosen targets. The Chain also records who has Priority, how many players passed in sequence (339.1), and whether a triggered ability began it (340.2.a). While it exists, the turn is Closed (309.1).

`tasks` are the Outstanding Tasks (333): the steps of the turn that run without a decision (awaken, beginning, scoring, channel, draw, main, ending, expiration, next turn) and the end of a combat (468.7). They wait while a Chain must be resolved (334, 335). `triggered` holds the triggered abilities whose Condition was met and that are not on the Chain yet: they wait for the current task to complete, or for their controller to order them (383.3.d). Arriving later: abilities on the Chain, continuous effects (475+), control of units and the other statuses of objects.

## Card definitions and effects

`CardDefinition` holds the printed characteristics, and the card's effects as plain JSON (ADR 0019): its `keywords` (806 Action, 813 Reaction for now), the `targets` it chooses as it is played (355.5), a spell's `instructions`, executed from top to bottom when it resolves (158.1), and its `abilities` (361): activated ones with their cost (energy, Power, exhausting the source), keywords, targets and instructions (377), and triggered ones with their Condition (when played, conquers, holds, attacks, defends, 383.4), the choices they make as they are finalized ("you may" first, 383.3.a; targets, 355.5) and instructions. The vocabulary is in `@foilengine/types` (`effects.ts`): `draw` (414) and `deal` (418) for now; it grows with the mechanics, and the engine interprets every building block. Since `cards` is in the state, a game and its replay carry the effects of its cards.

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
   - **Awaken** (315.1): the active player readies everything they control that can be readied.
   - **Beginning** (315.2): start-of-phase effects, then the scoring step where the active player **holds** the battlefields they control.
   - **Channel** (315.3): they channel 2 runes from their rune deck (315.3.b), or as many as remain (315.3.b.1). The first turn is adjusted by the mode (115.2, 485.7): in 1v1, the player going second channels an extra rune during their first Channel Phase (487.7, 488.7); in modes with three or more players, the player going first does not draw during their first Draw Phase and the player going last channels an extra rune (489.7–491.7). See Q-001 in `docs/rules/questions.md`.
   - **Draw** (315.4): they draw 1 card. Empty deck: they **Burn Out** (315.4.b.1), then draw anyway (315.4.b.2).
2. **Main phase (316)**: the rune pool empties (316.3), then start-of-main-phase effects (316.4). After that, no imposed structure: the active player acts in the Neutral Open state (316.5). Combat happens when opposing units are on the same battlefield (316.7). A showdown comes with every combat, and a non-combat showdown happens when a player arrives on an empty battlefield (316.8).
3. **End of turn (317)**: ending step (end-of-turn effects, 317.1), then the expiration step (317.2): ending special cleanup, units healed, "this turn" effects expire, the rune pool empties. Then the next player in turn order becomes the active player (317.3).

### Cleanups (318–324)

A cleanup is queued after most state changes (319). It repeats until the state no longer changes (322). Its steps, in order (323; the PDF numbers them 1 to 10 with sub-steps):

1. A player with at least the victory score and more points than every opponent wins (323.1).
2. Assign or remove the attacker and defender designations if a combat is in progress (323.2).
3. Handle the board state: units with lethal damage are killed and put in their owner's trash (323.3, 323.4).
4. Players lose control of battlefields they no longer occupy, if the turn is in an Open state with no showdown or combat there (323.5).
5. Recall unattached gear and misplaced runes, among others (323.6; read the full list in the PDF).
6. Mark a showdown as Staged at each battlefield where Contested was applied and no combat is ongoing (323.7).
7. Mark a combat as Staged where Contested was applied and opposing units are present (323.8); a staged combat stops being staged if those units are gone before it opens (323.9).
8. Remove the Contested status where it no longer applies (323.10).
9. In the Neutral Open state, the turn player chooses a battlefield with a staged showdown and it begins (323.11).
10. In the Neutral Open state, the turn player chooses a battlefield with a staged combat and it begins (323.12); a non-combat showdown in progress can become a combat showdown (323.13).

The cleanup is **a pure function called in a loop until a fixed point**, with an iteration bound that raises an engine error (and a metric) when reached.

### The chain and the HOT FEPR process (327–340)

One chain at a time (330.1). Items enter it as **pending** and become **finalized** once the legality check step has passed (329). The engine loops over:

- **HOT, Handle Outstanding Tasks**: handle all pending tasks first (334).
- **F, Finalize** (337): the controller of the oldest pending item finalizes it. Units, gear and abilities that add resources resolve immediately.
- **E, Execute** (338): the player with priority may play something legal (back to F), or pass.
- **P, Pass** (339): if everyone passes in a row without adding anything, go to R. Otherwise, back to E.
- **R, Resolve** (340): the most recent finalized item resolves entirely. If the chain is empty, the state becomes Open again (340.2). In a showdown, focus passes to the next player, unless the chain was opened by a triggered ability or an ability that adds resources (340.2.a).

This loop must be explicit in the code, with one name per step, because that is where most bugs will be born.

### Showdowns (341–348)

- A showdown starts during a cleanup in the Neutral Open state when control of a battlefield is Contested (344). The player who applied Contested gets focus (345).
- The player with focus plays a legal card or ability (which opens a chain; focus passes when it closes) or passes. If all players pass once in a row, the showdown closes (347).
- A combat showdown moves on to the combat steps. A non-combat showdown gives control to the only remaining player, with a possible conquer if they have not already scored that battlefield this turn (348).

## Setup (104–118)

1. Each player puts their Champion Legend in their legend zone (111) and their Chosen Champion in their champion zone (112).
2. Battlefields are set aside, then placed according to the mode (113.1). In 1v1, each player randomly selects one of their three battlefields with the state's RNG; the other two are not used (487.4.a, 487.5).
3. Each player shuffles their main deck and rune deck separately (114): with the state's RNG.
4. Turn order is drawn at random (115), with the state's RNG: the 1v1 mode does not say how to pick the First Player (115.1.a), so the engine draws it, then follows seating order (115.1.b). In tournament matches, the Tournament Rules add the Play First Rule (TR 407): a randomly designated player chooses to play first or last, and the loser of a game chooses for the next one. It belongs to matches (M8).
5. Each player draws 4 cards (116).
6. Mulligan, in turn order: each player sets aside up to 2 cards, draws as many, then recycles the cards set aside (117.1–117.3) to the bottom of their Main Deck, in a random order when there are two (417.5).
7. The first player starts their turn (118).

Deck construction (101–103) is validated in two places. `createGame` checks the structure it needs to set up a game (M1): one legend, one Chosen Champion that is in the main deck, 12 runes, the number of battlefields required by the mode, and only known cards. `codex` checks the deckbuilding rules (M4): 40 cards minimum, Domain Identity (103.2.b), Champion Tag (103.3.a.2), 3 copies maximum (103.3.b), Signature cards (103.3.d), format legality.

## Resources (160–168)

- A rune produces **energy** (for numeric costs, domainless) by exhausting, or **power** of its domain (for domain costs) by being recycled (163, 164.2).
- Resources go through the **rune pool** (`runePool`: Energy, and Power per domain plus `any` for [A], the Power of any domain of 135.2.e.5 and 163.2.b), which empties at the start of each main phase and at the end of each turn (167). Unspent resources are lost.
- A card's cost (131) is `{ energy, power }`, where `power` lists symbols: a domain, or `any` for [A]. A domain symbol is paid with Power of that domain or of any domain; [A] with any Power.
- In `PlayCard`, the `payment` lists rune uses in order: `exhaust` (164.2.a, +1 Energy) or `recycle` (164.2.b, +1 Power of the rune's domain, the rune goes to the bottom of the Rune Deck). The same rune may be exhausted, then recycled. The pool then pays the cost; what is left stays in the pool.
- Automatic payment (as on Rift Atlas) is `autoPayment`, a `rules` function that proposes rune uses: it recycles only for Power and exhausts a rune before recycling it when Energy is still needed. The player can always pay by hand. It is a help, not a rule; `legalActions` offers one `PlayCard` per affordable unit, paid this way.

## Victory (193–196)

- Points are scored by **holding** a battlefield, by **conquering** it, through spells or abilities, and through the opponent's Burn Outs (194.1.a–194.1.d).
- A player wins during a cleanup if they have at least the victory score and more points than everyone else (194.2). The default victory score is 8 (194.3); the mode or card effects can change it (194.3.a).
- Points never go below 0 (194.4).
- A player also wins if an effect says so, or if they are the last player remaining (195).
- The final point (473.1.a, 473.1.b): a player who tries to gain a point through a conquer while 1 point or less from the victory score gains it only if they scored every battlefield this turn; otherwise they draw a card instead (473.1.b.1). The 2v2 mode adjusts this (491.8.g). Read and test it first.

## Actions

An `Action` is a **player's intent**, serializable, with no reference to JavaScript objects. It names the acting player. M1 has only the first one; the others arrive with their milestone:

- `Mulligan { player, setAside }`: set aside up to two cards, or none to keep the hand (117.1)
- `PlayCard { card, location?, targets?, payment }`: a unit chooses its `location` (355.2), a card with targets one target per target of its definition (355.5); modes and additional costs arrive with them (349–359)
- `ActivateAbility { source, ability, choices, payment }`
- `StandardMove { units, destination }` (144, 447+)
- `ActivateAbility { source, ability, targets?, payment }` (377, 399–407)
- `OrderTriggers { order }`: the order of the player's triggered abilities that triggered together (383.3.d)
- `FinalizeAbility { perform, targets? }`: the choices for the oldest Pending triggered ability (337.1): decline a "you may" ability (383.3.a.2), or choose its targets
- `PassPriority` (338.1.b), on a Chain; `PassFocus` (347.2), in a Showdown
- `EndTurn`
- `Concede` (649–652): legal for every player at any time (650), so `legalActions` always lists it last while the game goes on
- `ManualOverride { description, patch }`: manual mode, always marked as such in the log

`legalActions(state)` returns the possible actions **up to structure** (for example `PlayCard` with the valid targets), and a function `isLegal(state, action)` checks a complete action, with a reason when it refuses.

## Events

A `GameEvent` describes **what happened**, in the exact order, with a sequence number (`seq`). Each event carries the **rule that produced it** (`rule: "117"`) when relevant: that is what enables rule coverage in production, and debugging.

M1 events: `GameCreated` (110), `CardPlaced` (111, 112), `BattlefieldSelected` (113, 487.5), `DeckShuffled` (114), `TurnOrderDetermined` (115), `CardDrawn` (116, 117.2), `MulliganTaken` and `CardRecycled` (117), `SetupCompleted` (118). Later ones include `RuneChanneled`, `CardPlayed`, `UnitsMoved`, `DamageDealt`, `ShowdownStarted`, `BattlefieldScored`, `PointsGained`, `GameWon`, and for the Chain `ChainItemAdded` (354), `AbilityAdded` (377.3.a, 383.3), `ChainItemFinalized` (359.1), `ChainItemRemoved` (383.3.a.2, 355.8), `PriorityPassed` (338.1.b) and `ChainItemResolved` (340.1).

### Visibility

Every event has a `visibility`: `public`, or `private` to a list of players. For the other players, the fields listed in `PRIVATE_EVENT_FIELDS` are removed and the event is marked `redacted`: an opponent sees that a card was drawn, not which one. The private fields include the **object ids** of private cards, not only their `CardId`: an id would let a player follow a card they cannot see (for example, link the card drawn on turn 3 to the one played on turn 5). One event per fact, redacted on the way out, rather than a private and a public twin.

Filtering is done by `log` and `viewFor`, never by hand in the server.

## Replays

`@foilengine/log` writes and reads replays: the `.foilreplay` format (ADR 0005), versioned by `REPLAY_FORMAT` (currently 1). A replay holds the Core Rules version, the setup, the seed and the actions. Events are not stored: replaying the actions derives them again, byte for byte (ADR 0003).

Each step (the creation of the game, then each action) records a fingerprint, `stepHash`, of the state the step led to and of the events it produced. Fingerprints are Merkle hashes (`digestOf`): the 128-bit digest of an object or an array hashes the digests of its items, keys sorted, and is cached by reference. A state never changes once built and shares most of its objects with the previous one, so each step only hashes what it changed. `replay` re-applies the actions, checks that each one is legal and that each fingerprint matches, and reports the first problem: another rules version, a refused setup, an illegal action, or a divergence at a given step. `rewindTo(replay, n)` gives the state after the first `n` actions.

The text of a replay is canonical JSON, so the same game always gives the same file. `stateHash` fingerprints a state alone, for the fuzzer and the server's background replays. The fingerprint detects changes, it is not a security measure.

`filterEventsFor(events, player)` redacts the events a player must not see (see Visibility above), for the server and for replays shown to a player.

## Per-player views

`viewFor(state, player)` returns a `PlayerView`: what that player is allowed to see. Their own hand as objects; the opponents' hands and every deck (their own included, 108.4.e) as a size only (`HiddenZone`); the public zones; the battlefields; the stage; and the decision that player must make, if any. The view carries no card definitions, so it cannot reveal a deck list.

The type makes leaks impossible to express: an opponent's hand is `{ size: number }`, with no room for cards. Objects are shown without `previousObjectId`, which could link a public card to a hidden one. A pending decision is only shown to the player who must make it. The no-leak test (`packages/spec/test/engine/no-leak.test.ts`) checks, on every state of random games, that changing what a player cannot see does not change their view at all (non-interference), and that the view holds no hidden card and no hidden object id. The view is used by the server, by the AI (which must not cheat) and by the tests.
