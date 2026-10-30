# ADR 0014 — Observability: OpenTelemetry and the Grafana stack

**Status**: Proposed
**Date**: 2026-10-30

## Context

The project requires being able to check the backend's health at any time and to diagnose every game.

## Decision

**OpenTelemetry** and **Pino** instrumentation, centralized in `@foilengine/telemetry`. **Prometheus** + **Alertmanager** (metrics and alerts), **Grafana** (versioned dashboards), **Loki** (logs), **Tempo** (traces), **GlitchTip** (errors, Sentry-compatible), **Uptime Kuma** (external availability and status page). Alerts to Discord.

## Consequences

Everything is self-hosted and free. The project's console complements Grafana for what is specific to the game (replays, rule coverage, scenarios).

## Rejected alternatives

Managed services (Datadog, paid Sentry, Grafana Cloud): simpler, but costly or limited beyond the free tiers.
