# ADR 0009 — Manual mode for unimplemented cards

**Status**: Accepted
**Date**: 2026-10-30

## Context

The engine will not implement every card for a long time, but players want to play their decks.

## Decision

A `missing` or `partial` card can be resolved by hand by the player through `ManualOverride`, recorded as such in the log. These games are excluded from statistics and from AI training.

## Consequences

The simulator is usable early, and the cards most used in manual mode show what to implement first.

## Rejected alternatives

Blocking incomplete decks: the product would stay unusable for too long.
