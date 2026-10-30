# 06 — Testing (`@foilengine/testkit` and `@foilengine/spec`)

The goal: be able to test **every rule** of the Core Rules, know at any time which ones are covered, and turn every bug into a test.

## Levels

| Level | Tool | What it checks | When |
| --- | --- | --- | --- |
| Unit | Vitest | A function (RNG, cost computation, layer) | Every commit |
| **Rule scenarios** | `scenario()` harness | One precise rule, quoted by its number | Every commit |
| **Card scenarios** | `scenario()` harness | The behavior of a card | Every commit |
| **Fuzzing** | `fuzz()` + fast-check | Thousands of random games, invariants at every step | Short on every commit, long every night |
| **Reference replays** | `golden/` | Full games replayed, final state identical bit for bit | Every commit |
| Properties | fast-check | Serialization, determinism, `viewFor` without leaks | Every commit |
| Benchmarks | `vitest bench` | Engine performance budgets | Every PR |
| Server integration | Vitest + real server + Postgres and Valkey in containers | Protocol, rooms, reconnection, authority | Every PR |
| Load | k6 | Concurrent games, WebSocket latency | Before every significant production release |
| End to end | Playwright | Client flows (create a room, play a turn, watch the replay) | Every PR touching `play` |
| AI | `sim` | Win rates of the policies against each other, non-regression | Every night |

## The scenario harness

A scenario describes a starting state, actions, and what is expected. It always quotes the rule or rules under test.

The harness lives in `@foilengine/testkit`; the scenarios live in `@foilengine/spec`, which depends on `rules`, `cards` and `testkit` and which nothing depends on: `packages/spec/test/rules/<section>/` for rules, `packages/spec/test/cards/<set>/` for cards. That way `rules` and `cards` never depend on `testkit` (no cycle). A package's unit tests (RNG, cost computation…) stay in its own `test/`.

```ts
scenario('rule 315.3.b: turn player channels 2 runes at Channel step', {
  rules: ['315.3.b'],
  setup: board()
    .player('A', { runeDeck: 10 })
    .player('B')
    .activePlayer('A')
    .atStep('start.channel'),
  check: (t) => {
    t.expectEvents(['RuneChanneled', 'RuneChanneled']);
    t.expect(t.player('A').runesInPlay).toHaveLength(2);
  },
});

scenario('rule 315.3.b.1: channel only what remains when the rune deck is short', {
  rules: ['315.3.b.1'],
  setup: board().player('A', { runeDeck: 1 }).activePlayer('A').atStep('start.channel'),
  check: (t) => t.expectEvents(['RuneChanneled']),
});
```

The example above shows where the harness is going: `atStep`, `activePlayer` and rune decks come with the turn structure in M2. The part of a scenario that checks the result is called `check`, not `then`: an object with a `then` method passes for a promise.

The parts of the harness:

- **`board()`**: a readable state builder. It always starts from a real `createGame` (same validations, `BoardError` otherwise), then only changes what the rules leave to chance: who goes first (115) and the order of the shuffled decks (114). Any state it builds is therefore reachable, never impossible. In M1: `.setup(setup)` (default `testSetup()`), `.seed(seed)`, `.firstPlayer(id)`, `.player(id, { hand, mainDeckTop })` with cards by id or exact name, `.afterMulligans()`. Units on battlefields, phase and step, priority, focus and chain arrive with the milestones that implement them.
- **`scenario(title, { rules, setup, act, check })`**: refuses, when the file is loaded, a title that does not start with `rule <first declared rule>:` and any rule number that does not exist in the index of the Core Rules version the engine implements.
- **`act(...)`**: applies actions and fails if one is illegal (or `actIllegal(...)` to check a refusal and its reason, and that the state did not change).
- **`expectEvents`** (types of the events of the last `act`), **`expectLegal`**, **`expectIllegal(action, code)`**, **`expectDecision`**, plus `mulligan(player, cards)`, `hand(player)`, `mainDeck(player)` and `player(id)` to read the state.
- **Test cards**: fictional cards (`test:vanilla-2-2`, `test:draw-on-play`…) to test a rule without depending on a real card.
- Scenarios can be written in TypeScript, or in YAML for simple cases (readable by a non-developer and generated from the console).

## Rule coverage

1. **Indexing the Core Rules**: `pnpm foil rules index` extracts the list of rules from the PDF and writes it to `docs/rules/index/<version>.json`: for each rule its number, its parent rule, its full text and a fingerprint of that text (format in `docs/rules/README.md`). The index is committed, and a CLI test regenerates it from the PDF and fails if the committed file is out of date.
2. **Collection**: each scenario declares its `rules`. The engine, for its part, marks in the events the rule that produced them.
3. **Report** (`pnpm test:rules`): for each rule, its status:

| Status | Meaning |
| --- | --- |
| `covered` | At least one dedicated scenario, green |
| `exercised` | No dedicated scenario, but the rule produced events during tests or fuzzing |
| `uncovered` | Neither |
| `stale` | The rule's text changed in a new version of the Core Rules since the test was written: to re-check |
| `not-applicable` | Rule with no effect on the engine (definitions, advice), with a justification |
| `question` | Ambiguous rule, pending in `docs/rules/questions.md` |

The report is produced in JSON (for the console and the CI) and in Markdown (for the PR). The CI fails if a `covered` rule becomes `uncovered` or if a `stale` test is not handled.

The same mechanism produces **card coverage** (statuses from `04-cards-and-effects.md`) and **keyword coverage**.

## Fuzzing and invariants

The fuzzer plays full games with a random policy (and policies biased towards rare actions: concede, maximal mulligan, long chains). At **every step**, it checks the invariants:

- The total number of cards of each player is constant (no card created or destroyed; only tokens appear and disappear).
- No `ObjectId` is duplicated; every referenced object exists.
- Points never go below 0 and only decrease through an effect that says so.
- There is at most one chain; priority and focus follow 312–313.
- `legalActions` is never empty while the game is not over and a decision is expected.
- Every action returned by `legalActions` passes `isLegal`.
- The state is serializable, and `deserialize(serialize(state))` is equivalent.
- **Determinism**: replaying the game from the seed and the log gives exactly the same state fingerprint at every step.
- **No leak**: `viewFor(state, p)` contains no identifier of a card hidden from `p`.
- The game ends in fewer than N actions (anti-loop bound).

A violation produces a **reproduction file** (seed, decks, log up to the faulty action) in `testkit/repros/`, which `/investigate-replay` knows how to use. The fuzzer automatically shrinks the reproduction when it can.

## Reference replays

`testkit/golden/*.foilreplay`: full games, taken from real games or written by hand to cover an interaction. They are **data files**: the CI replays them and compares the fingerprint of the final state and the sequence of events, and the server reads them at startup for its self-test, without importing `testkit`'s code. An intentional change of behavior updates the replay with a justification in the commit.

## Rule bugs

Every reported rule bug ("Rule applied incorrectly" issue) follows the same path:

1. Get the game's replay (the console can export it).
2. `/investigate-replay`: replay, find the first action where the engine departs from the rules.
3. Write a minimal scenario that reproduces the gap, with the rule number.
4. Fix it, then add the replay to the references if the interaction is interesting.

## Tests in production

The engine also runs checks in production (see `07-observability.md`): self-test at startup on the reference replays (read as data files, without `testkit`), sampled invariant checks on real games, and background replays of finished games to detect any non-determinism.
