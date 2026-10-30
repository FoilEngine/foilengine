# CLAUDE.md — packages/rules

The rules engine: the referee. Decides legality, resolves everything, detects victory.

## Dependencies

- **Allowed**: `@foilengine/types` only.
- **Forbidden**: network, files, clock (`Date`, `performance`), `Math.random`, mutable global variables, `console`, any I/O library.

## Public API

`createGame`, `legalActions`, `isLegal`, `apply`, `outcome`, `viewFor`, `pendingDecision`, `characteristics` (entry point `@foilengine/rules`), and the effect API used by `cards` (entry point `@foilengine/rules/effects`, the only one `cards` may reach).

## Points of attention

- Always re-read the exact text of the rule in `docs/rules/` before implementing it, and quote its number in the test and in a header comment. The PDF wins over our docs.
- Rule scenarios live in `packages/spec/test/rules/<section>/`, not here: `rules` never depends on `testkit`. Unit tests (RNG, etc.) stay in `packages/rules/test/`.
- Purity is checked by Biome (`biome.json`) and `pnpm check:deps`: no `Date`, timers, `console`, `globalThis`, `Math.random`, Node module, nor any import other than `@foilengine/types`.
- Rule 124: changing zones creates a new object (new `ObjectId`).
- Every state change goes through an atomic game action (`actions/`), so that replacements, triggers and cleanups apply.
- The chain loop (HOT FEPR) and the fixed-point cleanup are bounded: exceeding the bound throws `EngineInvariantError`.
- Characteristics are never stored computed: `characteristics()` applies the layers on read.
- A player's choice is a `Decision`, never a callback.
- When in doubt about a rule: `docs/rules/questions.md`, no assumption.

## Read

- `docs/02-game-model.md`
- `docs/03-rules-engine.md`
- `docs/06-testing.md`
- `docs/rules/`

The general project rules are in the root `CLAUDE.md`.
