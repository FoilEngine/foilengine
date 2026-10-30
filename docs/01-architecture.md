# 01 — Architecture

## Overview

```
                 ┌──────────────────────── apps ─────────────────────────┐
                 │ play (client)   site (website)  console (admin)   cli │
                 └───────┬───────────────────────────────┬───────────┬───┘
                         │ WebSocket + HTTP (protocol)   │ HTTP      │
                 ┌───────▼───────────────────────────────▼───────────▼───┐
                 │                     apps/server                       │
                 │  rooms · matchmaking · auth · API · healthchecks      │
                 └──┬─────────────┬─────────────┬─────────────┬──────────┘
                    │             │             │             │
              ┌─────▼────┐  ┌─────▼────┐  ┌─────▼────┐  ┌─────▼─────┐
              │  rules   │  │   log    │  │   mind   │  │ db / queue│
              │(referee) │  │ (journal)│  │   (AI)   │  │ (Postgres,│
              └─────┬────┘  └──────────┘  └─────┬────┘  │  Valkey)  │
                    │                           │       └───────────┘
              ┌─────▼────┐                ┌─────▼────┐
              │  cards   │                │   sim    │  ← workers
              │ (effects)│                │ (batch)  │
              └─────┬────┘                └──────────┘
              ┌─────▼────┐
              │  types   │   codex (data) → produces the card definitions
              └──────────┘
```

Everything is strict TypeScript in a pnpm + Turborepo monorepo.

## Packages

| Package | Role | Depends on |
| --- | --- | --- |
| `@foilengine/types` | Shared types: identifiers, card definitions, state, actions, events, views. No logic. | nothing |
| `@foilengine/rules` | The rules engine. API: `createGame`, `legalActions`, `apply`, `outcome`, `viewFor`. Pure and deterministic. | `types` |
| `@foilengine/cards` | The effect DSL and the implementation of every card, with its status. | `types`, `rules` (effect API only, through `@foilengine/rules/effects`) |
| `@foilengine/codex` | Card data import (Riftcodex, TCGplayer catalog), normalization, versioned snapshots. | `types` |
| `@foilengine/protocol` | Client-server messages, Zod schemas, versioned. | `types` |
| `@foilengine/log` | Event log format, serialization, replays, notation, rewind. | `types`, `rules` |
| `@foilengine/mind` | The AI: policies (random, heuristic, MCTS), determinization, evaluation. | `types`, `rules`, `cards` |
| `@foilengine/sim` | Mass simulations, statistics, confidence intervals, weak spot. | `types`, `rules`, `cards`, `mind`, `log` |
| `@foilengine/testkit` | The test harness (`board()`, `scenario()`, test cards), fuzzer, invariants, rule and card coverage, reference replays. Never imported by production code. | `types`, `rules`, `cards`, `log` |
| `@foilengine/spec` | Rule and card scenarios (tests only). Nothing depends on it. | `types`, `rules`, `cards`, `testkit` |
| `@foilengine/telemetry` | Logs, metrics, traces, healthchecks: shared primitives. | nothing domain-related |
| `@foilengine/db` | Database schema, migrations, access. | `types` |
| `@foilengine/ui` | Design system: tokens, components, sound engine, motion (source: the `brand` repo). | nothing domain-related |

| App | Role |
| --- | --- |
| `apps/server` | Game server: rooms, matchmaking, authentication, API, WebSocket, health and metrics endpoints. The only holder of the full state. |
| `apps/play` | Game client: table, library, deckbuilder, sealed, replays. |
| `apps/site` | Static website. |
| `apps/console` | Administration and monitoring console (see `07-observability.md`). |
| `apps/cli` | The `foil` command-line tool: health, replays, scenarios, coverage, data sync. |

## Dependency rules

- `types` depends on nothing.
- `rules` depends only on `types`. No I/O library, no clock access, no `Math.random`.
- `cards` depends only on `types` and on the effect API exposed by `rules` at the `@foilengine/rules/effects` entry point.
- `spec` hosts the rule and card scenarios; nothing depends on it. `rules` and `cards` never depend on `testkit` (that would be a cycle).
- No package depends on an app.
- Client apps (`play`, `site`, `console`) never depend on `rules` to decide legality. `play` may import it only for the offline mode against the AI, running in a Web Worker, and only from `apps/play/src/offline/`.
- No production code imports `testkit`: neither `server` nor `console` (which goes through the server API).
- `telemetry` is the only door to logs, metrics and traces: no `console` outside `scripts/` and `apps/cli` (whose standard output is its interface).

### How they are enforced

See ADR 0017. Two mechanisms, run by `pnpm lint`, `pnpm check:deps` and the CI:

1. **`scripts/check-deps.ts`** compares the `package.json` of every workspace package with the matrix in `scripts/lib/dependency-rules.ts`, which mirrors the table above: allowed internal dependencies (dev dependencies included), no dependency on an app, no third-party dependency in `types` or `rules`, `workspace:` protocol. pnpm refuses imports of undeclared packages, so checking the manifests is enough at package level. The one gap is the root dev tools (Vitest, fast-check), reachable from every package: Biome's `noUndeclaredDependencies` closes it for `src/` folders. Changing the matrix means changing this document in the same PR.
2. **Biome**, per folder (`biome.json`): `rules/src` is pure (no `Date`, `performance`, timers, `console`, `process`, `globalThis`, `Math.random`, Node modules, nor any import other than `@foilengine/types`), `types/src` imports nothing, `cards/src` only reaches `rules` through `@foilengine/rules/effects`, `play` only imports the engine from `src/offline/`, `console` is forbidden outside `scripts/` and `apps/cli`, and no `src/` folder imports an undeclared dependency.

The tests in `scripts/test/` prove that each rule fires where it should, and only there.

## Flow of an online action

1. The client sends an **intent** (`protocol`): "play card X on target Y".
2. The server validates it against `legalActions(state)`. An illegal action is refused with a readable reason, and counted in a metric.
3. The server calls `apply(state, action)`, which returns `{ state, events }`.
4. The events are appended to the game's log (`log`) and persisted.
5. Each client receives the events **filtered for them** and their view `viewFor(state, player)`.
6. The client animates and plays sounds from the events, never from a state diff.

## Runtime topology

- One `server` process (HTTP + WebSocket), with no durable local state: the state of running games lives in memory, with a persisted log to resume a game after a restart.
- **Workers** for simulations and heavy AI, fed by a job queue.
- PostgreSQL for durable data (accounts, decks, logs, simulation results).
- Valkey (Redis-compatible) for sessions, pub/sub between instances and the job queue.
- The observability stack (see `07-observability.md`) alongside, in Docker Compose.

The stack choices are proposed in `docs/decisions/` and must be validated before implementation.
