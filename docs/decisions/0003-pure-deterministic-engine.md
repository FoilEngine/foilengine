# ADR 0003 — Pure and deterministic engine

**Status**: Accepted
**Date**: 2026-10-30

## Context

Replays, rewind, tests, fuzzing, the AI and bug detection in production all rely on the ability to replay a game identically.

## Decision

`@foilengine/rules` does no I/O, uses neither the clock nor `Math.random`, and depends only on `types`. Randomness comes from a seeded PRNG whose state is stored in `GameState`.

**Generator (chosen in M1)**: xoshiro128** 1.1 (Blackman and Vigna, public domain), in `packages/rules/src/rng/`. It only uses 32-bit integer operations (`Math.imul`, shifts), so Node and browsers produce the same sequence without `BigInt`. The initial state is derived from the game seed (a string) by four FNV-1a lanes with a Murmur3 finalizer. Tests check the generator against values computed from the official C source, and lock the seed derivation.

## Consequences

Replaying seed + actions gives exactly the same game. The seed derivation (`createRng`) is part of the replay contract: changing it changes every game recorded from a seed, so it needs a new log format version. Any divergence is a bug that can be detected automatically (fuzzer, control replay in production).

## Rejected alternatives

Server-side randomness passed as a parameter to every call: more fragile, and replays would depend on an external file.
