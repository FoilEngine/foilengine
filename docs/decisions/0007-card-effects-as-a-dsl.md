# ADR 0007 — Card effects as a DSL

**Status**: Accepted
**Date**: 2026-10-30

## Context

There are more than a thousand cards. Writing them all in code would be long, fragile and hard to verify.

## Decision

A typed DSL (triggers, conditions, targets, atomic actions, keywords) in `@foilengine/cards`. Custom code is the justified exception. Each card has a status (`missing`, `partial`, `complete`, `verified`).

## Consequences

Adding a card becomes mostly data, testable, and open to other contributors later.

## Rejected alternatives

Everything in code: more flexible at first, unmanageable at scale.
