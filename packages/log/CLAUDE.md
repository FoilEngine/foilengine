# CLAUDE.md — packages/log

Event log, replays, notation, state fingerprint, visibility filtering.

## Dependencies

- **Allowed**: `types`, `rules`.
- **Forbidden**: I/O (persistence is done by the server).

## Public API

`startReplay`, `recordAction`, `serializeReplay`, `parseReplay`, `replay`, `rewindTo`, `stateHash`, `stepHash`, `canonicalJson`, `filterEventsFor`. The game notation is not written yet: it arrives with the client's log (`docs/10-clients.md`).

## Points of attention

- The `.foilreplay` format is versioned: an old replay must stay readable.
- `stateHash` must be stable (normalized key order).
- Changing `canonicalJson` or `hash128` changes every fingerprint, so every recorded replay: it needs a new `REPLAY_FORMAT`.
- Tests cannot use `testkit` (`testkit` may depend on `log`, docs/01-architecture.md): they have their own small setup in `test/fixture.ts`.

## Read

- `docs/02-game-model.md`
- `docs/03-rules-engine.md`

The general project rules are in the root `CLAUDE.md`.
