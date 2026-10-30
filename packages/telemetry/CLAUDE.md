# CLAUDE.md — packages/telemetry

Shared logs, metrics, traces, errors and healthchecks.

## Dependencies

- **Allowed**: Pino, prom-client, OpenTelemetry, Sentry SDK (to GlitchTip).
- **Forbidden**: depending on a domain package.

## Public API

`createLogger`, `metrics` (registry and declared metrics), `tracer`, `captureError`, `createHealthRegistry` (checks with thresholds).

## Points of attention

- All metrics are declared here, with the `foil_` prefix, and listed in `docs/07-observability.md`.
- Never a secret, a token or hidden game information in the logs.

## Read

- `docs/07-observability.md`

The general project rules are in the root `CLAUDE.md`.
