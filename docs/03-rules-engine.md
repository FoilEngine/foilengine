# 03 — Rules engine (`@foilengine/rules`)

The referee. It decides what is legal, resolves everything that happens and detects victory. The rest of the project builds on it.

## Public API

```ts
createGame(setup: GameSetup, seed: Seed): { ok: true; state: GameState; events: GameEvent[] } | { ok: false; problems: SetupProblem[] }
legalActions(state: GameState, player: PlayerId): Action[]
isLegal(state: GameState, action: Action): { ok: true } | { ok: false; reason: IllegalReason }
apply(state: GameState, action: Action): { state: GameState; events: GameEvent[] }
outcome(state: GameState): Outcome            // ongoing, winner, draw, conceded
viewFor(state: GameState, player: PlayerId): PlayerView
pendingDecision(state: GameState): Decision | null   // who must act, and on what
```

- `apply` on an illegal action **changes nothing** and throws an `IllegalActionError` with the reason. The server calls `isLegal` first.
- `createGame` refuses an invalid setup with the list of problems (an expected error, so a value): wrong rules version, unsupported mode, wrong number of players, or a deck whose structure breaks 103 or 133 (see `docs/02-game-model.md`, Setup). In M1 it supports the 1v1 Duel mode only.
- `legalActions` returns complete actions while their number stays small (11 mulligans for a hand of 4). Templates (`PlayCard` with its valid targets) will replace them when the space grows (M2).
- `GameSetup` contains the decks, the definitions of their cards (from `codex`), the mode and the rules version. Card implementations from `cards` arrive with M3.

## Design invariants

1. **Pure.** No I/O, no clock, no `Math.random`, no mutable global variable. The same input always gives the same output.
2. **Immutable from the outside.** `apply` returns a new state. Transitions are hand-written immutable updates with structural sharing, without Immer (ADR 0004): no state received as an argument is ever modified.
3. **Serializable.** The state is pure JSON: no `Map`, class, function or circular reference. `JSON.parse(JSON.stringify(state))` must give an equivalent state.
4. **Deterministic.** The RNG lives in the state (`rng`): xoshiro128** (ADR 0003), whose full 128-bit state is serialized. RNG functions are pure: `nextUint32`, `nextInt` (no modulo bias) and `shuffle` (Fisher–Yates) take a state and return the value with the next state. `createRng(seed)` derives the initial state from the game seed; it is part of the replay contract.
5. **Bounded.** Every loop (cleanup, chain, triggers) has a bound. Exceeding it throws an `EngineInvariantError`, never an infinite loop.
6. **Traceable.** Every event carries the rule that produced it when relevant.

## Internal layout

```
src/
  index.ts              public API only
  setup/                setup, mulligan, turn order (104–118)
  turn/                 phases and steps (300–317)
  cleanup/              fixed-point cleanup (318–324)
  chain/                chain and HOT FEPR loop (325–340)
  showdown/             showdowns (341–348)
  play/                 card play process, costs (349–359)
  abilities/            passive, replacement, activated, triggered abilities (360–407)
  actions/              atomic game actions: draw, recycle, exhaust, ready, channel, kill, heal, add, move, recall, banish, deal… (408–446)
  movement/             movement and recalls (447–460)
  combat/               combat and its steps (461–468)
  scoring/              hold, conquer, final point (469–474)
  layers/               continuous effects applied by layers (475–482)
  modes/                modes of play (483–491)
  resources/            runes, pool, payment and automatic payment (160–168)
  view/                 viewFor
  legal/                legalActions, isLegal, refusal reasons
  rng/                  seeded PRNG
  errors.ts
```

Each folder matches a section of the Core Rules. A file that implements a rule has a header comment quoting the numbers it covers.

## The turn, movement, showdowns and cleanups (M2, in progress)

Phases without a player decision run on their own (305): they are Outstanding Tasks (333) in `state.tasks`, run by `tasks/settle` after each action. After the last mulligan, the First Player's Start of Turn runs (315.1 to 315.4) up to their Main Phase, where they get Priority (312.2.a); `EndTurn` (316.9) queues the Ending Phase (317) and the next player's turn. A cleanup runs after each phase transition (319.2), after objects enter the board (319.6) and after a move (455), and repeats until it changes nothing (322). It performs the steps that act on what exists: victory (323.1), lethal damage (323.4), loss of control of empty battlefields (323.5), staging Showdowns and Combats (323.7 to 323.9), removing Contested (323.10), and beginning a staged Showdown or Combat (323.11, 323.12). Recalls of gear and misplaced runes (323.6) wait for gear, and a non-combat Showdown turning into a Combat Showdown (323.13) needs spells (M3). Burn Out (432) is part of drawing: repeated Burn Outs within one draw win at once (432.3.c.1).

`PlayCard` follows the steps of the play process in order: the card must be in the hand or, for the Chosen Champion, the Champion Zone (108.3.d); it goes on the Chain, Pending, as a new object (354, 124); a unit chooses its location, the base or a battlefield the player controls (355.2.a), or, with Ambush, a battlefield where the player controls units, where it has Reaction (822.1.b, 355.2.b); a spell chooses its targets (355.5, 355.9); runes add resources (357.1.a); the pool pays the printed cost and the additional costs (356, 357), Deflect included: each opponent's permanent with Deflect X that a spell or an ability chooses adds X Power of any domain (809.1.c, 356.2.a.2), for activated and triggered abilities too, which follow the same steps (400, 401); legality is checked, timing included (358); if any step fails, nothing happens (358.5). A finalized unit resolves at once (337.2): it enters the board exhausted (359.2.c) as a new object, or ready if its player paid Accelerate's [1][C] as an optional additional cost (805, 356.2.b); Accelerate on a unit with several domains is refused as not implemented yet (the cost would be a choice among its domains, 135.2.e.6.c).

A `StandardMove` (144) exhausts ready units (144.2) and moves them to one destination (144.3.a): from the base to a battlefield, from a battlefield to the base, or, for a unit with Ganking, from a battlefield to another (144.4, 810.1.b). Moving to a battlefield the player does not control makes it Contested (452); the next cleanup stages and begins a Showdown (344.2), where the player who applied Contested has Focus (345). Without spells, a player with Focus can only `PassFocus` (347.2); when all have passed, the Showdown closes, the only player with units there establishes Control (348.2.a) and Conquers it if they have not Scored it this turn (348.2.a.1, 471.1). In their Beginning Phase, the Turn Player Holds the battlefields they control (315.2.b.2, 471.2). Scoring gives one point, except that a Conquer for the Final Point draws a card instead unless the player Scored every battlefield this turn (473.1.b.1). Moving to a battlefield with enemy units causes Combat (454). The cleanup stages it (323.8) and begins it (323.12) with a Combat Showdown: the player who applied Contested is the Attacker and has Focus, the other is the Defender (466.2.c). When both have passed, the Combat Damage Step begins (348.1): the Attacker, then the Defender, assigns the summed Might of their units among the opposing units with `AssignCombatDamage`, lethal damage in full before the next unit and no more than lethal while another unit can still take some (467.2.c.3, 467.2.c.4), units with Tank before the others and units with Backline after them, a unit with both first or last as the player chooses (467.2.c.6–467.2.c.8, 815, 826); `legalActions` offers one assignment per order of the opposing units, and `isLegal` accepts any valid one. The damage is dealt at once (467.2.d), then the Resolution Step (468) runs a Combat Cleanup: units with lethal damage are killed and go to their owner's trash (323.4, 429), survivors are healed (468.1.a.1), Attackers are recalled if Defenders remain (468.1.a.2); the only player left wins, establishes Control if needed and Conquers (468.5); with no unit left, the battlefield becomes Uncontrolled (468.5.b). Without abilities, one side always loses all its units (the side with less total Might, or both on a tie), so the recall of 468.1.a.2 cannot happen yet and has no scenario until M3.

A player may concede at any time (650): `Concede` needs no decision, and `legalActions` lists it for every player while the game goes on. In 1v1 the other player then wins (651.1); removing a player from a game that goes on (651.2, 652) belongs to the modes with three players or more.

## The Chain, spells and abilities (M3, in progress)

The Chain is in `chain/`, the instructions of spells in `effects/` (ADR 0019). A spell played in the Turn Player's Main Phase in a Neutral Open State (155, 310.1.a), with Action in a Showdown (806, 308.1.a), or with Reaction on a Chain (813, 309.1.a), is finalized and waits on the Chain; its controller gains Priority (337.4, 312.2.c). The player with Priority plays a Reaction or passes (338); when every player has passed in sequence, the newest item resolves (339.1, 340.1): its instructions run from top to bottom (158.1), it goes to its owner's trash (157), and a cleanup follows (321.1). Then the controller of the newest remaining item gains Priority (340.4), or, if the Chain is empty, the turn is Open again (340.2) and in a Showdown Focus passes to the next player (340.2.a). While the Chain exists, the turn is Closed: no card without Reaction, no Standard Move, no end of turn (309.1.a, 144.1.b, 305), and the cleanup neither starts a Showdown or a Combat nor removes Control (323.5, 323.11, 323.12). A target that is no longer valid when the spell resolves is unaffected (359.3.e.5). 

Abilities are in `abilities/`. An activated ability (377) is activated like a card is played (399–407): it goes on the Chain (377.3.a) with no card (377.3.a.1), chooses its targets, pays its cost (exhausting its source for [E], Energy, Power), is checked, timing included (381, 806, 813), and waits on the Chain. A triggered ability (383) triggers when its Condition is met: for now when its unit is played (383.4.a), conquers (383.4.c), holds (383.4.d), dies (Deathknell, 808: when a unit is killed, before it goes to the trash), at the start of its controller's Beginning Phase (Temporary, 816; it resolves before the Scoring Step), attacks or defends (383.4.e, 383.4.f; when a combat begins, its units get the Attacker or Defender designation, 466.2.c.3, kept up to date by cleanups, 323.2). It waits in `state.triggered` until the current task is complete (334.1); then, starting with the Turn Player, each player puts theirs on the Chain (383.3.d.1), in the order they choose if they have several (383.3.d, an `OrderTriggers` decision); on the Combat Chain, the Attacker first and the Defender last (466.2.d.1). Pending items are finalized in the order they were added (337.1): the controller of a triggered ability that says "you may" first, chooses targets or has a cost makes those choices then, and pays the cost (a `FinalizeAbility` decision, 383.3.a, 355.5, 383.3.b); declined, it leaves the Chain (383.3.a.2), and one with no valid target or a cost that cannot be paid cannot be put on it (355.8, 358.5, 383.3.b.1). `settle` runs the tasks (HOT), stops while a Chain exists (FEPR, 336), and resumes once it is empty (335): a Hold ability, for instance, resolves in the Beginning Phase before the Channel Phase starts, and the abilities that the Combat Cleanup triggers, such as Deathknell, resolve before the combat result (468.2), Conquer abilities before the combat ends (468.6, 468.7). A Chain begun by a triggered ability does not pass Focus when it empties (340.2.a, 346.1). Still to come: putting a Deathknell ability on the Chain at the very moment of the death (808.1.d.2, 383.2.c.3; the engine notes it then, but adds it once the current task is complete), "once each turn" (386) with triggers on other objects, passive and replacement abilities, tasks incurred during FEPR (334.2.a), and the instructions that cards need.

A resolution can wait for a player's choice (ADR 0020). `executeInstructions` starts at an index; an instruction that needs a choice records it in `state.resolving` (the item, the next instruction, the token of a linked instruction, the choice) and stops, leaving the item on the Chain. `pendingDecision` then asks that player, and nothing else happens: no Priority, no triggered ability put on the Chain, no cleanup, no Task (158.3; `settle` returns). The answer is checked, applied, and the resolution resumes (`resumeResolution`). The first choice is Predict (437): the player looks at the top cards of their Main Deck, in their decision only, recycles any of them (as new objects, in a random order, 417.5) and puts the others back on top in the order they choose (437.1.a); the `Predicted` event only says how many. Vision (817) is a `played` ability that Predicts. The second choice is Weaponmaster (821.1.c): its controller may choose an Equipment they control, attached or not (725.3), with an Equip cost, and pay that cost reduced by [A] (821.1.c.3) to attach it to the unit, without activating the Equip ability (821.1.c.6).

XP (728–733) is a public number on each player, gained with the `gain-xp` instruction (730.1); Hunt X (823) is a pair of conquer and hold abilities that gain X XP. Dependent Keywords (727) are checked where their abilities act (`abilities/conditions.ts`): `trigger` skips an Inactive triggered ability (727.1.c.1), `activate` refuses an Inactive activated one (727.1.c.3), and `characteristics()` applies a passive one only while it is Active (727.1.c.2). Legion (812) is met once its controller has finalized a card other than the one with Legion this turn (`finalizedThisTurn`, reset at each new turn); on the board, "this card" is the object it was on the Chain. A discount of the card itself (356.4) is applied to the total Energy cost, after the additional costs, never below 0. Spending XP (730.2), Legion in a spell's instructions ("… instead") and the other cost modifications of 356 arrive with the effects that need them.

Gear (147–152): played to its controller's base, it enters ready (149.1, 149.2); its activated abilities are activated during its controller's Main Phase, not in a Showdown, unless they have Action or Reaction (151.2). Attach and Detach are in `actions/attach.ts` (435, 436). An attached card's own Rules Text is Inactive (718.2, 721): its abilities do not trigger and cannot be activated; its Might Bonus and the keywords of its Effect Text apply to its Top-Most Card in `characteristics()` (137.3, 718.3, 718.4). A unit that leaves the board drops its attached cards where it was (719.5); gear left at a battlefield is recalled in cleanup step 5 (323.6). Quick-Draw (819) is data: Reaction, and a Play Effect that attaches the card to a unit its controller chooses. Not yet: abilities in Effect Text, killing or targeting gear.

Tokens (179–187): the `play-token` instruction plays a token (a definition marked `token: true`) into its controller's base (`actions/play-token.ts`). It costs nothing (185.3.a.1), enters exhausted like any unit (185.2.d), counts as played (its Play Effects trigger, 383.4.a.2), and its owner and controller are the controller of the effect (182, 183). Provisional decision Q-003: it enters the board at once, during the resolution of the effect, so a later linked instruction (`token`) affects it. A token killed goes to the trash and ceases to exist there (186.1).

## Atomic game actions

Every state change goes through an **atomic game action** (draw, recycle, exhaust, ready, channel, kill, heal, add, move, recall, banish, deal, score…). Each one:

- checks its preconditions;
- goes through the applicable **replacement effects** before running;
- emits its events;
- queues a cleanup if rule 319 requires it;
- notifies the relevant **triggers**, which create tasks or chain items according to the rules of triggered abilities.

Card effects (`cards`) may only change the state by calling these atomic actions. That is what guarantees that replacements, triggers and cleanups apply everywhere.

## Continuous effects and layers

An object's characteristics (might, keywords, cost…) are never stored "computed" in the state. They are derived on read by `characteristics(state, objectId)`, which starts from the printed values and applies the continuous effects in layer order (475–482). The result may be cached per state version, but the source of truth remains the list of effects.

Implemented so far (`layers/characteristics.ts`): the Might of units in the Arithmetic layer (479.4), from the passive abilities of permanents on the board (363–365: "I have +1 [M]", "Other friendly units have +1 [M]"), the continuous effects of spells and abilities in `state.effects` ("Give a unit +2 [M] this turn", which expire in the Expiration Step, 317.2.c), and buffs (+1 each, 703; at most one per unit, 702.3). Combat damage, lethal damage and the views use this Might; below 0 it is treated as 0 where 143.2.c says so. `characteristics()` also gives a unit's keywords and its Assault and Shield values: a unit with Assault X has +X [M] while it has the Attacker designation, one with Shield X while it has the Defender designation (807.1.c, 814.1.c). Still to come: copy, trait- and ability-altering effects (479.1–479.3), conditions ("while", "if", 364.3), limits and snapshots (479.4.b), and dependencies (480, 481).

## Player choices

When the rules require a choice (targets, order of simultaneous triggers, mode, payment, mulligan), the engine stops and exposes a `Decision` through `pendingDecision`. The next action must answer that decision. There is never a callback or a promise in the engine: every choice is an action.

The order of simultaneous triggers follows turn order, starting with the active player (303.2.a). When one player has several, they choose the order (a decision).

## Errors

| Error | Meaning | Handling |
| --- | --- | --- |
| `IllegalActionError` | Action refused by the rules | Normal, sent back to the client with a reason |
| `EngineInvariantError` | Impossible state (bound exceeded, duplicated card, missing object) | Bug: error log, metric, capture of the state and the log for reproduction |
| `NotImplementedError` | Card or mechanic not coded yet | Offers manual mode to the player, metric per card |

## Performance

The engine will be called millions of times by simulations and the AI. Indicative budgets, measured by benchmarks (`vitest bench`) in CI:

- `legalActions`: under 0.2 ms in mid-game.
- `apply`: under 0.2 ms for a simple action.
- A full random game: under 20 ms.

A regression of more than 20% on a benchmark fails the CI.

The benchmarks are in `packages/spec/bench/` and run with `pnpm bench`. They use the test cards; "mid-game" is the first Main Phase from turn 5 on, with at least four cards in hand, of a random game with a fixed seed. Each benchmark asserts its budget on the mean time of one call. They run on native Node ESM (`vitest.bench.config.ts`): Vite's module runner would add a getter call to every import, a cost that is not the engine's.

The CI job "Engine benchmarks" checks the budgets. On a pull request, it first benchmarks the base branch on the same runner, then compares the medians with `scripts/compare-bench.ts`: a benchmark more than 20% slower fails the job. The comparison table goes to the job summary.

To keep these budgets, a draft (`draft.ts`) does not copy the objects of the state: it records the objects it changes on top of them, and `stateOf` builds the new table once. `apply` checks a `PlayCard` or a `StandardMove` while applying it, instead of simulating it a first time in `isLegal`. `isLegal`, and so `legalActions`, checks a `PlayCard` only up to step 5 of the play process (358), where its legality is decided: finalizing it cannot make it illegal.

## Rules versions

The engine carries the version of the Core Rules it implements (`rulesVersion`). When Riot publishes a new version:

1. the new PDF is added to `docs/rules/`;
2. the indexing script (see `06-testing.md`) compares the texts and lists the changed rules;
3. the tests of those rules are marked "to re-check" until they are reviewed;
4. the engine moves to the new version once everything has been re-checked.

Replays record the rules version. Replaying an old replay uses the version of its time if it is still available; otherwise, the gap is reported.
