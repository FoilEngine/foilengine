# ADR 0002 — Strict TypeScript everywhere

**Status**: Accepted
**Date**: 2026-10-30

## Context

The engine handles a rich state where a type error becomes a silent rules bug.

## Decision

TypeScript everywhere (engine, server, clients, tools), with `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`. Branded identifiers, discriminated unions and exhaustive `switch` statements.

## Consequences

The engine can run in the browser (offline mode) and on the server without duplication.

## Rejected alternatives

Rust or Go for the engine: faster, but we would lose sharing with the client and double the skills required. To reconsider only if the benchmarks demand it.
