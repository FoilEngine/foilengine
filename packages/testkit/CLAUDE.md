# CLAUDE.md — packages/testkit

Test tools: `board()`, `scenario()`, test cards, fuzzer, invariants, reference replays, Core Rules indexing, coverage reports.

## Dependencies

- **Allowed**: `types`, `rules`, `cards`, `log`, fast-check.
- **Forbidden**: being imported by production code (neither `server` nor `console`). Only `spec` (the scenarios) and `cli` import it.

## Public API

`board`, `scenario`, `fuzz`, `INVARIANTS`, `goldenReplays`, `indexCoreRules`, `ruleCoverage`, `cardCoverage`.

## Points of attention

- The harness lives here, the scenarios in `@foilengine/spec`: `rules` and `cards` never depend on `testkit`.
- `board()` goes through the same validations as `createGame`: never an impossible state.
- The reference replays (`golden/*.foilreplay`) are data files: the server reads them at startup for its self-test without importing this package.
- An invariant violation produces a reproduction file in `repros/`.
- The coverage report comes out in JSON (console, CI) and in Markdown (PR).

## Read

- `docs/06-testing.md`

The general project rules are in the root `CLAUDE.md`.
