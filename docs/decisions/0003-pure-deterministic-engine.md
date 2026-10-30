# ADR 0003 — Pure and deterministic engine

**Status**: Accepted
**Date**: 2026-10-30

## Context

Replays, rewind, tests, fuzzing, the AI and bug detection in production all rely on the ability to replay a game identically.

## Decision

`@foilengine/rules` does no I/O, uses neither the clock nor `Math.random`, and depends only on `types`. Randomness comes from a seeded PRNG (xoshiro128** or PCG) whose state is stored in `GameState`.

## Consequences

Replaying seed + actions gives exactly the same game. Any divergence is a bug that can be detected automatically (fuzzer, control replay in production).

## Rejected alternatives

Server-side randomness passed as a parameter to every call: more fragile, and replays would depend on an external file.
