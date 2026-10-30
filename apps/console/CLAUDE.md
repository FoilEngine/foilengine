# CLAUDE.md — apps/console

The administration and monitoring console.

## Dependencies

- **Allowed**: `ui`, `protocol`, `types`, `log`.
- **Forbidden**: being reachable without an admin role; importing `testkit` or `rules`. Coverage reports, replays and the scenario runner go through the server API.

## Public API

—

## Points of attention

- Pages: health, running games, replays, rules (coverage and scenario runner), cards, simulations, errors, metrics.

## Read

- `docs/07-observability.md`

The general project rules are in the root `CLAUDE.md`.
