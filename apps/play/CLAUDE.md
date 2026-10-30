# CLAUDE.md — apps/play

The game client.

## Dependencies

- **Allowed**: `ui`, `protocol`, `types`; `rules`, `cards` and `mind` only in the offline-mode Web Worker, under `src/offline/` (checked by Biome).
- **Forbidden**: deciding legality online; computing a state other than by projecting the events.

## Public API

—

## Points of attention

- Event-driven: every event has its animation and its sound.
- Touch, keyboard and screen readers from the start; no hard-coded strings (translations).

## Read

- `docs/10-clients.md`

The general project rules are in the root `CLAUDE.md`.
