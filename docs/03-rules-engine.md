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

## The turn and cleanups (M2, in progress)

Phases without a player decision run on their own (305): after the last mulligan, `apply` runs the First Player's Start of Turn (315.1 to 315.4) and stops when they get Priority in their Main Phase (312.2.a); `EndTurn` (316.9) runs the Ending Phase (317) and the next player's Start of Turn. A cleanup runs after each phase transition (319.2) and after objects enter the board (319.6). For now it only performs its first step, the victory check (323.1): the other steps act on combat, damage, battlefield control and showdowns, which arrive later in M2. Burn Out (432) is part of drawing: repeated Burn Outs within one draw win at once (432.3.c.1).

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

## Rules versions

The engine carries the version of the Core Rules it implements (`rulesVersion`). When Riot publishes a new version:

1. the new PDF is added to `docs/rules/`;
2. the indexing script (see `06-testing.md`) compares the texts and lists the changed rules;
3. the tests of those rules are marked "to re-check" until they are reviewed;
4. the engine moves to the new version once everything has been re-checked.

Replays record the rules version. Replaying an old replay uses the version of its time if it is still available; otherwise, the gap is reported.
