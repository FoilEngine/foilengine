# 07 — Observability and health

Goal: be able to check at any time that the backend is healthy, understand what happens in a game, and be warned before the players when something breaks.

## The three signals

Everything goes through `@foilengine/telemetry`. No package uses `console.log`, a Prometheus client or a tracing SDK directly.

### Logs

- **Pino**, in JSON, one line per event.
- Systematic fields: `ts`, `level`, `service`, `version` (commit), `env`, `msg`, and depending on context `requestId`, `gameId`, `playerId` (pseudonymized), `traceId`, `spanId`.
- Levels: `error` (action required), `warn` (tolerated anomaly), `info` (lifecycle: game created, finished, player connected), `debug` (detail, off in production by default, can be turned on live per game).
- Never a secret, a token, an e-mail address or a player's hand in clear in the logs.
- Collected by Grafana Alloy (or Promtail) into **Loki**.

### Metrics

- **Prometheus** format, exposed on `/metrics` (internal port, not public).
- `foil_` prefix. Names follow the Prometheus conventions (`_total` for counters, `_seconds` for durations).

Minimal metrics:

| Metric | Type | Labels | Why |
| --- | --- | --- | --- |
| `foil_games_active` | gauge | `mode` | Running games |
| `foil_games_started_total` / `foil_games_finished_total` | counter | `mode`, `result` | Activity, concessions |
| `foil_engine_apply_seconds` | histogram | `action_type` | Engine latency |
| `foil_engine_legal_actions_seconds` | histogram | | Engine latency |
| `foil_engine_illegal_actions_total` | counter | `reason` | Clients attempting illegal moves (client bug or cheating) |
| `foil_engine_errors_total` | counter | `kind` (`invariant`, `not_implemented`) | Engine bugs, missing cards |
| `foil_engine_invariant_violations_total` | counter | `invariant` | Sampled checks in production |
| `foil_engine_nondeterminism_total` | counter | | Control replay that diverges |
| `foil_cards_not_implemented_total` | counter | `card` | Which cards are missing most in practice |
| `foil_manual_overrides_total` | counter | `card` | Manual mode usage |
| `foil_ws_connections` | gauge | | WebSocket connections |
| `foil_ws_messages_total` | counter | `direction`, `type` | Traffic |
| `foil_ws_reconnects_total` | counter | | Network stability |
| `foil_action_roundtrip_seconds` | histogram | | From the client message to the events being sent |
| `foil_matchmaking_wait_seconds` | histogram | `mode` | Queue wait |
| `foil_ai_think_seconds` | histogram | `policy` | AI thinking time |
| `foil_sim_jobs` | gauge | `state` (`queued`, `running`, `failed`) | Simulation queue |
| `foil_sim_games_per_second` | gauge | | Worker throughput |
| `foil_http_request_seconds` | histogram | `route`, `status` | API |
| `foil_db_query_seconds` | histogram | `query` | Database |

Plus the default Node runtime metrics (event loop lag, memory, GC).

### Traces

- **OpenTelemetry**, exported to **Tempo**.
- One trace per HTTP request and per WebSocket message. Dedicated spans around `isLegal`, `apply`, log persistence, broadcast to clients, AI thinking.
- The `traceId` is in the logs, to go from a log line to its trace in Grafana.

### Errors

- Self-hosted **GlitchTip** (compatible with the Sentry SDK, so free) for the server, the workers and the client. Every engine error attaches the `gameId`, the rules version and a link to the replay in the console.

## Health endpoints

On `apps/server` (and every worker exposes the same ones on its internal port):

| Endpoint | Role | Content |
| --- | --- | --- |
| `GET /healthz` | Alive? For automatic restarts. | `200 {"status":"ok"}` if the process answers. Checks no dependency. |
| `GET /readyz` | Ready to receive traffic? | `200` if all critical dependencies answer, otherwise `503` with the details. |
| `GET /health/details` | Full diagnosis (protected, admin only) | See below |
| `GET /metrics` | Prometheus | Internal port only |

Response of `/health/details`:

```json
{
  "status": "degraded",
  "version": "a1b2c3d",
  "rulesVersion": "CR-2026-10-09",
  "codexSnapshot": "2026-10-30",
  "uptimeSeconds": 86400,
  "checks": {
    "postgres":     { "status": "ok", "latencyMs": 2, "migrations": "up-to-date" },
    "valkey":       { "status": "ok", "latencyMs": 1 },
    "queue":        { "status": "warn", "queued": 340, "running": 4, "oldestJobSeconds": 620 },
    "engineSelfTest": { "status": "ok", "replays": 25, "durationMs": 180 },
    "websocket":    { "status": "ok", "connections": 112 },
    "workers":      { "status": "ok", "alive": 4, "expected": 4 },
    "disk":         { "status": "ok", "freePercent": 64 },
    "eventLoopLag": { "status": "ok", "p99Ms": 12 }
  }
}
```

Each check has a `warn` and a `fail` threshold, defined in the config and documented here when it changes.

**The engine self-test** (`engineSelfTest`) replays the reference replays at startup and every 10 minutes, and compares the fingerprints. The reference replays are data files (`.foilreplay`) read at startup: the server does not import `testkit`, it replays them with `rules` and `log`. If the self-test fails, `/readyz` fails: an engine that no longer plays correctly must not receive games.

## The `pnpm health` command (and `foil health`)

A single entry point to check an environment, locally or in production:

```bash
pnpm health                 # local environment
foil health --env prod      # production (with an admin token)
foil health --json          # for a script or the CI
```

It checks, in order:
1. The services answer (`/healthz`, `/readyz`): server, workers, Postgres, Valkey, Prometheus, Grafana, Loki, Tempo, GlitchTip.
2. The details of `/health/details`.
3. A **synthetic journey**: connect over WebSocket, create a solo game against the random AI, play to the end, check the replay, delete the game.
4. The active alerts in Alertmanager.
5. The deployed versions (commit, rules version, codex snapshot).

Readable output, one line per check with a status, and a non-zero exit code on failure. The same synthetic journey runs every 5 minutes in production and feeds a `foil_synthetic_check_success` metric.

## The console (`apps/console`)

A web application for administrators only. It goes through the server API for everything it displays or launches, and does not import `testkit`. Pages:

1. **Health**: the visual equivalent of `/health/details`, live, with the history of the last 24 hours.
2. **Running games**: list, mode, duration, players (pseudonymized), last action, latency. Open a game as an administrator spectator, which shows the full state.
3. **Replays**: search for a game, replay it step by step with the full state and the events, export the replay, run `/investigate-replay` on a replay (generates a file for Claude Code).
4. **Rules**: the rule coverage report (status per number), the open questions, and a **scenario runner**: pick or write a scenario (YAML), run it against the deployed version through the server API and see the result. Open question (ADR 0017): the server does not import `testkit`, and how it runs a scenario is still to be decided.
5. **Cards**: card coverage per set and per legend, the cards most often in manual mode, the cards most involved in engine errors.
6. **Simulations**: job queue, worker throughput, recent results.
7. **Errors**: the latest engine errors with a link to GlitchTip and to the replay.
8. **Metrics**: embedded Grafana graphs for the main dashboards.

## Grafana dashboards

Versioned in `infra/grafana/dashboards/` as JSON, provisioned automatically:

- **Overview**: active games, connected players, errors, p50/p95/p99 latencies, check status.
- **Engine**: `apply` and `legalActions` latencies per action type, illegal actions per reason, engine errors, unimplemented cards.
- **Real time**: connections, messages, reconnections, action round trip.
- **Simulations and AI**: queue, throughput, thinking time.
- **Infrastructure**: CPU, memory, disk, Postgres, Valkey.

## Alerts

Prometheus rules versioned in `infra/prometheus/alerts/`, routed by Alertmanager to a Discord webhook (and e-mail as a fallback):

| Alert | Condition | Severity |
| --- | --- | --- |
| `ServerDown` | `/healthz` has not answered for 1 min | critical |
| `NotReady` | `/readyz` failing for 2 min | critical |
| `EngineSelfTestFailed` | engine self-test failing | critical |
| `EngineNondeterminism` | `foil_engine_nondeterminism_total` increases | critical |
| `EngineInvariantViolations` | invariant violations > 0 over 10 min | high |
| `EngineErrorsSpike` | engine errors > 1% of actions over 10 min | high |
| `SyntheticCheckFailing` | synthetic journey failing twice in a row | high |
| `HighActionLatency` | p95 of the action round trip > 250 ms over 10 min | medium |
| `SimQueueBacklog` | oldest job > 15 min | medium |
| `DiskAlmostFull` | less than 15% free | medium |
| `BackupMissing` | no successful backup for 26 h | high |

Every alert links to a runbook in the `infra` repo (`docs/runbooks/`).

## External uptime

**Uptime Kuma** checks the public page, the API and the WebSocket from the outside, and publishes a public status page.

## Locally

`infra/docker-compose.observability.yml` starts Prometheus, Grafana (with the dashboards), Loki, Tempo, Alertmanager, GlitchTip and Uptime Kuma. `pnpm dev:obs` runs the application with this stack, to develop the monitoring in the same conditions as in production.
