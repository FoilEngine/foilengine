# ADR 0013 — Hosting: one VPS, Docker Compose, Caddy

**Status**: Proposed
**Date**: 2026-10-30

## Context

A free project, so minimal costs, but strong monitoring requirements.

## Decision

One European VPS, **Docker Compose**, **Caddy** (automatic HTTPS), images built by the CI and published on **GitHub Container Registry**, deployment by image tag from the private `infra` repo, secrets encrypted with **sops + age**, encrypted Postgres backups to external object storage.

## Consequences

Predictable cost, the whole environment reproducible locally. No high availability at first: accepted, and compensated by resuming games from the log.

## Rejected alternatives

Kubernetes: disproportionate. PaaS (Fly.io, Railway): convenient but costly with the full observability stack.
