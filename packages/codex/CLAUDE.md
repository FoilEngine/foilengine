# CLAUDE.md — packages/codex

Import, normalization and snapshots of the card data.

## Dependencies

- **Allowed**: `types`, Zod, an HTTP client (only in the sync scripts).
- **Forbidden**: being called by the engine at runtime; depending on the network in tests.

## Public API

`loadSnapshot`, `validateDeck`, the deck import parsers, the `codex sync` command.

## Points of attention

- Keep `CardDefinition` (the rule) and `Printing` (the printing) apart.
- Snapshots are committed; tests use a specific snapshot.
- Data entered by hand (errata, bans, boosters, rulings) always quotes its source.

## Read

- `docs/05-codex-data.md`

The general project rules are in the root `CLAUDE.md`.
