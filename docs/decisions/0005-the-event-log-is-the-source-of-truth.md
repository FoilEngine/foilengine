# ADR 0005 — The event log is the source of truth

**Status**: Accepted
**Date**: 2026-10-30

## Context

Animations, sounds, replays, rewind, statistics, AI training and debugging all need to know what happened, in order.

## Decision

`apply` returns typed, numbered events, with the rule that produced them and their visibility. A game's log (seed, decks, rules version, actions, events) is persisted and is enough to rebuild it.

## Consequences

The client animates from the events, never from a state diff. The log format is versioned.

## Rejected alternatives

State diffs: impossible to animate cleanly, and they do not say why the state changed.
