# ADR 0004 — Immutable and serializable state

**Status**: Proposed
**Date**: 2026-10-30

## Context

The state must be replayable, comparable (fingerprint), sent over the network and stored.

## Decision

The state is pure JSON (no `Map`, class or function). `apply` never modifies the state it receives. Internally, **Immer** is used to write transitions readably, with structural sharing.

## Consequences

Simple comparison and serialization. Immer's cost to be measured with the benchmarks: if it is too slow for simulations, switch to hand-written immutable updates on the hot paths.

## Rejected alternatives

Direct mutation with a deep copy: simple but costly. Persistent structures (Immutable.js): not pure JSON.
