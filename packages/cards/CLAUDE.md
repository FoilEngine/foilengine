# CLAUDE.md — packages/cards

The effect DSL and the implementation of every card, with its status.

## Dependencies

- **Allowed**: `types`, and `@foilengine/rules/effects`, which checks definitions (checked by Biome). Cards are plain data that the engine interprets (ADR 0019).
- **Forbidden**: code that changes a state; importing the internals of `rules`.

## Public API

`defineCard`, the DSL building blocks, the card registry and their statuses.

## Points of attention

- One file per card, named after its `riftbound_id`, grouped by set.
- The card's tests first, with the `testkit` harness, named `card <id>: …`, in `packages/spec/test/cards/<set>/` (`cards` never depends on `testkit`).
- The text followed is the text in force (errata included), read from the `codex` snapshot.
- No custom code: a card the vocabulary cannot express stays `partial` or `missing` until a building block, named after the mechanic, is added to the vocabulary (`types/effects.ts`) and its interpreter to `rules` (ADR 0019).

## Read

- `docs/04-cards-and-effects.md`
- `docs/06-testing.md`

The general project rules are in the root `CLAUDE.md`.
