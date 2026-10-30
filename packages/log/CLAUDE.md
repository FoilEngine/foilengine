# CLAUDE.md — packages/log

Event log, replays, notation, state fingerprint, visibility filtering.

## Dependencies

- **Allowed**: `types`, `rules`.
- **Forbidden**: I/O (persistence is done by the server).

## Public API

`serializeReplay`, `parseReplay`, `replay`, `rewindTo`, `stateHash`, `filterEventsFor`, the notation.

## Points of attention

- The `.foilreplay` format is versioned: an old replay must stay readable.
- `stateHash` must be stable (normalized key order).

## Read

- `docs/02-game-model.md`
- `docs/03-rules-engine.md`

The general project rules are in the root `CLAUDE.md`.
