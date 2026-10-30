# ADR 0004 — Immutable and serializable state

**Status**: Accepted (2026-10-30, without Immer)
**Date**: 2026-10-30

## Context

The state must be replayable, comparable (fingerprint), sent over the network and stored. The first version of this ADR proposed Immer for state transitions, which would have been the first third-party dependency of `@foilengine/rules`.

## Decision

The state is pure JSON (no `Map`, `Set`, `Date`, class or function). `apply` never modifies the state it receives: it returns a new state.

Transitions are written as **hand-written immutable updates** (spread, `map`, `filter`, small helpers inside `rules`), with structural sharing of the untouched parts. No Immer: `@foilengine/rules` keeps zero third-party dependencies.

## Consequences

- Simple comparison and serialization, no dependency to audit in the engine.
- More verbose code for deep updates: small update helpers live in `rules` itself.
- To revisit with the M2 benchmarks and once the chain and abilities (M3) make transitions heavier. Adopting Immer, or any other dependency of `rules`, needs a new ADR that supersedes this one.

## Rejected alternatives

- Immer (for now): readable transitions with structural sharing, but a third-party dependency in the pure engine, and a cost to measure. Not needed for M1 (setup and mulligan).
- Direct mutation with a deep copy: simple but costly.
- Persistent structures (Immutable.js): not pure JSON.
