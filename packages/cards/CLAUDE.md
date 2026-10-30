# CLAUDE.md — packages/cards

The effect DSL and the implementation of every card, with its status.

## Dependencies

- **Allowed**: `types`, and the effect API of `rules` through `@foilengine/rules/effects` (checked by Biome).
- **Forbidden**: changing the state other than through the effect API; importing the internals of `rules`.

## Public API

`defineCard`, the DSL building blocks, the card registry and their statuses.

## Points of attention

- One file per card, named after its `riftbound_id`, grouped by set.
- The card's tests first, with the `testkit` harness, named `card <id>: …`, in `packages/spec/test/cards/<set>/` (`cards` never depends on `testkit`).
- The text followed is the text in force (errata included), read from the `codex` snapshot.
- Custom code is the exception: justify it in a comment, and propose a DSL building block at the third similar case.

## Read

- `docs/04-cards-and-effects.md`
- `docs/06-testing.md`

The general project rules are in the root `CLAUDE.md`.
