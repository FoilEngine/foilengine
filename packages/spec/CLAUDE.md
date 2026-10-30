# CLAUDE.md — packages/spec

Rule and card scenarios. Tests only: this package exports nothing and nothing depends on it.

## Dependencies

- **Allowed**: `types`, `rules`, `cards`, `testkit`.
- **Forbidden**: being imported by any package or app.

## Layout

- `test/rules/<section>/`: rule scenarios. Each title starts with `rule <exact number>:` and declares `rules: [...]`.
- `test/cards/<set>/`: card scenarios. Each title starts with `card <id>:`.

## Points of attention

- This package exists so that `rules` and `cards` never depend on `testkit` (that would be a cycle).
- Read the exact rule text in the Core Rules PDF (`docs/rules/`) before writing a scenario. The PDF wins over our docs.
- Use test cards (`test:*`) unless the rule is about a specific card.
- Unit tests of a package (RNG, cost computation…) stay in that package's own `test/` folder.

## Read

- `docs/06-testing.md`
- `docs/rules/README.md`

The general project rules are in the root `CLAUDE.md`.
