# ADR 0001 — Monorepo with pnpm and Turborepo

**Status**: Accepted
**Date**: 2026-10-30

## Context

The rules engine is at the center of everything: server, AI, simulations, console and tests depend on it. A rule or type change must be able to touch every consumer in a single commit, tested in a single CI run.

## Decision

A `foilengine` monorepo managed with pnpm workspaces and Turborepo (build and test caching). Packages are private to the monorepo; only the formats that leave it (protocol, log, codex snapshot) are versioned.

## Consequences

No published packages to keep in sync. Turborepo avoids rebuilding everything. In return, the CI must stay fast: we rely on the cache and on running only the affected packages.

## Rejected alternatives

Several repos with published packages: too heavy for a project that moves fast. Nx: more complete but heavier than needed.
