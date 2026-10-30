# CLAUDE.md — packages/types

Shared types: branded identifiers, card definitions, game state, zones, actions, events, decisions, views.

## Dependencies

- **Allowed**: nothing.
- **Forbidden**: any dependency, any logic, any function (except trivial type guards and `assertNever`).

## Public API

Only types and constants. Exported from `src/index.ts`.

## Points of attention

- Any change to the shape of `GameState`, `Action` or `GameEvent` increments the relevant version and must stay replayable (see `log`).
- The state must stay pure JSON: no `Map`, `Set`, `Date`, class or function.
- Name events in the past tense, actions in the imperative.

## Read

- `docs/02-game-model.md`
- `docs/13-conventions.md`

The general project rules are in the root `CLAUDE.md`.
