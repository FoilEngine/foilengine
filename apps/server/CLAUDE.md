# CLAUDE.md — apps/server

Game server: rooms, matchmaking, accounts, API, WebSocket, health, metrics. The only holder of the full state.

## Dependencies

- **Allowed**: all packages except `ui` and `testkit`.
- **Forbidden**: sending the full state to a client; implementing a rule.

## Public API

HTTP routes, the `protocol` WebSocket messages, `/healthz`, `/readyz`, `/health/details`, `/metrics`.

## Points of attention

- One action at a time per game; `expectedSeq` to reject stale actions.
- Persist the log as it goes; rebuild running games at startup.
- The engine self-test at startup gates `/readyz`. It replays the reference replays, read as data files (`.foilreplay`), with `rules` and `log`: never by importing `testkit`.
- Running a scenario for the console's scenario runner without `testkit` is still an open question (ADR 0017).
- Configuration validated by Zod at startup; `.env.example` kept up to date.

## Read

- `docs/08-server-and-protocol.md`
- `docs/07-observability.md`

The general project rules are in the root `CLAUDE.md`.
