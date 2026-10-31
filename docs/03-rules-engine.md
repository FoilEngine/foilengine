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

`PlayCard` follows the steps of the play process in order: the card must be in the hand or, for the Chosen Champion, the Champion Zone (108.3.d); it goes on the Chain, Pending, as a new object (354, 124); a unit chooses its location, the base or a battlefield the player controls (355.2.a), a spell its targets (355.5, 355.9); runes add resources (357.1.a); the pool pays the printed cost (356, 357); legality is checked, timing included (358); if any step fails, nothing happens (358.5). A finalized unit resolves at once (337.2): it enters the board exhausted (359.2.c) as a new object.

A `StandardMove` (144) exhausts ready units (144.2) and moves them to one destination (144.3.a): from the base to a battlefield, or from a battlefield to the base (144.4). Moving to a battlefield the player does not control makes it Contested (452); the next cleanup stages and begins a Showdown (344.2), where the player who applied Contested has Focus (345). Without spells, a player with Focus can only `PassFocus` (347.2); when all have passed, the Showdown closes, the only player with units there establishes Control (348.2.a) and Conquers it if they have not Scored it this turn (348.2.a.1, 471.1). In their Beginning Phase, the Turn Player Holds the battlefields they control (315.2.b.2, 471.2). Scoring gives one point, except that a Conquer for the Final Point draws a card instead unless the player Scored every battlefield this turn (473.1.b.1). Moving to a battlefield with enemy units causes Combat (454). The cleanup stages it (323.8) and begins it (323.12) with a Combat Showdown: the player who applied Contested is the Attacker and has Focus, the other is the Defender (466.2.c). When both have passed, the Combat Damage Step begins (348.1): the Attacker, then the Defender, assigns the summed Might of their units among the opposing units with `AssignCombatDamage`, lethal damage in full before the next unit and no more than lethal while another unit can still take some (467.2.c.3, 467.2.c.4); `legalActions` offers one assignment per order of the opposing units, and `isLegal` accepts any valid one. The damage is dealt at once (467.2.d), then the Resolution Step (468) runs a Combat Cleanup: units with lethal damage are killed and go to their owner's trash (323.4, 429), survivors are healed (468.1.a.1), Attackers are recalled if Defenders remain (468.1.a.2); the only player left wins, establishes Control if needed and Conquers (468.5); with no unit left, the battlefield becomes Uncontrolled (468.5.b). Without abilities, one side always loses all its units (the side with less total Might, or both on a tie), so the recall of 468.1.a.2 cannot happen yet and has no scenario until M3.

A player may concede at any time (650): `Concede` needs no decision, and `legalActions` lists it for every player while the game goes on. In 1v1 the other player then wins (651.1); removing a player from a game that goes on (651.2, 652) belongs to the modes with three players or more.

## The Chain, spells and abilities (M3, in progress)

The Chain is in `chain/`, the instructions of spells in `effects/` (ADR 0019). A spell played in the Turn Player's Main Phase in a Neutral Open State (155, 310.1.a), with Action in a Showdown (806, 308.1.a), or with Reaction on a Chain (813, 309.1.a), is finalized and waits on the Chain; its controller gains Priority (337.4, 312.2.c). The player with Priority plays a Reaction or passes (338); when every player has passed in sequence, the newest item resolves (339.1, 340.1): its instructions run from top to bottom (158.1), it goes to its owner's trash (157), and a cleanup follows (321.1). Then the controller of the newest remaining item gains Priority (340.4), or, if the Chain is empty, the turn is Open again (340.2) and in a Showdown Focus passes to the next player (340.2.a). While the Chain exists, the turn is Closed: no card without Reaction, no Standard Move, no end of turn (309.1.a, 144.1.b, 305), and the cleanup neither starts a Showdown or a Combat nor removes Control (323.5, 323.11, 323.12). A target that is no longer valid when the spell resolves is unaffected (359.3.e.5). 

Abilities are in `abilities/`. An activated ability (377) is activated like a card is played (399–407): it goes on the Chain (377.3.a) with no card (377.3.a.1), chooses its targets, pays its cost (exhausting its source for [E], Energy, Power), is checked, timing included (381, 806, 813), and waits on the Chain. A triggered ability (383) triggers when its Condition is met: for now when its unit is played (383.4.a), conquers (383.4.c) or holds (383.4.d). It waits in `state.triggered` until the current task is complete (334.1); then, starting with the Turn Player, each player puts theirs on the Chain (383.3.d.1), in the order they choose if they have several (383.3.d, an `OrderTriggers` decision). Pending items are finalized in the order they were added (337.1). `settle` runs the tasks (HOT), stops while a Chain exists (FEPR, 336), and resumes once it is empty (335): a Hold ability, for instance, resolves in the Beginning Phase before the Channel Phase starts, and Conquer abilities from a combat resolve before the combat ends (468.6, 468.7). A Chain begun by a triggered ability does not pass Focus when it empties (340.2.a, 346.1). Still to come: choices when a triggered ability is finalized (targets, "you may", 383.3.a), attack and defend triggers with unit designations, passive and replacement abilities, tasks incurred during FEPR (334.2.a), and the instructions that cards need.

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
